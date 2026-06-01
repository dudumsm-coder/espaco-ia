import time
import httpx
from jose import jwt, JWTError
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.config import settings
from app.core.database import get_db

bearer_scheme = HTTPBearer()

_jwks_cache: dict = {"keys": [], "fetched_at": 0}
_JWKS_TTL = 3600


async def _get_jwks() -> list:
    now = time.time()
    if _jwks_cache["keys"] and now - _jwks_cache["fetched_at"] < _JWKS_TTL:
        return _jwks_cache["keys"]
    async with httpx.AsyncClient() as client:
        resp = await client.get(settings.CLERK_JWKS_URL)
        resp.raise_for_status()
        data = resp.json()
    _jwks_cache["keys"] = data["keys"]
    _jwks_cache["fetched_at"] = now
    return _jwks_cache["keys"]


async def verify_clerk_token(token: str) -> dict:
    try:
        header = jwt.get_unverified_header(token)
        kid = header.get("kid")
        keys = await _get_jwks()
        key = next((k for k in keys if k["kid"] == kid), None)
        if not key:
            _jwks_cache["fetched_at"] = 0
            keys = await _get_jwks()
            key = next((k for k in keys if k["kid"] == kid), None)
        if not key:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Chave JWT não encontrada")
        payload = jwt.decode(token, key, algorithms=["RS256"], options={"verify_aud": False})
        return payload
    except JWTError as e:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=f"Token inválido: {e}")


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: AsyncSession = Depends(get_db),
):
    payload = await verify_clerk_token(credentials.credentials)
    clerk_id: str = payload.get("sub")
    if not clerk_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token sem subject")

    from app.repositories.user_repo import UserRepository
    user = await UserRepository.get_by_clerk_id(db, clerk_id)
    if not user:
        user = await UserRepository.create_from_clerk(db, clerk_id, settings.CLERK_SECRET_KEY)
    return user


async def get_current_admin(current_user=Depends(get_current_user)):
    if current_user.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Acesso restrito a admins")
    return current_user
