import uuid

from fastapi import Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.security import decode_token
from app.db.database import get_db
from app.db.models import User


async def get_user_from_token(token: str, db: AsyncSession) -> User | None:
    try:
        user_id = decode_token(token)

        uid = uuid.UUID(user_id)
    except (JWTError, ValueError):
        return None

    user = await db.scalar(select(User).where(User.id == uid))
    return user


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(HTTPBearer()),
    db: AsyncSession = Depends(get_db),
) -> User:
    user = await get_user_from_token(credentials.credentials, db)

    if not user:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    return user