"""
VoiceAgent — FastAPI Application Entry Point
Run: uvicorn api:app --reload --port 8000
"""

from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.db.database import check_db_health
from app.db.models import init_db
from app.routers import (
    calls_router, campaigns_router,
    contacts_router, users_router,
)
from app.routers.webhooks import router as webhooks_router
from app.services.ws_manager import router as ws_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    db_health = await check_db_health()
    if db_health["status"] == "ok":
        print(f"[VoiceAgent] DB connected ({db_health['driver']})")
        try:
            await init_db()
            print("[VoiceAgent] Tables created/verified")
        except Exception as exc:
            print(f"[VoiceAgent] DB init warning: {exc}")
    else:
        print(f"[VoiceAgent] ⚠ DB unavailable: {db_health.get('error')}")
        print("[VoiceAgent]   Set DATABASE_URL in .env and start PostgreSQL")
    yield


app = FastAPI(
    title="VoiceAgent API",
    description="AI Calling Platform — FastAPI Backend",
    version="2.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        settings.FRONTEND_URL,
        "http://localhost:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:3001",
        "https://q641qxfx-3000.inc1.devtunnels.ms",
        "https://voice-agent-fyp.vercel.app",
        "https://voice.marslanmustafa.com"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(users_router)
app.include_router(contacts_router)
app.include_router(campaigns_router)
app.include_router(calls_router)
app.include_router(webhooks_router)
app.include_router(ws_router)


from app.routers.webhooks import vapi_webhook as _vapi_webhook_handler

@app.get("/health")
async def health():
    db = await check_db_health()
    return {"api": "ok", "version": "2.0.0", "database": db}


# ── /vapi/webhook alias ────────────────────────────────────────────────────────
# Vapi is configured to POST to /vapi/webhook (matching main.py).
# This alias forwards to the same handler at /webhooks/vapi.
@app.post("/vapi/webhook")
async def vapi_webhook_alias(request: Request):
    return await _vapi_webhook_handler(request)



if __name__ == "__main__":
    import uvicorn
    uvicorn.run("api:app", host="0.0.0.0", port=8000, reload=True)
