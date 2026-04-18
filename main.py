from pydantic import BaseModel
from app.utils import vapi_post
from app.services.vapi_service import get_assistant
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

import asyncio
import json
import httpx
import os
import dotenv
import logging

# =========================
# INIT
# =========================

dotenv.load_dotenv()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("vapi")

VAPI_API_KEY = os.getenv("VAPI_API_KEY")
ASSISTANT_ID = os.getenv("VAPI_ASSISTANT_ID")
TWILIO_PHONE_NUMBER = os.getenv("TWILIO_PHONE_NUMBER")
TWILIO_ACCOUNT_SID = os.getenv("TWILIO_ACCOUNT_SID")
TWILIO_AUTH_TOKEN = os.getenv("TWILIO_AUTH_TOKEN")

VAPI_BASE_URL = "https://api.vapi.ai/call"

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# =========================
# SSE PUB/SUB
# =========================

subscribers: dict[str, list[asyncio.Queue]] = {}


def publish(call_id: str, data: dict):
    if not call_id:
        return

    for queue in subscribers.get(call_id, []):
        try:
            queue.put_nowait(json.dumps(data))
        except asyncio.QueueFull:
            pass


def subscribe(call_id: str, queue: asyncio.Queue):
    subscribers.setdefault(call_id, []).append(queue)


def unsubscribe(call_id: str, queue: asyncio.Queue):
    if call_id in subscribers:
        subscribers[call_id].remove(queue)
        if not subscribers[call_id]:
            del subscribers[call_id]


# =========================
# 1. START CALL
# =========================


class CallRequest(BaseModel):
    phone_number: str
    phone_number_id: str | None = None
    first_message: str | None = None
    system_prompt: str | None = None


@app.post("/call/start")
async def create_outbound_call(req: CallRequest) -> dict:
    """
    Create an outbound call via Vapi.

    NOTE: recordingEnabled, artifactPlan, monitorPlan are NOT valid at the
    top-level /call payload — they belong inside assistantOverrides or the
    assistant definition itself. Putting them top-level causes a 400.
    """

    phone_number = req.phone_number
    phone_number_id = req.phone_number_id
    first_message = req.first_message
    system_prompt = req.system_prompt

    payload: dict = {
        "assistantId": ASSISTANT_ID,
        "customer": {"number": phone_number},
    }

    # Phone number routing
    if phone_number_id:
        payload["phoneNumberId"] = phone_number_id
    elif TWILIO_PHONE_NUMBER and TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN:
        payload["phoneNumber"] = {
            "twilioPhoneNumber": TWILIO_PHONE_NUMBER,
            "twilioAccountSid": TWILIO_ACCOUNT_SID,
            "twilioAuthToken": TWILIO_AUTH_TOKEN,
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
            assistant_data = await get_assistant(ASSISTANT_ID)
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



# =========================
# 2. VAPI WEBHOOK
# =========================

@app.post("/vapi/webhook")
async def vapi_webhook(request: Request):
    event = await request.json()
    message = event.get("message", {})
    event_type = message.get("type")

    call_id = (
        event.get("callId")
        or event.get("call_id")
        or message.get("call", {}).get("id")
        or event.get("call", {}).get("id")
    )

    payload = {
    "type": event_type,
    "call_id": call_id,
    "text": (
        message.get("text")
        or message.get("transcript")
        or message.get("speech")
        or message.get("artifact", {}).get("messages", [{}])[-1].get("message")
    )
}

    print("📩 EVENT:", json.dumps(payload, indent=2))

    if call_id:
        publish(call_id, payload)

    return {"ok": True}
# =========================
# 3. SSE STREAM
# =========================

@app.get("/stream/{call_id}")
async def stream(call_id: str):
    queue = asyncio.Queue(maxsize=200)
    subscribe(call_id, queue)

    async def event_generator():
        yield f"data: {json.dumps({'type': 'connected'})}\n\n"

        try:
            while True:
                msg = await queue.get()
                yield f"data: {msg}\n\n"
        finally:
            unsubscribe(call_id, queue)

    return StreamingResponse(event_generator(), media_type="text/event-stream")

@app.get("/debug/stream/{call_id}")
async def debug_stream(call_id: str):
    queue = asyncio.Queue(maxsize=500)
    subscribe(call_id, queue)

    async def printer():
        print(f"\n🟢 DEBUG STREAM STARTED FOR CALL: {call_id}\n")

        try:
            while True:
                msg = await queue.get()
                data = json.loads(msg)

                print("\n================ VAPI EVENT ================")
                print(json.dumps(data, indent=2))
                print("===========================================\n")

        finally:
            unsubscribe(call_id, queue)

    return StreamingResponse(printer(), media_type="text/event-stream")