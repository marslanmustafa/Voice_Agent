"""
VoiceAgent — Vapi Service
Thin async client for Vapi REST API.
Uses centralized vapi_client for all HTTP calls.
"""

import logging

from app.core.config import settings
from app.utils.vapi_client import vapi_get, vapi_post, vapi_patch

logger = logging.getLogger(__name__)

VAPI_BASE = "https://api.vapi.ai"


async def get_assistant(assistant_id: str) -> dict:
    return await vapi_get(f"/assistant/{assistant_id}")


async def create_outbound_call(
    assistant_id: str,
    customer_number: str,
    phone_number_id: str | None = None,
    first_message: str | None = None,
    system_prompt: str | None = None,
) -> dict:
    """
    Create an outbound call via Vapi.

    NOTE: recordingEnabled, artifactPlan, monitorPlan are NOT valid at the
    top-level /call payload — they belong inside assistantOverrides or the
    assistant definition itself. Putting them top-level causes a 400.
    """
    payload: dict = {
        "assistantId": assistant_id,
        "customer": {"number": customer_number},
    }

    # Phone number routing
    if phone_number_id:
        payload["phoneNumberId"] = phone_number_id
    elif settings.TWILIO_PHONE_NUMBER and settings.TWILIO_ACCOUNT_SID and settings.TWILIO_AUTH_TOKEN:
        payload["phoneNumber"] = {
            "twilioPhoneNumber": settings.TWILIO_PHONE_NUMBER,
            "twilioAccountSid": settings.TWILIO_ACCOUNT_SID,
            "twilioAuthToken": settings.TWILIO_AUTH_TOKEN,
        }

    # Build assistantOverrides — ONLY behavioral config lives here
    overrides: dict = {}

    # Recording + monitoring belong in assistantOverrides, not top-level
    overrides["artifactPlan"] = {"recordingEnabled": True, "videoRecordingEnabled": False}
    overrides["monitorPlan"] = {"listenEnabled": True, "controlEnabled": True}

    if first_message:
        overrides["firstMessage"] = first_message

    if system_prompt:
        try:
            assistant_data = await get_assistant(assistant_id)
            assistant_model = assistant_data.get("model", {})
            # Replace system message only, preserve rest of model config
            existing_messages = assistant_model.get("messages", [])
            non_system = [m for m in existing_messages if m.get("role") != "system"]
            assistant_model["messages"] = [
                {"role": "system", "content": system_prompt},
                *non_system,
            ]
            overrides["model"] = assistant_model
        except Exception as e:
            logger.warning(f"[VAPI] Failed to fetch assistant for override: {e}")
            overrides["model"] = {
                "provider": "openai",
                "model": "gpt-4o",
                "messages": [{"role": "system", "content": system_prompt}],
            }

    payload["assistantOverrides"] = overrides

    resp = await vapi_post("/call", json=payload)
    logger.info(f"[VAPI] Call created: {resp.get('id')} → status={resp.get('status')}")
    return resp


async def end_call(vapi_call_id: str) -> dict:
    return await vapi_post(f"/call/{vapi_call_id}/end")


async def get_call(vapi_call_id: str) -> dict:
    return await vapi_get(f"/call/{vapi_call_id}")


async def list_calls(assistant_id: str, limit: int = 50) -> list[dict]:
    data = await vapi_get("/call", params={"assistantId": assistant_id, "limit": limit})
    if isinstance(data, list):
        return data
    elif isinstance(data, dict) and "results" in data:
        return data["results"]
    return []


async def get_call_transcript(vapi_call_id: str) -> list[dict]:
    try:
        call_data = await get_call(vapi_call_id)
        # Vapi embeds transcript inside the call object as `artifact.transcript`
        artifact = call_data.get("artifact", {})
        if artifact and artifact.get("transcript"):
            return artifact["transcript"]
        # Fallback: top-level messages array
        return call_data.get("messages", [])
    except Exception:
        return []


async def create_campaign(payload: dict) -> dict:
    logger.info(f"[VAPI] Creating campaign: {payload}")
    resp = await vapi_post("/campaign", json=payload)
    logger.info(f"[VAPI] Campaign created: {resp.get('id')}")
    return resp


async def add_campaign_contacts(vapi_campaign_id: str, contacts: list[dict]) -> dict:
    return await vapi_post(f"/campaign/{vapi_campaign_id}/contacts", json=contacts)


async def start_campaign(vapi_campaign_id: str) -> dict:
    return await vapi_post(f"/campaign/{vapi_campaign_id}/start")


async def stop_campaign(vapi_campaign_id: str) -> dict:
    return await vapi_post(f"/campaign/{vapi_campaign_id}/stop")


async def get_campaign(vapi_campaign_id: str) -> dict:
    return await vapi_get(f"/campaign/{vapi_campaign_id}")


async def update_campaign(vapi_campaign_id: str, payload: dict) -> dict:
    return await vapi_patch(f"/campaign/{vapi_campaign_id}", json=payload)


async def list_campaigns() -> list[dict]:
    return await vapi_get("/campaign")


async def list_phone_numbers() -> list[dict]:
    return await vapi_get("/phone-number")