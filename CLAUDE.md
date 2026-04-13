# VoiceAgent — CLAUDE.md

Project context for Claude Code. Read this before making changes.

## Architecture at a Glance

```
voice-agent/
├── api.py                   # FastAPI entry point
├── app/
│   ├── core/                # config.py · security.py · dependencies.py
│   ├── db/                  # database.py · models.py
│   ├── routers/             # auth · users · contacts · campaigns · calls · webhook
│   ├── schemas/             # Pydantic I/O schemas per domain
│   ├── services/            # vapi_service · ws_manager · call_scheduler
│   └── workers/             # rq_worker.py
└── frontend/
    └── src/
        ├── app/             # Next.js App Router pages
        ├── components/      # shared/ UI components
        ├── hooks/           # useLiveTranscript · useCallTimer
        ├── lib/             # utils · auth
        ├── store/           # Redux store · RTK Query slices
        └── types/           # Shared TypeScript interfaces
```

## Backend Rules

- All env vars come from `app/core/config.py` (Settings via pydantic-settings). Never use `os.getenv()` directly in routers.
- Auth guard: always `user: User = Depends(get_current_user)` from `app/core/dependencies`.
- Business logic lives in `app/services/`, not in routers.
- Schemas live in `app/schemas/` — never define Pydantic models inside router files.
- DB queries use async SQLAlchemy: `await db.scalar(...)` not `await db.execute(...).scalar_one_or_none()`.
- Start server: `uvicorn api:app --reload --port 8000`
- Start worker: `python -m app.workers.rq_worker`

## Frontend Rules

- Tailwind v4 — design tokens defined in `globals.css` via `@theme {}`. No `tailwind.config.js`.
- CSS custom properties follow the pattern `var(--color-cyan)`, `var(--color-bg2)`, etc.
- All API calls go through RTK Query slices in `src/store/api/allApis.ts` — never use raw `fetch()` in pages.
- Auth token is stored in Redux (`state.auth.accessToken`) and automatically applied by `baseApi.ts`.
- `<style jsx>` blocks are banned — use Tailwind utilities or inline `style={}` with CSS variables.
- Start dev: `cd frontend && npm run dev`

## Environment Setup

```bash
# Backend
cp .env.example .env          # fill in your keys
pip install -e .              # or: uv sync
uvicorn api:app --reload

# Frontend
cd frontend
cp .env.local.example .env.local   # fill in your keys
npm install
npm run dev
```

## Key Bug Fixes Applied (from original codebase)

| File | Bug | Fix |
|---|---|---|
| `routers/calls.py` | `NameError: c is not defined` in `get_call()` | Variable consistently named `call` |
| `services/call_scheduler.py` | Missing `from sqlalchemy import select` | Added import |
| `services/call_scheduler.py` | `_get_session()` returned closed session | Uses `async with async_session_maker()` inline |
| `services/call_scheduler.py` | Hardcoded `phone_from="+12345678901"` | Uses `settings.TWILIO_PHONE_NUMBER` |
| `workers/rq_worker.py` | Deprecated `Connection.from_url()` | Passes `Queue` objects with `connection=` arg |
| `routers/campaigns.py` | N+1 DB queries for counts | Single aggregate subquery per campaign |
| `store/api/baseApi.ts` | Async `getSession()` on every request | Reads token synchronously from Redux store |
| `app/(dashboard)/settings/page.tsx` | Hardcoded defaults, never fetched API | Uses `useGetConfigQuery()` with `useEffect` to populate form |
| `lib/auth.ts` | Google OAuth exchanges at missing backend route | Try/catch so it degrades gracefully |

## Adding a New Domain (e.g. "Products")

**Backend:**
1. `app/db/models.py` — add `Product` SQLAlchemy model
2. `app/schemas/products.py` — `ProductCreate`, `ProductResponse`, etc.
3. `app/routers/products.py` — thin route handlers using `Depends(get_current_user)`
4. `app/routers/__init__.py` — export `products_router`
5. `api.py` — `app.include_router(products_router)`

**Frontend:**
1. `src/types/index.ts` — add `Product` interface
2. `src/store/api/allApis.ts` — inject endpoints to `baseApi`
3. `src/app/(dashboard)/products/page.tsx` — page component
4. `src/app/(dashboard)/layout.tsx` — add nav item
