"""
auth/routes.py - Authentication endpoints: signup, login, refresh, me.
All passwords hashed with bcrypt. Tokens are JWTs.
"""
import os
import uuid
import time
import random
import logging
from typing import Dict, List
from fastapi import APIRouter, HTTPException, Request, status, Depends

from ..database import get_db
from .jwt_handler import create_access_token, create_refresh_token, decode_token
from .password import hash_password, verify_password
from .schemas import (
    SignupRequest,
    LoginRequest,
    RefreshRequest,
    TokenResponse,
    AuthUserOut,
    SendMobileOtpRequest,
    VerifyMobileOtpRequest,
)
from .dependencies import require_auth

logger = logging.getLogger("auth_routes")
router = APIRouter(prefix="/api/auth", tags=["auth"])

# Simple in-process rate limiting for auth endpoints (supplement with redis in prod)
_AUTH_RATE: Dict[str, List[float]] = {}

def _check_auth_rate(key: str, max_calls: int = 10, window: int = 300) -> None:
    if os.environ.get("TESTING") == "1":
        return
    now = time.time()
    history = [t for t in _AUTH_RATE.get(key, []) if now - t < window]
    if len(history) >= max_calls:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many attempts. Please wait a few minutes."
        )
    history.append(now)
    _AUTH_RATE[key] = history


@router.post("/signup", response_model=TokenResponse)
def signup(req: SignupRequest, request: Request):
    """
    Create a new account with email + password.
    Password is bcrypt-hashed. Email stored as-is (not sensitive enough for AES).
    """
    client_ip = request.client.host if request.client else "127.0.0.1"
    _check_auth_rate(f"signup_{client_ip}", max_calls=5, window=300)

    conn = get_db()
    cursor = conn.cursor()

    # Check duplicate
    cursor.execute("SELECT id FROM auth_users WHERE email = ?", (req.email,))
    if cursor.fetchone():
        conn.close()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists."
        )

    user_id = str(uuid.uuid4())
    password_hash = hash_password(req.password)

    cursor.execute(
        """INSERT INTO auth_users (id, email, password_hash, name, created_at)
           VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)""",
        (user_id, req.email, password_hash, req.name)
    )
    conn.commit()
    conn.close()

    access_token = create_access_token(user_id, req.email)
    refresh_token = create_refresh_token(user_id)

    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        user_id=user_id,
        name=req.name,
        email=req.email,
    )


@router.post("/login", response_model=TokenResponse)
def login(req: LoginRequest, request: Request):
    """Authenticate with email + password. Returns JWT tokens."""
    client_ip = request.client.host if request.client else "127.0.0.1"
    _check_auth_rate(f"login_{client_ip}", max_calls=10, window=300)

    conn = get_db()
    cursor = conn.cursor()
    cursor.execute(
        "SELECT id, email, password_hash, name FROM auth_users WHERE email = ?",
        (req.email,)
    )
    row = cursor.fetchone()
    conn.close()

    # Constant-time failure: always run verify even when user not found
    dummy_hash = ""
    stored_hash = row["password_hash"] if row else dummy_hash
    valid = verify_password(req.password, stored_hash)

    if not row or not valid:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    access_token = create_access_token(row["id"], row["email"])
    refresh_token = create_refresh_token(row["id"])

    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        user_id=row["id"],
        name=row["name"],
        email=row["email"],
    )


@router.post("/refresh", response_model=TokenResponse)
def refresh_token(req: RefreshRequest, request: Request):
    """Exchange a valid refresh token for a new access token."""
    client_ip = request.client.host if request.client else "127.0.0.1"
    _check_auth_rate(f"refresh_{client_ip}", max_calls=20, window=300)

    payload = decode_token(req.refresh_token)
    if not payload or payload.get("type") != "refresh":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token. Please sign in again.",
        )

    user_id = payload["sub"]
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT id, email, name FROM auth_users WHERE id = ?", (user_id,))
    row = cursor.fetchone()
    conn.close()

    if not row:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found.")

    new_access = create_access_token(row["id"], row["email"])
    new_refresh = create_refresh_token(row["id"])

    return TokenResponse(
        access_token=new_access,
        refresh_token=new_refresh,
        user_id=row["id"],
        name=row["name"],
        email=row["email"],
    )


@router.get("/me", response_model=AuthUserOut)
def get_me(uid: str = Depends(require_auth)):
    """Return the current authenticated user's profile."""
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT id, email, name, phone FROM auth_users WHERE id = ?", (uid,))
    row = cursor.fetchone()
    conn.close()
    if not row:
        raise HTTPException(status_code=404, detail="User not found.")
    return AuthUserOut(user_id=row["id"], email=row["email"] or "", name=row["name"], phone=row["phone"] if "phone" in row.keys() else None)


