"""
VoiceAgent — Users Router
GET  /users/me
GET  /users/config
PUT  /users/config
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_user
from app.db.database import get_db
from app.db.models import User, UserConfig
from app.schemas.users import UserConfigResponse, UserConfigUpdate, UserMeResponse

router = APIRouter(prefix="/users", tags=["users"])


def _config_to_response(config: UserConfig) -> UserConfigResponse:
    return UserConfigResponse(
        id=str(config.id),
        max_call_duration=config.max_call_duration,
        retry_count=config.retry_count,
        vapi_assistant_id=config.vapi_assistant_id,
        updated_at=config.updated_at.isoformat() if config.updated_at else None,
    )


@router.get("/me", response_model=UserMeResponse)
async def get_me(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    config = await db.scalar(select(UserConfig).where(UserConfig.user_id == user.id))
    return UserMeResponse(
        id=str(user.id),
        email=user.email,
        name=user.name,
        provider=user.provider,
        avatar_url=user.avatar_url,
        is_onboarded=config is not None and config.vapi_assistant_id is not None,
    )


@router.get("/config", response_model=UserConfigResponse)
async def get_config(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    config = await db.scalar(select(UserConfig).where(UserConfig.user_id == user.id))
    if not config:
        raise HTTPException(status_code=404, detail="Config not found")
    return _config_to_response(config)


@router.put("/config", response_model=UserConfigResponse)
async def update_config(
    body: UserConfigUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    config = await db.scalar(select(UserConfig).where(UserConfig.user_id == user.id))
    if not config:
        config = UserConfig(user_id=user.id)
        db.add(config)

    for key, value in body.model_dump(exclude_unset=True).items():
        setattr(config, key, value)

    await db.commit()
    await db.refresh(config)
    return _config_to_response(config)
