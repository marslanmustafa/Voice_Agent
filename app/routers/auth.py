"""
VoiceAgent — Authentication Router
POST /auth/email/register
POST /auth/email/login
GET  /auth/me
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_user
from app.core.security import create_access_token, hash_password, verify_password
from app.db.database import get_db
from app.db.models import User, UserConfig
from app.schemas.auth import TokenResponse, UserCreate, UserLogin, UserPublic

router = APIRouter(prefix="/auth", tags=["auth"])


def _user_to_dict(user: User) -> dict:
    return {
        "id": str(user.id),
        "email": user.email,
        "name": user.name,
        "provider": user.provider,
        "avatar_url": user.avatar_url,
    }


@router.post("/email/register", response_model=TokenResponse, status_code=201)
async def register(body: UserCreate, db: AsyncSession = Depends(get_db)):
    """Register with email + password. Returns JWT immediately."""
    if len(body.password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")

    existing = await db.scalar(select(User).where(User.email == body.email))
    if existing:
        raise HTTPException(status_code=409, detail="Email already registered")

    user = User(
        email=body.email,
        name=body.name or "",
        provider="email",
        password_hash=hash_password(body.password),
    )
    db.add(user)
    await db.flush()

    db.add(UserConfig(user_id=user.id))
    await db.commit()
    await db.refresh(user)

    return TokenResponse(
        access_token=create_access_token(str(user.id)),
        user=_user_to_dict(user),
    )


@router.post("/email/login", response_model=TokenResponse)
async def login(body: UserLogin, db: AsyncSession = Depends(get_db)):
    """Login with email + password. Returns JWT."""
    user = await db.scalar(select(User).where(User.email == body.email))

    if not user or not user.password_hash or not verify_password(body.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    return TokenResponse(
        access_token=create_access_token(str(user.id)),
        user=_user_to_dict(user),
    )


@router.get("/me", response_model=UserPublic)
async def get_me(user: User = Depends(get_current_user)):
    """Return current authenticated user."""
    return UserPublic(
        id=str(user.id),
        email=user.email,
        name=user.name,
        provider=user.provider,
        avatar_url=user.avatar_url,
    )
