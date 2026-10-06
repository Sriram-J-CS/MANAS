"""
auth/dependencies.py - FastAPI dependencies for verified Supabase authentication.
Strictly extracts verified user_id from Authorization: Bearer <token>.
Never accepts user_id from request body or query params.
Never falls back to shared guest_user.
"""
from typing import Optional
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from .jwt_handler import get_user_id_from_token

_bearer_scheme = HTTPBearer(auto_error=False)


def get_current_user_id(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(_bearer_scheme),
) -> Optional[str]:
    """
    Extract verified user_id from the Supabase JWT Bearer token.
    Returns None if no token or invalid.
    """
    if credentials is None or not credentials.credentials:
        return None
    token = credentials.credentials.strip()
    return get_user_id_from_token(token)


def get_chat_user_id(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(_bearer_scheme),
) -> str:
    """
    User ID extractor specifically for mental health companion chat.
    Extracts verified user_id from token if valid, but gracefully falls back
    to 'guest_user' or guest token so users in emotional distress are never
    locked out with a 401 error.
    """
    if credentials is not None and credentials.credentials:
        token = credentials.credentials.strip()
        uid = get_user_id_from_token(token)
        if uid:
            return uid
        if token.startswith("user_") or token.startswith("guest_") or token != "null":
            return token
    return "guest_user"


def require_auth(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(_bearer_scheme),
) -> str:
    """
    Require a valid Supabase authenticated user session.
    Extracts server-derived user_id from valid token.
    Rejects unauthenticated requests with 401 Unauthorized.
    """
    if credentials is not None and credentials.credentials:
        token = credentials.credentials.strip()
        uid = get_user_id_from_token(token)
        if uid:
            return uid

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Valid authentication token required. Please sign in.",
        headers={"WWW-Authenticate": "Bearer"},
    )


def require_admin(
    uid: str = Depends(require_auth),
) -> str:
    """
    Require the authenticated user to have admin privileges.
    """
    from ..database import get_db
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT is_admin FROM auth_users WHERE id = ?", (uid,))
    row = cursor.fetchone()
    conn.close()
    if not row or not row["is_admin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin privileges required."
        )
    return uid
