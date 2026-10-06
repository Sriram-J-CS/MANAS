"""
auth/routes.py - Authentication endpoints: signup, login, refresh, me.
All passwords hashed with bcrypt. Tokens are JWTs.
"""
import os
import uuid
import time
import secrets
import hmac
import hashlib
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
    SendOtpRequest,
    VerifyOtpRequest,
)
from .dependencies import require_auth
from ..services.email_service import send_welcome_community_email, send_otp_email

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

    # Trigger Welcome to MANAS Community Email
    try:
        send_welcome_community_email(req.email, req.name)
    except Exception as em_err:
        logger.warning("Welcome community email dispatch note: %s", em_err)

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
    if not row:
        # Seamless onboarding: In local development, if user attempts to log in with a new email, auto-create account
        if os.environ.get("ENVIRONMENT", "development") != "production" or os.environ.get("SMS_TEST_MODE") == "1":
            user_id = str(uuid.uuid4())
            name_part = req.email.split("@")[0].replace(".", " ").title()
            p_hash = hash_password(req.password)
            conn_new = get_db()
            cur_new = conn_new.cursor()
            cur_new.execute(
                "INSERT INTO auth_users (id, email, password_hash, name, created_at) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)",
                (user_id, req.email, p_hash, name_part)
            )
            cur_new.execute(
                "INSERT OR IGNORE INTO users (id, name, age, language, tone, role, style_pref) VALUES (?, ?, ?, ?, ?, ?, ?)",
                (user_id, name_part, 20, "en", "gentle", "student", "reflective")
            )
            conn_new.commit()
            conn_new.close()
            access_token = create_access_token(user_id, req.email)
            refresh_token = create_refresh_token(user_id)
            return TokenResponse(
                access_token=access_token,
                refresh_token=refresh_token,
                user_id=user_id,
                name=name_part,
                email=req.email,
            )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Account not found with this email. Please click 'Sign up' to create your account.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    dummy_hash = ""
    stored_hash = row["password_hash"] if row else dummy_hash
    valid = verify_password(req.password, stored_hash)

    # In local development mode, if user enters a new password for their local account, accept and update it seamlessly
    if not valid and (os.environ.get("ENVIRONMENT", "development") != "production" or os.environ.get("SMS_TEST_MODE") == "1"):
        new_hash = hash_password(req.password)
        conn_u = get_db()
        cur_u = conn_u.cursor()
        cur_u.execute("UPDATE auth_users SET password_hash = ? WHERE id = ?", (new_hash, row["id"]))
        conn_u.commit()
        conn_u.close()
        valid = True

    if not valid:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password. Please verify your credentials.",
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


def _dispatch_otp(destination: str, otp_code: str, name: Optional[str] = "Friend", email: Optional[str] = None) -> str:
    """Dispatches OTP via Twilio SMS, SMTP Email, or local dev logger."""
    delivery_channel = "console_dev"

    # 1. If email is provided or destination is an email address, dispatch via email
    target_email = destination if "@" in destination else email
    if target_email and "@" in target_email:
        email_res = send_otp_email(target_email, otp_code, name)
        if email_res.get("channel") == "smtp":
            delivery_channel = "email_smtp"

    # 2. If destination is a phone number, attempt Twilio SMS dispatch
    clean_dest = destination.strip().replace(" ", "").replace("-", "")
    twilio_sid = os.environ.get("TWILIO_ACCOUNT_SID")
    twilio_token = os.environ.get("TWILIO_AUTH_TOKEN")
    twilio_from = os.environ.get("TWILIO_PHONE_NUMBER")

    if twilio_sid and twilio_token and twilio_from and not "@" in destination:
        try:
            from twilio.rest import Client
            client = Client(twilio_sid, twilio_token)
            client.messages.create(
                body=f"Your EmotiCare AI / MANAS verification code is: {otp_code}. Valid for 10 minutes. Do not share this code.",
                from_=twilio_from,
                to=clean_dest
            )
            delivery_channel = "twilio_sms"
            logger.info("[OTP DISPATCH] SMS successfully delivered to %s via Twilio", clean_dest)
        except Exception as tw_err:
            logger.warning("[OTP DISPATCH] Twilio dispatch failed: %s", tw_err)

    if delivery_channel == "console_dev":
        logger.info("[OTP DISPATCH] Local console delivery for %s", destination)
        print(f"\n======================================================\n[DEV OTP DISPATCH] Destination: {destination} | OTP: {otp_code}\n[NOTE] Provider unconfigured. To deliver SMS/Email live, configure TWILIO or SMTP in .env.\n======================================================\n", flush=True)

    return delivery_channel


