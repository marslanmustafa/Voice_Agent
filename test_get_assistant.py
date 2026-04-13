import asyncio
import httpx
from app.db.database import async_session_maker
from app.db.models import User, UserConfig
from sqlalchemy import select
from app.core.config import settings

async def run():
    async with async_session_maker() as db:
        user = await db.scalar(select(User))
        user_config = await db.scalar(select(UserConfig).where(UserConfig.user_id == user.id))
        
        headers = {"Authorization": f"Bearer {settings.VAPI_API_KEY}"}
        
        async with httpx.AsyncClient() as client:
            resp = await client.get(f"https://api.vapi.ai/assistant/{user_config.vapi_assistant_id}", headers=headers)
            print("Status:", resp.status_code)
            print("Data:", resp.text)

asyncio.run(run())
