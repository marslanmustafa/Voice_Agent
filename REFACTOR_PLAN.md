# VoiceAgent — Architecture Refactor Plan

# Status: DRAFT

---

## 1. Database Tables: DELETE / KEEP / MODIFY

### DELETE

#### `transcript_segments`

- **Why redundant:** Vapi delivers transcripts via `transcript` webhook events **and** via Vapi REST API (`/calls/{id}/transcripts`)
- **What breaks if deleted:** `GET /calls/{id}` in `routers/calls.py` currently builds the transcript from this table; `CallDetailResponse` schema
- **Fix required:** Change `get_call` to fetch transcript directly from Vapi API (see Backend section)
- **Frontend impact:** `CallDetail.transcript` will be fetched from Vapi after call ends; live transcript already comes via WebSocket broadcast

#### `campaign_contacts` (junction table)

- **Why redundant:** If using Vapi Campaigns API, contacts are managed inside Vapi. Adding them locally **and** in Vapi creates double-maintenance
- **Why keep as DELETE candidate:** Only if we fully delegate campaign contacts to Vapi. Alternative is to keep locally and NOT sync to Vapi (see "Hybrid approach" below)
- **Decision needed:** See §4 (Vapi integration strategy)

---

### MODIFY

#### `campaigns` — Strip to thin reference

**Delete columns (move to Vapi):**

| Column | Reason |
|--------|--------|
| `system_prompt` | Vapi assistant already has this |
| `first_message` | Vapi assistant already has this |
| `voice_id` | Vapi assistant already has this |
| `status` | Vapi is source of truth — poll Vapi or trust webhook |
| `scheduled_at` | Not used by current code; Vapi handles scheduling |
| `max_concurrent` | Vapi campaign handles concurrency |
| `retry_count` | Vapi handles retries |

**Keep columns:**

| Column | Reason |
|--------|--------|
| `id` | Primary key |
| `user_id` | FK to users |
| `name` | User's own campaign label (UI only) |
| `vapi_campaign_id` | **NEW** — link to Vapi campaign |
| `contact_ids` | Store as JSON array (see §4) |
| `created_at` | Audit |

#### `calls` — Reduce to thin local cache

**Delete columns (Vapi is source of truth):**

| Column | Reason |
|--------|--------|
| `status` | Vapi tracks this; webhook updates local copy |
| `duration_secs` | Comes from Vapi webhook/API |
| `recording_url` | Comes from Vapi webhook/API |
| `summary` | Comes from Vapi `end-of-call-report` webhook |

**Keep columns:**

| Column | Reason |
|--------|--------|
| `id` | Primary key (local reference) |
| `user_id` | FK — needed for auth/query scoping |
| `campaign_id` | FK — needed to link call to local campaign |
| `contact_id` | FK — needed to link call to local contact |
| `vapi_call_id` | Link to Vapi call |
| `phone_to` | Useful for local display even if Vapi has it |
| `phone_from` | Useful for local display |
| `started_at` | Cached for fast UI load |
| `ended_at` | Cached for fast UI load |
| `created_at` | Audit |

**Sync strategy:** Webhook updates the local `calls` record for all state changes. Frontend reads local for speed, but local is always eventually consistent with Vapi.

#### `user_configs` — Strip Vapi assistant config out

**Delete columns (move to Vapi Assistant):**

| Column | Reason |
|--------|--------|
| `system_prompt` | Vapi assistant object |
| `agent_name` | Vapi assistant name field |
| `voice_provider` | Vapi assistant voice.provider |
| `voice_id` | Vapi assistant voice.voiceId |
| `llm_provider` | Vapi assistant model.provider |
| `llm_model` | Vapi assistant model.model |
| `first_message` | Vapi assistant model.messages[0].content |

**Keep columns:**

| Column | Reason |
|--------|--------|
| `id` | Primary key |
| `user_id` | FK |
| `vapi_assistant_id` | Links user to their Vapi assistant |
| `max_call_duration` | Local product default (not in Vapi) |
| `retry_count` | Local product default (not in Vapi) |
| `updated_at` | Audit |

> **Note:** Settings page currently uses all these fields. They must be migrated to Vapi's Assistant API or removed from UI. Vapi's test page (`/test`) already uses the Vapi Web SDK which reads from the Vapi assistant directly — no local config needed for the test.

