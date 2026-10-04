"""
auth/jwt_handler.py - JWT token creation, validation and refresh.
Uses PyJWT with HMAC-SHA256. Secret from JWT_SECRET env var.
"""
import os
import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional

import jwt

_SECRET = os.environ.get("JWT_SECRET", "dev-jwt-secret-manas-mindful-wellness-token-key-2026")
_ALGORITHM = "HS256"
_ACCESS_EXPIRE_MINUTES = int(os.environ.get("JWT_ACCESS_EXPIRE_MINUTES", "60"))
_REFRESH_EXPIRE_DAYS = int(os.environ.get("JWT_REFRESH_EXPIRE_DAYS", "30"))


def _get_secret() -> str:
    return _SECRET


def create_access_token(user_id: str, email: str) -> str:
    """Create a short-lived access JWT."""
    now = datetime.now(tz=timezone.utc)
    payload = {
        "sub": user_id,
        "email": email,
        "iat": now,
        "exp": now + timedelta(minutes=_ACCESS_EXPIRE_MINUTES),
        "type": "access",
        "jti": str(uuid.uuid4()),
    }
    return jwt.encode(payload, _get_secret(), algorithm=_ALGORITHM)


def create_refresh_token(user_id: str) -> str:
    """Create a long-lived refresh JWT."""
    now = datetime.now(tz=timezone.utc)
    payload = {
        "sub": user_id,
        "iat": now,
        "exp": now + timedelta(days=_REFRESH_EXPIRE_DAYS),
        "type": "refresh",
        "jti": str(uuid.uuid4()),
    }
    return jwt.encode(payload, _get_secret(), algorithm=_ALGORITHM)


def decode_token(token: str) -> Optional[dict]:
    """Decode and validate a JWT. Returns payload or None."""
    try:
        payload = jwt.decode(token, _get_secret(), algorithms=[_ALGORITHM])
        return payload
    except Exception:
        return None


def get_user_id_from_token(token: str) -> Optional[str]:
    """Extract user_id from a valid access token."""
    payload = decode_token(token)
    if payload and payload.get("type") == "access":
        return payload.get("sub")
    return None

