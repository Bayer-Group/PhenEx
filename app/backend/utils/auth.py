"""
Authentication utility functions for extracting user information from requests.
"""

from fastapi import HTTPException, Request
from ..domain.user import User


def get_authenticated_user(request: Request) -> User:
    """Helper to extract the authenticated user or raise 401."""
    user: User | None = getattr(request, "user", None)
    if not user or not user.is_authenticated:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return user


def get_authenticated_user_id(request: Request) -> str:
    """Helper to extract the authenticated user's id or raise 401."""
    user = get_authenticated_user(request)
    return str(user.id)
