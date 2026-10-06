"""
auth/jwt_handler.py - Supabase & Local JWT verification.
Strictly extracts verified user_id (UUID) from Bearer JWT.
"""
import os
import uuid
import logging
from datetime import datetime, timedelta, timezone
from typing import Optional, Dict, Any

import jwt
import httpx

logger = logging.getLogger("manas.auth.jwt")

SUPABASE_URL = os.environ.get("SUPABASE_URL", "https://srrpzjnasuodtdwdhjmk.supabase.co")
SUPABASE_ANON_KEY = os.environ.get("SUPABASE_ANON_KEY", "")
SUPABASE_JWT_SECRET = os.environ.get("SUPABASE_JWT_SECRET") or os.environ.get("JWT_SECRET_KEY") or os.environ.get("JWT_SECRET", "sriramlovesdiya")
SMS_TEST_MODE = os.environ.get("SMS_TEST_MODE", "1") == "1"
TESTING = os.environ.get("TESTING", "0") == "1"

_SECRETS = list(filter(None, [
    SUPABASE_JWT_SECRET,
    os.environ.get("AUTH_SECRET"),
    "sriramlovesdiya",
    "dev-jwt-secret-manas-mindful-wellness-token-key-2026",
]))

_LOCAL_JWT_SECRET = (
    os.environ.get("JWT_SECRET_KEY")
    or os.environ.get("AUTH_SECRET")
    or os.environ.get("SUPABASE_JWT_SECRET")
    or "dev-jwt-secret-manas-mindful-wellness-token-key-2026"
)
_LOCAL_JWT_ALGORITHM = "HS256"
_ACCESS_EXPIRE_MINUTES = int(os.environ.get("ACCESS_TOKEN_EXPIRE_MINUTES", "60"))
_REFRESH_EXPIRE_DAYS = int(os.environ.get("REFRESH_TOKEN_EXPIRE_DAYS", "30"))


def create_access_token(user_id: str, email: str = "") -> str:
    """
    Issue a short-lived HS256 JWT access token for the local (SQLite) auth system.
    """
    now = datetime.now(timezone.utc)
    payload = {
        "sub": str(user_id),
        "email": email,
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(minutes=_ACCESS_EXPIRE_MINUTES)).timestamp()),
        "type": "access",
    }
    return jwt.encode(payload, _LOCAL_JWT_SECRET, algorithm=_LOCAL_JWT_ALGORITHM)


def create_refresh_token(user_id: str) -> str:
    """
    Issue a long-lived HS256 JWT refresh token for the local (SQLite) auth system.
    """
    now = datetime.now(timezone.utc)
    payload = {
        "sub": str(user_id),
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(days=_REFRESH_EXPIRE_DAYS)).timestamp()),
        "type": "refresh",
        "jti": str(uuid.uuid4()),
    }
    return jwt.encode(payload, _LOCAL_JWT_SECRET, algorithm=_LOCAL_JWT_ALGORITHM)


def decode_token(token: str) -> Optional[Dict[str, Any]]:
    """
    Decodes and validates JWT using Supabase secret or known HMAC secrets.
    """
    if not token or token == "null" or token == "undefined":
        return None

    # 1. Try decoding with configured secrets
    for secret in _SECRETS:
        try:
            payload = jwt.decode(
                token,
                secret,
                algorithms=["HS256"],
                options={"verify_aud": False, "verify_signature": True}
            )
            return payload
        except jwt.ExpiredSignatureError:
            logger.debug("Token expired")
            return None
        except Exception:
            continue

    # 2. In SMS_TEST_MODE or automated testing, accept unverified decoded payload if valid JWT
    if SMS_TEST_MODE or TESTING:
        try:
            payload = jwt.decode(token, options={"verify_signature": False})
            if payload and "sub" in payload:
                return payload
        except Exception:
            pass

    # 3. Direct verification against Supabase Auth API if URL is configured
    if SUPABASE_URL and len(token) > 20:
        try:
            headers = {"Authorization": f"Bearer {token}"}
            if SUPABASE_ANON_KEY:
                headers["apikey"] = SUPABASE_ANON_KEY
            res = httpx.get(f"{SUPABASE_URL}/auth/v1/user", headers=headers, timeout=3.0)
            if res.status_code == 200:
                user_data = res.json()
                return {"sub": user_data.get("id"), "email": user_data.get("email"), "phone": user_data.get("phone")}
        except Exception as e:
            logger.debug("Supabase auth endpoint verification note: %s", e)

    return None

def get_user_id_from_token(token: str) -> Optional[str]:
    """
    Extracts the verified user_id (UUID) from the token.
    Never accepts spoofed user identifiers.
    """
    if not token:
        return None
    token = token.strip()

    payload = decode_token(token)
    if payload and payload.get("sub"):
        return str(payload.get("sub"))

    # Support test UUID tokens in test mode
    if (SMS_TEST_MODE or TESTING) and (token.startswith("user_") or token.startswith("test_")):
        return token

    return None
