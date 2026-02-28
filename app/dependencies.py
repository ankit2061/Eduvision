"""
Auth0 JWT verification dependency.
Extracts sub, email, and custom role claim from the bearer token.
"""

import httpx
from typing import Optional
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt, JWTError, jwk
from jose.utils import base64url_decode
from loguru import logger
from app.config import get_settings
from app.models.schemas import CurrentUser

settings = get_settings()
_bearer = HTTPBearer()

# Cache JWKS in memory (refreshed on decode error)
_jwks_cache: Optional[dict] = None


async def _fetch_jwks() -> dict:
    global _jwks_cache
    if _jwks_cache:
        return _jwks_cache
    url = f"https://{settings.auth0_domain}/.well-known/jwks.json"
    async with httpx.AsyncClient() as client:
        resp = await client.get(url)
        resp.raise_for_status()
        _jwks_cache = resp.json()
        logger.info("[Auth0] JWKS fetched and cached.")
        return _jwks_cache


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(_bearer),
) -> CurrentUser:
    token = credentials.credentials
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    try:
        # Get token header to find kid
        unverified_header = jwt.get_unverified_header(token)
        kid = unverified_header.get("kid")

        jwks = await _fetch_jwks()
        rsa_key = {}
        for key in jwks.get("keys", []):
            if key["kid"] == kid:
                rsa_key = {
                    "kty": key["kty"],
                    "kid": key["kid"],
                    "use": key["use"],
                    "n": key["n"],
                    "e": key["e"],
                }
                break

        if not rsa_key:
            # Try refreshing JWKS cache in case key rotated
            global _jwks_cache
            _jwks_cache = None
            jwks = await _fetch_jwks()
            for key in jwks.get("keys", []):
                if key["kid"] == kid:
                    rsa_key = {"kty": key["kty"], "kid": key["kid"], "use": key["use"], "n": key["n"], "e": key["e"]}
                    break

        if not rsa_key:
            raise credentials_exception

        payload = jwt.decode(
            token,
            rsa_key,
            algorithms=["RS256"],
            audience=settings.auth0_audience,
            issuer=f"https://{settings.auth0_domain}/",
        )

        user_id: str = payload.get("sub")
        email: str = payload.get("email")
        role: str = payload.get(settings.auth0_role_claim, "student")

        if user_id is None:
            raise credentials_exception

        return CurrentUser(user_id=user_id, email=email, role=role)

    except JWTError as e:
        logger.warning(f"[Auth0] JWT error: {e}")
        raise credentials_exception
    except Exception as e:
        logger.error(f"[Auth0] Unexpected auth error: {e}")
        raise credentials_exception


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