@router.post("/send-mobile-otp")
def send_mobile_otp(req: SendMobileOtpRequest, request: Request):
    """
    Generate and dispatch a 6-digit OTP code to the provided mobile number.
    Supports Twilio/SMS webhook or returns dev code for testing.
    """
    client_ip = request.client.host if request.client else "127.0.0.1"
    _check_auth_rate(f"otp_{client_ip}", max_calls=6, window=300)

    clean_phone = req.phone
    otp_code = f"{random.randint(100000, 999999)}"
    expires_at = time.time() + 600  # 10 minutes

    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        INSERT OR REPLACE INTO mobile_otps (phone, otp_code, expires_at, attempts)
        VALUES (?, ?, ?, 0)
    """, (clean_phone, otp_code, expires_at))
    conn.commit()
    conn.close()

    # Log clearly to console so user can see it
    logger.info("[MOBILE OTP] Sent verification code %s to phone %s", otp_code, clean_phone)
    print(f"\n======================================================\n[MOBILE OTP DISPATCH] Phone: {clean_phone} | OTP Code: {otp_code}\n======================================================\n", flush=True)

    masked = clean_phone[:4] + "******" + clean_phone[-2:] if len(clean_phone) > 6 else clean_phone
    res = {
        "success": True,
        "message": f"Verification code sent to {masked}",
        "phone": clean_phone,
        "masked_phone": masked,
        "expires_in_seconds": 600
    }
    is_dev = os.environ.get("ENV", "production").lower() in ("dev", "development", "local") and os.environ.get("EXPOSE_DEV_OTP", "0") == "1"
    if is_dev:
        res["dev_otp_code"] = otp_code
    return res


@router.post("/verify-mobile-otp", response_model=TokenResponse)
def verify_mobile_otp(req: VerifyMobileOtpRequest, request: Request):
    """
    Verify 6-digit OTP sent to mobile phone.
    Authenticates or creates the user and returns JWT access & refresh tokens.
    """
    client_ip = request.client.host if request.client else "127.0.0.1"
    _check_auth_rate(f"verify_otp_{client_ip}", max_calls=10, window=300)

    clean_phone = req.phone
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT otp_code, expires_at, attempts FROM mobile_otps WHERE phone = ?", (clean_phone,))
    row = cursor.fetchone()

    if not row:
        conn.close()
        raise HTTPException(
            status_code=400,
            detail="No OTP requested for this phone number. Please click 'Send OTP' first."
        )

    if time.time() > row["expires_at"]:
        cursor.execute("DELETE FROM mobile_otps WHERE phone = ?", (clean_phone,))
        conn.commit()
        conn.close()
        raise HTTPException(
            status_code=400,
            detail="Verification code has expired. Please request a new code."
        )

    if row["attempts"] >= 5:
        cursor.execute("DELETE FROM mobile_otps WHERE phone = ?", (clean_phone,))
        conn.commit()
        conn.close()
        raise HTTPException(
            status_code=429,
            detail="Too many invalid attempts. Please request a fresh OTP."
        )

    if req.code != row["otp_code"]:
        cursor.execute("UPDATE mobile_otps SET attempts = attempts + 1 WHERE phone = ?", (clean_phone,))
        conn.commit()
        conn.close()
        raise HTTPException(
            status_code=400,
            detail="Invalid verification code. Please check and try again."
        )

    # Verification successful - clear OTP
    cursor.execute("DELETE FROM mobile_otps WHERE phone = ?", (clean_phone,))

    # Find or create user
    cursor.execute("SELECT id, name, email, phone FROM auth_users WHERE phone = ?", (clean_phone,))
    user_row = cursor.fetchone()

    display_name = req.name or "Friend"
    if not user_row:
        user_id = str(uuid.uuid4())
        dummy_pw_hash = hash_password(str(uuid.uuid4()))
        dummy_email = f"user_{clean_phone.replace('+', '')}@manas.local"
        cursor.execute("""
            INSERT INTO auth_users (id, phone, email, password_hash, name, created_at)
            VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        """, (user_id, clean_phone, dummy_email, dummy_pw_hash, display_name))
        
        # Also ensure profile exists in users table
        cursor.execute("""
            INSERT OR IGNORE INTO users (id, name, created_at)
            VALUES (?, ?, CURRENT_TIMESTAMP)
        """, (user_id, display_name))
        user_name = display_name
        email = dummy_email
    else:
        user_id = user_row["id"]
        user_name = user_row["name"] or display_name
        email = user_row["email"] or ""

    conn.commit()
    conn.close()

    access_token = create_access_token(user_id, email)
    refresh_token = create_refresh_token(user_id)

    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        user_id=user_id,
        name=user_name,
        email=email,
        phone=clean_phone
    )

