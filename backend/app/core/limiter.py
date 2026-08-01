from fastapi import Request
from slowapi import Limiter
from slowapi.util import get_remote_address

from app.core.security import decode_access_token

limiter = Limiter(key_func=get_remote_address, default_limits=["60/minute"])


def rate_limit_key_for_user(request: Request) -> str:
    """Key by the authenticated user instead of IP, so a stolen token can't get a
    fresh rate-limit budget just by calling from a different address. Falls back to
    IP for missing/invalid tokens - those requests will 401 right after anyway."""
    auth_header = request.headers.get("Authorization", "")
    scheme, _, token = auth_header.partition(" ")
    if scheme.lower() == "bearer" and token:
        user_id = decode_access_token(token)
        if user_id is not None:
            return f"user:{user_id}"
    return get_remote_address(request)
