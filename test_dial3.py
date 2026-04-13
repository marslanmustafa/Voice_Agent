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
        
        # Test my function explicitly
        payload = {
            "assistantId": user_config.vapi_assistant_id,
            "customer": {"number": "+923074288483"},
        }
        
        # Inject the Twilio Ad-hoc Phone Provider configuration
        payload["phoneNumber"] = {
            "provider": "twilio",
            "number": settings.TWILIO_PHONE_NUMBER,
            "twilioAccountSid": settings.TWILIO_ACCOUNT_SID,
            "twilioAuthToken": settings.TWILIO_AUTH_TOKEN
        }
        
        assistant_data = await vapi_service.get_assistant(user_config.vapi_assistant_id)
        assistant_model = assistant_data.get("model", {})
        assistant_model["messages"] = [{"role": "system", "content": "You are a friendly AI."}]
        
        payload["assistantOverrides"] = {"model": assistant_model}

        headers = {"Authorization": f"Bearer {settings.VAPI_API_KEY}"}
        
        print("Sending to POST /call/phone/outbound...")
        async with httpx.AsyncClient() as client:
            resp = await client.post("https://api.vapi.ai/call/phone/outbound", json=payload, headers=headers)
            print("Status Code:", resp.status_code)
            print("Response:", resp.text)
            
            if resp.status_code == 404:
                print("Trying fallback /call/phone...")
                resp = await client.post("https://api.vapi.ai/call/phone", json=payload, headers=headers)
                print("Status Code:", resp.status_code)
                print("Response:", resp.text)

asyncio.run(run())