---

### KEEP (as-is)

| Table | Reason |
|-------|--------|
| `users` | Auth, ownership |
| `contacts` | User's contact list — Vapi does NOT have this. Pure business data. |
| `campaign_contacts` | Only if hybrid approach (§4) — otherwise delete |

---

## 2. Backend Refactor Plan

### DELETE: `app/workers/rq_worker.py`

- The entire RQ worker and Redis dependency
- Campaign execution is fully handled by Vapi Campaigns API
- No more `enqueue_campaign()` calls

### DELETE: `app/services/call_scheduler.py`

- `launch_campaign_calls`, `make_single_call`, `_get_session` — all replaced by Vapi Campaigns API
- `enqueue_campaign` — replaced by `POST /vapi/campaigns/{id}/start`
- Remove Redis queue dependency entirely

### MODIFY: `app/services/vapi_service.py`

- Keep only:
  - `create_outbound_call()` — for individual calls outside campaigns (e.g., test call)
  - `end_call()`
  - `get_call()`
- Remove: any campaign creation/management helpers (move to `routers/campaigns.py` as thin Vapi proxy)
- **Add:**
  - `create_campaign(name, assistant_id, phone_number_id)` → Vapi Campaigns API
  - `add_campaign_contacts(campaign_id, contacts[])` → Vapi Campaigns API
  - `start_campaign(campaign_id)` → Vapi Campaigns API
  - `stop_campaign(campaign_id)` → Vapi Campaigns API
  - `get_campaign_stats(campaign_id)` → Vapi Campaigns API
  - `get_call_transcript(call_id)` → Vapi Calls API

### MODIFY: `app/routers/calls.py`

- `GET /calls/{id}`: Fetch from Vapi API, not local DB
  - `vapi_service.get_call(vapi_call_id)` → Vapi
  - `vapi_service.get_call_transcript(vapi_call_id)` → Vapi
  - Merge with local `calls` record for `campaign_id`, `contact_id`
- `GET /calls`: Query Vapi call history API instead of local `calls` table
  - Filter by `campaign_id` locally (thin join)
  - Filter by `status` via Vapi
- `POST /calls/{id}/end`: Already correct — calls Vapi

### MODIFY: `app/routers/campaigns.py`

- `POST /campaigns`: Create in Vapi via `vapi_service.create_campaign()`, save `vapi_campaign_id` locally
- `POST /campaigns/{id}/launch`: Call `vapi_service.start_campaign(vapi_campaign_id)`; update local status
- `POST /campaigns/{id}/cancel`: Call `vapi_service.stop_campaign(vapi_campaign_id)`; update local status
- `GET /campaigns/{id}`: Fetch stats from `vapi_service.get_campaign_stats()`; merge with local record
- Remove `_get_campaign_counts` — replaced by Vapi stats

### MODIFY: `app/routers/webhook.py`

- Remove `transcript_segments` inserts (Vapi is source of truth for transcripts)
- Update `calls` table fields: `status`, `started_at`, `ended_at`, `duration_secs`, `recording_url`, `summary`
- `broadcast()` continues to work for real-time WebSocket updates to frontend

### MODIFY: `app/routers/users.py`

- `GET /config`: Return `vapi_assistant_id`, `max_call_duration`, `retry_count` only
- `PUT /config`: Update same fields only

### DELETE: `app/services/ws_manager.py`? → KEEP

- Still needed for real-time transcript/event broadcast to frontend
- No changes needed

### API Entry Point (`api.py`)

- Remove `rq_worker` import/reference
- Everything else stays

---

## 3. Frontend Simplification Plan

### `calls/page.tsx` — Fetch from Vapi via backend proxy

- **Currently:** `useGetCallsQuery` → `GET /calls` → local `calls` table
- **After:** `GET /calls` → Vapi call history API → returns Vapi data directly
- `CallDetail.transcript` → fetched from Vapi when call selected
- WebSocket live transcript stays (via `useLiveTranscript` hook)
- No other changes needed — same UI structure

### `campaigns/[id]/page.tsx` — Use Vapi campaign stats

- **Currently:** Stats computed from local `calls` table via `_get_campaign_counts`
- **After:** `GET /campaigns/{id}` → fetches stats from Vapi via `vapi_service.get_campaign_stats()`
- Call list: keeps `useGetCallsQuery({ campaign_id })` which now queries Vapi
- Call detail/transcript: fetches from Vapi via `useGetCallQuery`