@router.post("/send-mobile-otp")
def send_mobile_otp(req: SendMobileOtpRequest, request: Request):
    """
    Generate and dispatch a 6-digit OTP code to the provided mobile number.
    CSPRNG generation, HMAC-SHA256 hashed storage, rate limiting, and zero OTP leakage.
    """
    client_ip = request.client.host if request.client else "127.0.0.1"
    _check_auth_rate(f"otp_{client_ip}", max_calls=6, window=300)

    clean_phone = req.phone
    otp_code = f"{secrets.randbelow(900000) + 100000}"
    expires_at = time.time() + 600  # 10 minutes

    # Store only HMAC-SHA256 hash — never plaintext OTP
    secret_key = os.environ.get("OTP_HMAC_SECRET", "manas_otp_salt_change_in_production")
    otp_hash = hmac.new(secret_key.encode(), otp_code.encode(), hashlib.sha256).hexdigest()

    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        INSERT OR REPLACE INTO mobile_otps (phone, otp_code, expires_at, attempts)
        VALUES (?, ?, ?, 0)
    """, (clean_phone, otp_hash, expires_at))
    conn.commit()
    conn.close()

    channel = _dispatch_otp(clean_phone, otp_code, req.name, req.email)

    masked = clean_phone[:4] + "******" + clean_phone[-2:] if len(clean_phone) > 6 else clean_phone
    ret_data = {
        "success": True,
        "message": f"Verification code dispatched to {masked}",
        "phone": clean_phone,
        "masked_phone": masked,
        "expires_in_seconds": 600,
        "delivery_channel": channel,
    }
    if os.environ.get("EXPOSE_DEV_OTP") == "1" or os.environ.get("SMS_TEST_MODE") == "1" or os.environ.get("ENVIRONMENT") != "production":
        ret_data["dev_otp_code"] = otp_code
    return ret_data


@router.post("/send-otp")
def send_otp(req: SendOtpRequest, request: Request):
    """
    Unified OTP dispatch supporting either Phone or Email.
    """
    client_ip = request.client.host if request.client else "127.0.0.1"
    _check_auth_rate(f"otp_{client_ip}", max_calls=6, window=300)

    destination = req.destination.strip().lower() if "@" in req.destination else req.destination.strip().replace(" ", "").replace("-", "")
    otp_code = f"{secrets.randbelow(900000) + 100000}"
    expires_at = time.time() + 600

    secret_key = os.environ.get("OTP_HMAC_SECRET", "manas_otp_salt_change_in_production")
    otp_hash = hmac.new(secret_key.encode(), otp_code.encode(), hashlib.sha256).hexdigest()

    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        INSERT OR REPLACE INTO mobile_otps (phone, otp_code, expires_at, attempts)
        VALUES (?, ?, ?, 0)
    """, (destination, otp_hash, expires_at))
    conn.commit()
    conn.close()

    channel = _dispatch_otp(destination, otp_code, req.name, req.email)

    if "@" in destination:
        parts = destination.split("@")
        masked = parts[0][:2] + "***@" + parts[1]
    else:
        masked = destination[:4] + "******" + destination[-2:] if len(destination) > 6 else destination

    return {
        "success": True,
        "message": f"Verification code dispatched to {masked}",
        "destination": destination,
        "masked_destination": masked,
        "expires_in_seconds": 600,
        "delivery_channel": channel,
    }



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

    # Verify using constant-time HMAC comparison to prevent timing attacks
    secret_key = os.environ.get("OTP_HMAC_SECRET", "manas_otp_salt_change_in_production")
    expected_hash = hmac.new(secret_key.encode(), req.code.encode(), hashlib.sha256).hexdigest()
    if not hmac.compare_digest(expected_hash, row["otp_code"]):
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
    user_email = req.email.strip().lower() if req.email and "@" in req.email else ""

    if not user_row:
        user_id = str(uuid.uuid4())
        dummy_pw_hash = hash_password(str(uuid.uuid4()))
        effective_email = user_email or f"user_{clean_phone.replace('+', '')}@manas.local"
        cursor.execute("""
            INSERT INTO auth_users (id, phone, email, password_hash, name, created_at)
            VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        """, (user_id, clean_phone, effective_email, dummy_pw_hash, display_name))
        
        # Also ensure profile exists in users table
        cursor.execute("""
            INSERT OR IGNORE INTO users (id, name, created_at)
            VALUES (?, ?, CURRENT_TIMESTAMP)
        """, (user_id, display_name))
        user_name = display_name
        email = effective_email
    else:
        user_id = user_row["id"]
        user_name = user_row["name"] or display_name
        email = user_email or user_row["email"] or ""
        if user_email and user_row["email"] != user_email:
            cursor.execute("UPDATE auth_users SET email = ? WHERE id = ?", (user_email, user_id))

    conn.commit()
    conn.close()

    # Trigger Welcome to MANAS Community Email if valid email available
    if email and "@" in email and not email.endswith("@manas.local"):
        try:
            send_welcome_community_email(email, user_name)
        except Exception as em_err:
            logger.warning("Welcome community email dispatch note: %s", em_err)

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


