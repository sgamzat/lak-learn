from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import auth_rate_limit
from app.core.config import settings
from app.core.redis_client import redis_client
from app.core.security import create_access_token, create_refresh_token, decode_token, hash_password, verify_password
from app.db.session import get_db_session
from app.models.entities import User
from app.schemas.auth import LoginRequest, RefreshRequest, RegisterRequest, TokenPairResponse, TokenResponse


router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=TokenPairResponse, dependencies=[Depends(auth_rate_limit)])
async def register(payload: RegisterRequest, db: AsyncSession = Depends(get_db_session)) -> TokenPairResponse:
    existing = await db.execute(select(User).where(User.email == payload.email))
    if existing.scalar_one_or_none() is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already exists")

    user = User(email=payload.email, password_hash=hash_password(payload.password))
    db.add(user)
    await db.commit()
    await db.refresh(user)

    token = create_access_token(str(user.id))
    refresh_token = create_refresh_token(str(user.id))
    return TokenPairResponse(token=token, refresh_token=refresh_token)


@router.post("/login", response_model=TokenPairResponse, dependencies=[Depends(auth_rate_limit)])
async def login(payload: LoginRequest, db: AsyncSession = Depends(get_db_session)) -> TokenPairResponse:
    result = await db.execute(select(User).where(User.email == payload.email))
    user = result.scalar_one_or_none()
    if user is None or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    token = create_access_token(str(user.id))
    refresh_token = create_refresh_token(str(user.id))
    return TokenPairResponse(token=token, refresh_token=refresh_token)


@router.post("/refresh", response_model=TokenResponse, dependencies=[Depends(auth_rate_limit)])
async def refresh(payload: RefreshRequest) -> TokenResponse:
    try:
        token_payload = decode_token(payload.refresh_token)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token") from exc

    if token_payload.get("type") != "refresh":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token type")

    exp_ts = token_payload.get("exp")
    jti = token_payload.get("jti")
    user_id = token_payload.get("sub")
    if not exp_ts or not jti or not user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh payload")

    if datetime.now(timezone.utc).timestamp() >= exp_ts:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Refresh token expired")

    redis_key = f"refresh:used:{jti}"
    already_used = await redis_client.get(redis_key)
    if already_used is not None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Refresh token already used")

    ttl = max(1, int(exp_ts - datetime.now(timezone.utc).timestamp()))
    await redis_client.setex(redis_key, ttl, "1")

    access_token = create_access_token(str(user_id))
    return TokenResponse(token=access_token)