### `settings/page.tsx` — Simplify to Vapi Assistant ID only

- **Currently:** Full assistant config form (system prompt, voice, model, etc.)
- **After:** Only show `Vapi Assistant ID` field (the link to Vapi assistant)
- All other settings (voice, model, system prompt) are configured in Vapi dashboard
- Instructions: "Configure your AI agent in your Vapi Dashboard, then paste your Assistant ID here"
- Rationale: These settings already live in Vapi — duplicating them creates sync problems

### `onboarding/page.tsx` — Simplify to 1 step

- Step 1: Connect Vapi Assistant (paste Assistant ID)
- Remove steps for voice picker, LLM model, system prompt — those live in Vapi
- Saves `vapi_assistant_id` to `user_configs`

### `campaigns/page.tsx` — Minor: add contact selector

- Already done in current session ✓

### `dashboard/page.tsx` — Minor updates

- Stats for "Active Calls" → query Vapi for active calls count
- Or keep as-is (lightweight, no major change)

### `/test/page.tsx` — Already correct

- Uses Vapi Web SDK directly, no local config needed
- Reads `NEXT_PUBLIC_VAPI_ASSISTANT_ID` from env
- No changes needed

---

## 4. Vapi Integration Strategy

### Two Approaches

#### Approach A: Full Vapi Campaigns (Aggressive)

Use Vapi's native campaign management for contacts and execution.

| Action | How |
|--------|-----|
| Create campaign | `POST /vapi/campaigns` via `vapi_service` |
| Add contacts | `POST /vapi/campaigns/{id}/contacts` via `vapi_service` |
| Launch | `POST /vapi/campaigns/{id}/start` via `vapi_service` |
| Stats | `GET /vapi/campaigns/{id}` via `vapi_service` |
| **DELETE `campaign_contacts`** | Contacts managed in Vapi, not locally |

**Pros:** Vapi handles all execution, no worker infrastructure
**Cons:** User's local contact list is not reflected in Vapi — two contact lists to maintain

#### Approach B: Hybrid (Recommended for MVP)

Keep contacts locally, use Vapi only for execution.

| Action | How |
|--------|-----|
| Create campaign | Create locally + in Vapi via `vapi_service` |
| Add contacts | Store locally in `campaigns.contact_ids` JSON; add to Vapi campaign at launch |
| Launch | `POST /vapi/campaigns/{id}/start` — Vapi dials contacts from its campaign list |
| Sync contacts | When launching, iterate local contacts and `POST /vapi/campaigns/{id}/contacts` for each |
| Stats | `GET /vapi/campaigns/{id}` — Vapi is source of truth for campaign stats |
| **KEEP `campaign_contacts`** | Junction table; used to know which contacts belong to campaign |

**Pros:** Single contact list (local); Vapi handles execution
**Cons:** At launch time, contacts are synced to Vapi (one API call per contact — acceptable for MVP)

**Recommendation:** Approach B. User manages contacts in the app. When a campaign is launched, contacts are added to the Vapi campaign in a batch.

### Vapi APIs to Use

| Feature | Vapi API | Used In |
|---------|----------|---------|
| Outbound call | `POST /call` | Individual/test calls |
| End call | `POST /call/{id}/end` | `calls.py` |
| Get call | `GET /call/{id}` | `calls.py` get_call |
| Get transcript | `GET /call/{id}/transcripts` | `calls.py` get_call |
| Create campaign | `POST /campaign` | `campaigns.py` create |
| Add contacts | `POST /campaign/{id}/contacts` | `campaigns.py` launch |
| Start campaign | `POST /campaign/{id}/start` | `campaigns.py` launch |
| Stop campaign | `POST /campaign/{id}/stop` | `campaigns.py` cancel |
| Campaign stats | `GET /campaign/{id}` | `campaigns.py` get/list |
| List calls | `GET /calls` (Vapi) | `calls.py` list |

### Vapi Webhooks to Handle (already in `webhook.py`)

