"""
auth/dependencies.py - FastAPI dependency for extracting and validating the
authenticated user from the Authorization: Bearer <token> header.

Usage:
    from app.auth.dependencies import get_current_user_id, require_auth

    @app.get("/api/some/endpoint")
    async def my_endpoint(uid: str = Depends(require_auth)):
        # uid is guaranteed server-derived, validated from JWT
        ...
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
    Extract user_id from the JWT Bearer token.
    Returns None if no token is present or token is invalid.
    Does NOT raise — use require_auth for mandatory auth.
    """
    if credentials is None:
        return None
    return get_user_id_from_token(credentials.credentials)


def require_auth(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(_bearer_scheme),
) -> str:
    """
    Require a valid JWT Bearer token.
    Raises 401 if missing or invalid.
    Returns the server-derived user_id from the token.
    NEVER trust a user_id from the request body or URL parameters.
    """
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required. Please sign in.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    uid = get_user_id_from_token(credentials.credentials)
    if not uid:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token. Please sign in again.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return uid


def require_admin(
    uid: str = Depends(require_auth),
) -> str:
    """
    Require the authenticated user to have admin privileges.
    Checks is_admin flag in auth_users table.
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