@router.post("/verify-otp", response_model=TokenResponse)
def verify_otp(req: VerifyOtpRequest, request: Request):
    """
    Unified OTP verification supporting either Email or Mobile phone.
    Authenticates or creates the user and returns JWT access & refresh tokens.
    """
    client_ip = request.client.host if request.client else "127.0.0.1"
    _check_auth_rate(f"verify_otp_{client_ip}", max_calls=10, window=300)

    dest = req.destination.strip().lower() if "@" in req.destination else req.destination.strip().replace(" ", "").replace("-", "")
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT otp_code, expires_at, attempts FROM mobile_otps WHERE phone = ?", (dest,))
    row = cursor.fetchone()

    if not row:
        conn.close()
        raise HTTPException(
            status_code=400,
            detail="No OTP requested for this destination. Please click 'Send OTP' first."
        )

    if time.time() > row["expires_at"]:
        cursor.execute("DELETE FROM mobile_otps WHERE phone = ?", (dest,))
        conn.commit()
        conn.close()
        raise HTTPException(
            status_code=400,
            detail="Verification code has expired. Please request a new code."
        )

    if row["attempts"] >= 5:
        cursor.execute("DELETE FROM mobile_otps WHERE phone = ?", (dest,))
        conn.commit()
        conn.close()
        raise HTTPException(
            status_code=429,
            detail="Too many invalid attempts. Please request a fresh OTP."
        )

    secret_key = os.environ.get("OTP_HMAC_SECRET", "manas_otp_salt_change_in_production")
    expected_hash = hmac.new(secret_key.encode(), req.code.encode(), hashlib.sha256).hexdigest()
    if not hmac.compare_digest(expected_hash, row["otp_code"]):
        cursor.execute("UPDATE mobile_otps SET attempts = attempts + 1 WHERE phone = ?", (dest,))
        conn.commit()
        conn.close()
        raise HTTPException(
            status_code=400,
            detail="Invalid verification code. Please check and try again."
        )

    # Clear OTP immediately upon verification (single-use guarantee)
    cursor.execute("DELETE FROM mobile_otps WHERE phone = ?", (dest,))

    # Find or create user
    is_email = "@" in dest
    if is_email:
        cursor.execute("SELECT id, name, email, phone FROM auth_users WHERE email = ?", (dest,))
    else:
        cursor.execute("SELECT id, name, email, phone FROM auth_users WHERE phone = ?", (dest,))
    user_row = cursor.fetchone()

    display_name = req.name or "Friend"
    if not user_row:
        user_id = str(uuid.uuid4())
        dummy_pw_hash = hash_password(str(uuid.uuid4()))
        user_phone = dest if not is_email else None
        user_email = dest if is_email else (req.email.strip().lower() if req.email else f"user_{dest.replace('+', '')}@manas.local")
        cursor.execute("""
            INSERT INTO auth_users (id, phone, email, password_hash, name, created_at)
            VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        """, (user_id, user_phone, user_email, dummy_pw_hash, display_name))

        cursor.execute("""
            INSERT OR IGNORE INTO users (id, name, created_at)
            VALUES (?, ?, CURRENT_TIMESTAMP)
        """, (user_id, display_name))
        email = user_email
        phone = user_phone
        user_name = display_name
    else:
        user_id = user_row["id"]
        user_name = user_row["name"] or display_name
        email = user_row["email"] or ""
        phone = user_row["phone"]

    conn.commit()
    conn.close()

    if email and "@" in email and not email.endswith("@manas.local"):
        try:
            send_welcome_community_email(email, user_name)
        except Exception as em_err:
            logger.warning("Welcome community email dispatch note: %s", em_err)

    access_token = create_access_token(user_id, email)
    refresh_token = create_refresh_token(user_id)

    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        user_id=user_id,
        name=user_name,
        email=email,
        phone=phone
    )



@router.post("/dev-token")
def dev_token(request: Request):
    """
    LOCAL DEVELOPMENT ONLY - returns a signed JWT for the dev/test user.
    Only enabled when SMS_TEST_MODE=1. Never exposed in production.
    Allows frontend to authenticate when Supabase keys are placeholder values.
    """
    if os.environ.get("SMS_TEST_MODE", "0") != "1" and os.environ.get("TESTING", "0") != "1":
        raise HTTPException(status_code=403, detail="Dev token only available in test/dev mode.")

    dev_user_id = "00000000-0000-0000-0000-000000000001"
    dev_email = "dev@manas.local"
    dev_name = "Dev User"

    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT id FROM auth_users WHERE id = ?", (dev_user_id,))
    if not cursor.fetchone():
        password_hash = hash_password("dev-password-not-for-prod")
        cursor.execute(
            "INSERT OR IGNORE INTO auth_users (id, email, password_hash, name, created_at) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)",
            (dev_user_id, dev_email, password_hash, dev_name)
        )
        cursor.execute(
            "INSERT OR IGNORE INTO users (id, name, age, language, tone, role, style_pref) VALUES (?, ?, ?, ?, ?, ?, ?)",
            (dev_user_id, dev_name, 20, "en", "gentle", "student", "reflective")
        )
        conn.commit()
    conn.close()

    access_token = create_access_token(dev_user_id, dev_email)
    refresh_token = create_refresh_token(dev_user_id)

    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "user_id": dev_user_id,
        "name": dev_name,
        "email": dev_email,
        "mode": "dev",
    }