| Event | Action |
|-------|--------|
| `call-started` | Update `calls.status=active`, `calls.started_at` |
| `call-ended` | Update `calls.status`, `calls.ended_at`, `calls.duration_secs` |
| `call-failed` | Update `calls.status=failed` |
| `voicemail` | Update `calls.status=voicemail` |
| `end-of-call-report` | Update `calls.summary`, `calls.recording_url` |
| `transcript` | **Remove local insert** — fetch from Vapi API instead |

---

## 5. Files to Delete

```
DELETE:
- app/workers/rq_worker.py          # RQ worker — Vapi handles execution
- app/services/call_scheduler.py    # Manual call scheduling — Vapi handles this

MODIFY (don't delete, but significantly change):
- app/services/vapi_service.py       # Add campaign helpers, remove scheduler calls
- app/routers/campaigns.py           # Thin Vapi proxy, no local execution
- app/routers/calls.py               # Fetch from Vapi, not local DB
- app/routers/webhook.py             # Remove transcript_segments inserts
- app/db/models.py                   # Remove transcript_segments, strip campaigns/calls/user_configs
- app/schemas/campaigns.py           # Update CampaignResponse (remove redundant fields)
```

---

## 6. Clean MVP Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        FRONTEND (Next.js)                         │
│                                                                  │
│  /dashboard   /contacts   /campaigns   /campaigns/[id]   /calls │
│       ↓            ↓           ↓              ↓             ↓    │
│  RTK Query ──── RTK Query ─ RTK Query ─── RTK Query ─ RTK Query│
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                     BACKEND (FastAPI)                            │
│                                                                  │
│  Auth      Users    Contacts   Campaigns    Calls     Webhook     │
│   ↓         ↓          ↓          ↓          ↓          ↓        │
│  JWT    user_configs  contacts  Vapi Svc  Vapi Svc  (receive)    │
│                                           ↓                     │
│                                    Vapi REST API ──────────────►│
└─────────────────────────────────────────────────────────────────┘
                              ↑ webhooks
┌─────────────────────────────────────────────────────────────────┐
│                     VAPI (External)                              │
│                                                                  │
│  Assistants API ← user_configs.vapi_assistant_id                  │
│  Campaigns API ← campaigns + contacts at launch                   │
│  Calls API    ← calls, transcripts, recordings                    │
│  Web SDK     ← /test page (direct, no backend)                  │
└─────────────────────────────────────────────────────────────────┘
                              ↑
┌─────────────────────────────────────────────────────────────────┐
│                    PostgreSQL (Local DB)                         │
│                                                                  │
│  users        ← auth, ownership                                  │
│  contacts     ← user's contact list (Vapi doesn't have this)     │
│  user_configs ← { vapi_assistant_id, max_call_duration, retry } │
│  campaigns    ← { id, user_id, name, vapi_campaign_id,           │
│                    contact_ids: JSON, created_at }                │
│  calls        ← { id, user_id, campaign_id, contact_id,          │
│                    vapi_call_id, phone_to, phone_from,          │
│                    started_at, ended_at }                        │
└─────────────────────────────────────────────────────────────────┘
```

---

## 7. Implementation Order

**Phase 1: Clean up backend infrastructure**

1. Strip `transcript_segments` table and inserts from webhook
2. Fix `_get_campaign_counts` SQL bug (already done ✓)
3. Remove `rq_worker.py` and `call_scheduler.py`
4. Strip `campaigns` table columns
5. Strip `user_configs` columns
6. Strip `calls` table columns

**Phase 2: Vapi service expansion**

1. Add campaign CRUD methods to `vapi_service.py`
2. Update `routers/campaigns.py` to use Vapi as source of truth
3. Update `routers/calls.py` to fetch from Vapi API
4. Update `routers/webhook.py` to update local cache only

**Phase 3: Frontend cleanup**

1. Simplify `settings/page.tsx` — remove config fields
2. Simplify `onboarding/page.tsx` — 1 step
3. Update calls page to use Vapi-backed API
4. Update campaign detail page for new stats shape

**Phase 4: Remove Redis dependency**

1. Remove `REDIS_URL` from config
2. Update deployment docs

## 8. Things to remember

Vapi is the system of record for:

- call state
- campaign execution
- transcripts
- recordings

PostgreSQL is NOT a mirror of truth.

PostgreSQL is a materialized view optimized for:

- UI performance
- filtering
- ownership & permissions
- historical snapshots

If Vapi is down → system becomes read-only, not broken.
