import asyncio
from app.db.database import async_session_maker
from app.db.models import User, UserConfig
import httpx
from app.core.config import settings
from sqlalchemy import select

async def run():
    async with async_session_maker() as db:
        user = await db.scalar(select(User))
        user_config = await db.scalar(select(UserConfig).where(UserConfig.user_id == user.id))
        
        headers = {"Authorization": f"Bearer {settings.VAPI_API_KEY}"}
        
        payload = {
            "assistantId": user_config.vapi_assistant_id,
            "customer": {"number": "+1234567890"}
        }
        async with httpx.AsyncClient() as client:
            resp = await client.post("https://api.vapi.ai/call/phone", json=payload, headers=headers)
            print("Status Code from /call/phone:", resp.status_code)
            print("Response:", resp.text)
            
            payload2 = {
                "assistantId": user_config.vapi_assistant_id,
                "customer": {"number": "+1234567890"}
            }
            resp2 = await client.post("https://api.vapi.ai/call", json=payload2, headers=headers)
            print("Status Code from /call with customer obj:", resp2.status_code)
            print("Response:", resp2.text)

asyncio.run(run())
