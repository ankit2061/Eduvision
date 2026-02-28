"""
Local JWT verification dependency.
Extracts sub, email, name, and role from our custom JWT tokens.
"""

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from loguru import logger
from app.services.local_auth import decode_token
from app.models.schemas import CurrentUser

_bearer = HTTPBearer()


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(_bearer),
) -> CurrentUser:
    token = credentials.credentials
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    payload = decode_token(token)
    if payload is None:
        raise credentials_exception

    user_id = payload.get("sub")
    email = payload.get("email")
    name = payload.get("name")
    role = payload.get("role", "student")

    if user_id is None:
        raise credentials_exception

    return CurrentUser(user_id=user_id, email=email, name=name, role=role)


def require_role(*roles: str):
    """Dependency factory: only allow specified roles."""
    async def _check(user: CurrentUser = Depends(get_current_user)) -> CurrentUser:
        if user.role not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Role '{user.role}' is not permitted. Required: {list(roles)}",
            )
        return user
    return _check
