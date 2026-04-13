# VoiceAgent

AI-powered outbound calling platform built on [Vapi.ai](https://vapi.ai). Create campaigns, manage contacts, launch automated calls, and monitor live transcripts in real-time.

## Stack

| Layer     | Technology                                          |
|-----------|-----------------------------------------------------|
| Backend   | FastAPI · PostgreSQL · Redis (RQ) · SQLAlchemy async |
| Frontend  | Next.js 15 · Tailwind CSS v4 · Redux Toolkit · RTK Query |
| AI Calls  | Vapi.ai (voice AI + outbound telephony)             |
| Auth      | NextAuth.js v5 · JWT · Google OAuth                 |

## Features

- **AI Campaigns** — create outbound calling campaigns, assign contacts, launch and monitor
- **Contact Management** — add individually or bulk-import via CSV
- **Live Transcripts** — real-time WebSocket streaming during calls
- **Call History** — full transcript, summary, and recording per call
- **Agent Config** — customize voice, LLM model, system prompt, first message
- **Test Console** — test your AI agent via WebRTC without making a phone call

## Quick Start

### Prerequisites

- Python 3.13+
- Node.js 20+
- PostgreSQL 16
- Redis 7

### Backend

```bash
# 1. Clone and configure
cp .env.example .env
# Edit .env with your DATABASE_URL, VAPI_API_KEY, JWT_SECRET, etc.

# 2. Install dependencies
pip install -e .
# or with uv:
uv sync

# 3. Start the API (tables auto-created on first run)
uvicorn api:app --reload --port 8000

# 4. Start the RQ worker (for campaign call dispatch)
python -m app.workers.rq_worker
```

### Frontend

```bash
cd frontend

# 1. Configure
cp .env.local.example .env.local
# Edit .env.local with NEXT_PUBLIC_API_URL, VAPI keys, NextAuth config

# 2. Install
npm install

# 3. Run
npm run dev
# → http://localhost:3000
```

## Environment Variables

### Backend (`.env`)

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string (`postgresql+asyncpg://...`) |
| `REDIS_URL` | Redis URL (`redis://localhost:6379`) |
| `JWT_SECRET` | Random secret for JWT signing |
| `VAPI_API_KEY` | Vapi private API key (from Vapi dashboard) |
| `TWILIO_PHONE_NUMBER` | Outbound caller ID |
| `GOOGLE_CLIENT_ID` | Google OAuth (optional) |
| `GOOGLE_CLIENT_SECRET` | Google OAuth (optional) |

### Frontend (`.env.local`)

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_API_URL` | Backend URL (`http://localhost:8000`) |
| `NEXT_PUBLIC_WS_URL` | WebSocket URL (`ws://localhost:8000`) |
| `NEXT_PUBLIC_VAPI_PUBLIC_KEY` | Vapi public key (for browser WebRTC) |
| `NEXT_PUBLIC_VAPI_ASSISTANT_ID` | Your Vapi assistant UUID |
| `NEXTAUTH_SECRET` | Random secret for NextAuth session encryption |
| `NEXTAUTH_URL` | Frontend URL (`http://localhost:3000`) |
| `GOOGLE_CLIENT_ID` | Google OAuth (optional) |
| `GOOGLE_CLIENT_SECRET` | Google OAuth (optional) |

## API Overview

```
POST /auth/email/register     Register new user
POST /auth/email/login        Login, returns JWT
GET  /auth/me                 Current user

GET  /users/config            Get agent config
PUT  /users/config            Update agent config

GET  /contacts                List with pagination + search
POST /contacts                Create contact
POST /contacts/csv/upload     Bulk CSV import

GET  /campaigns               List campaigns
POST /campaigns               Create campaign
POST /campaigns/{id}/launch   Launch → enqueues calls via RQ

GET  /calls                   List calls with filters
GET  /calls/{id}              Detail + transcript

POST /vapi/webhook            Vapi event receiver (call lifecycle)
WS   /ws/{call_id}            Live transcript stream
```

## Project Structure

```
voice-agent/
├── api.py                   FastAPI app entry point
├── pyproject.toml
├── .env.example
├── CLAUDE.md                Claude Code context file
│
├── app/
│   ├── core/
│   │   ├── config.py        Pydantic-settings (single source of truth)
│   │   ├── security.py      JWT + bcrypt helpers
│   │   └── dependencies.py  Shared FastAPI Depends()
│   ├── db/
│   │   ├── database.py      Async engine + session factory
│   │   └── models.py        SQLAlchemy ORM models
│   ├── routers/             Thin HTTP handlers per domain
│   ├── schemas/             Pydantic I/O schemas
│   ├── services/
│   │   ├── vapi_service.py  Vapi REST client
│   │   ├── ws_manager.py    WebSocket connection manager
│   │   └── call_scheduler.py RQ job functions
│   └── workers/
│       └── rq_worker.py     RQ worker entry point
│
└── frontend/
    ├── package.json         Next.js 15 + Tailwind v4
    └── src/
        ├── app/             App Router pages
        ├── components/      Shared React components
        ├── hooks/           useLiveTranscript, useCallTimer
        ├── lib/             utils, NextAuth config
        ├── store/           Redux + RTK Query
        └── types/           TypeScript interfaces
```

## License

MIT
