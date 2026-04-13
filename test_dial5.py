import asyncio
from app.db.database import async_session_maker
from app.db.models import User, UserConfig
import httpx
from app.core.config import settings
from sqlalchemy import select
from app.services import vapi_service

async def run():
    async with async_session_maker() as db:
        user = await db.scalar(select(User))
        user_config = await db.scalar(select(UserConfig).where(UserConfig.user_id == user.id))
        
        assistant_data = await vapi_service.get_assistant(user_config.vapi_assistant_id)
        
        # We will PATCH the Assistant directly so that ALL calls and campaigns natively record!
        headers = {"Authorization": f"Bearer {settings.VAPI_API_KEY}"}
        async with httpx.AsyncClient() as client:
            resp = await client.patch(f"https://api.vapi.ai/assistant/{user_config.vapi_assistant_id}", 
                                      json={"recordingEnabled": True}, 
                                      headers=headers)
            print("Patch Assistant:", resp.status_code, resp.text)
            
            # Let's also check if artifactPlan needs it
            resp_plan = await client.patch(f"https://api.vapi.ai/assistant/{user_config.vapi_assistant_id}", 
                                      json={"artifactPlan": {"recordingEnabled": True}}, 
                                      headers=headers)
            print("Patch Assistant Artifact Plan:", resp_plan.status_code, resp_plan.text)

asyncio.run(run())
