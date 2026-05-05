from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.redis_client import redis_client
from app.core.security import decode_token
from app.db.session import get_db_session
from app.models.entities import User


bearer_scheme = HTTPBearer(auto_error=True)


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: AsyncSession = Depends(get_db_session),
) -> User:
    token = credentials.credentials
    try:
        payload = decode_token(token)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token") from exc

    if payload.get("type") != "access" or not payload.get("sub"):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token type")

    user_id = payload["sub"]
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    return user


async def auth_rate_limit(request: Request) -> None:
    ip = request.client.host if request.client else "unknown"
    route = request.url.path
    key = f"rate_limit:auth:{route}:{ip}"

    current = await redis_client.incr(key)
    if current == 1:
        await redis_client.expire(key, 60)

    if current > 5:
        raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail="Too many requests")


async def require_admin(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")
    return current_user


async def require_admin_or_bootstrap(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> User:
    if current_user.role == "admin":
        return current_user

    admins_count_result = await db.execute(select(func.count(User.id)).where(User.role == "admin"))
    admins_count = admins_count_result.scalar_one()

    if admins_count == 0:
        current_user.role = "admin"
        await db.commit()
        await db.refresh(current_user)
        return current_user

    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")
