# ERP-AI — Quick Start (Demo Flow)

อัปเดตล่าสุด: มิถุนายน 2026 — ระบบหลักทำงานครบทุก flow แล้ว (register → onboard → create AI post → approve → cron posts to FB)

## TL;DR

```bash
# 0. Prerequisites (one-time)
#    - Node 20+ with pnpm
#    - Docker with `docker compose`

# 1. From the repo root: start infrastructure
docker compose up -d            # postgres, redis, minio, mailhog, n8n, ai-services

# 2. Backend (NestJS)
cd backend/server
CI=true pnpm install
CI=true pnpm migration:run
# Option A — production-style run
node dist/main.js              # http://localhost:3000
# Option B — dev with auto-reload
pnpm start:dev                 # nest start --watch, port 3000

# 3. Frontend (Next.js) — in another terminal
cd ../frontend
CI=true pnpm install
pnpm dev -- -p 3001            # http://localhost:3001
# (modern pnpm form; older `./node_modules/.bin/next dev -p 3001` also works)
```

Open **http://localhost:3001** → register → verify email (Mailhog at **http://localhost:8025**) → complete the 3-step onboarding → click "**สร้างโพสต์ด้วย AI**" on the dashboard.

### Demo credentials (already seeded)

If you don't want to register a fresh account, the dev DB has a pre-seeded user:

| Field | Value |
|---|---|
| Email | `demo@erp-ai.test` |
| Password | `Test1234!` |

(Log in at http://localhost:3001/login.) This account already has a business + a connected Facebook Page, so you can go straight to creating posts.

## What happens when you "Generate post"

1. **User** opens the modal → types a short hint + picks `postType` + picks **`mediaType` (image หรือ short_video, default = image)** + optional featured services
2. **Backend** creates a `Post` in `generating` state, persists the chosen `mediaType`, and enqueues **3 AI jobs in parallel**:
   - `caption` → `ai-services` (Groq) generates a Thai caption from the hint
   - `media` (image หรือ short_video ตามที่ผู้ใช้เลือก) → `n8n` workflow สร้างสื่อ แล้วอัปโหลดเข้า MinIO
   - `decision` → `ai-services` (Groq) recommends a publish time
3. **Frontend** polls `/posts` every 3s while any post is `generating`; user sees an in-flight placeholder ("กำลังสร้างรูปภาพ…" หรือ "กำลังสร้างวิดีโอ…")
4. When **all 3 jobs succeed** → post transitions to `pending_approval`
5. **User** can edit `caption` / `scheduledAt` / `postType` / `featuredServiceIds` (**ไม่สามารถ regenerate สื่อได้ในเวอร์ชันนี้**)
6. **User** clicks "**อนุมัติ**" → status becomes `approved`
7. **Cron** `dispatchDuePosts` (every 1 min) picks up `approved` posts whose `scheduledAt <= now` → dispatches to Facebook via the Graph API
8. **Cron** `expirePendingApprovals` (every 1 min) marks `pending_approval` posts past their `approvalDeadline` as `expired`

## Architecture

```
┌──────────────┐       ┌─────────────────┐       ┌──────────────┐
│  Frontend    │ HTTPS │  Backend (Nest)  │ Redis │  PostgreSQL  │
│  Next.js     │◄─────►│  :3000           │◄─────►│  :5432       │
│  :3001       │ JWT   │  BullMQ workers  │       └──────────────┘
└──────────────┘       │  + 2 crons       │       ┌──────────────┐
                       │                 │       │   MinIO      │
                       │   POST /posts    │       │   :9000      │
                       │   enqueues 3 AI  │       │ (S3-compat)  │
                       │   jobs           │       └──────────────┘
                       └────┬────────────┘       ┌──────────────┐
                            │                    │  AI Services │
                            │  async callbacks   │  :8000       │
                            ▼                    │  (FastAPI)   │
                  ┌─────────────────┐             │  Decision +   │
                  │  AI Services     │◄────────────│  Caption     │
                  │  + n8n (:5678)   │  HTTP       │  (Groq)      │
                  │  (n8n calls       │             └──────────────┘
                  │   MinIO via       │
                  │   presigned URL + │
                  │   GCS for Veo)   │
                  └─────────────────┘

Sync:    Backend ──POST /api/ai/decision, /api/ai/caption──► AI Services
                AI Services ──202 Accepted─────────────────► Backend
        Backend ──POST /webhook/generate-media (X-Internal-Token)──► n8n

Async (callback):
  AI Services ──POST /internal/ai/{decision|caption}/callback──► Backend
  n8n ──POST /internal/ai/{image|short_video}/callback──────────► Backend
```

## Prerequisites

- **Docker** (or Podman) with `docker compose`
- **Node.js 20+** and **pnpm**
- A **Groq API key** at https://console.groq.com — required for AI Caption + AI Decision
- A Facebook App with `pages_show_list`, `pages_manage_posts`, `pages_read_engagement` scopes — required for the FB OAuth flow
- **(Optional, for AI media)** A Google Cloud service account with Vertex AI access:
  - Set `GCP_PROJECT_ID`, `GCP_LOCATION`, `GCP_VEO_OUTPUT_BUCKET` in `backend/server/.env`
  - Place the service account JSON at `/mnt/d/work/ERP-AI/gcp-key.json` (template at `gcp-key.json.example`)
  - Set `ENABLE_AI_MEDIA=true` to actually generate image/short_video
  - Make the GCS bucket public-read (run `python3 scripts/make_bucket_public.py`)
  - Without these, the media job is skipped and only caption+decision run

## Environment files

| File | Purpose |
|---|---|
| `/mnt/d/work/ERP-AI/.env` | Consumed by `docker compose` |
| `/mnt/d/work/ERP-AI/backend/server/.env` | Backend reads directly |
| `/mnt/d/work/ERP-AI/frontend/.env` (optional) | `NEXT_PUBLIC_API_URL=...` |

All `.env` files are git-ignored; only `.env.example` is committed. `gcp-key.json` is also git-ignored (template at `gcp-key.json.example`).

## Important: Docker networking on WSL2

The backend runs as a native WSL2 process, but the AI services and n8n run in Docker containers (Docker Desktop's VM). They cannot reach the backend via `localhost` or `host.docker.internal`. The backend's `APP_URL` env var must be set to the WSL2 host's IP (auto-detected via `hostname -I`).

Current setting: `APP_URL=http://172.27.65.121:3000` (the WSL2 host's eth0 IP).

If you change networks, re-detect and update:
```bash
hostname -I        # e.g. 172.27.65.121
# Update APP_URL in backend/server/.env
```

## First-time MinIO setup

1. Open http://localhost:9001 (minioadmin / minioadmin)
2. Create bucket: `erp-ai`
3. Set access policy to `public` (so n8n can upload to it via presigned URL)

If you can't do this, run:
```bash
docker exec erp-ai-minio mc alias set local http://localhost:9000 minioadmin minioadmin
docker exec erp-ai-minio mc anonymous set download local/erp-ai
```

## Demo without GCP (text-only)

If n8n can't reach Vertex AI / Veo 3.1 (no `GCP_PROJECT_ID` / `GCP_VEO_OUTPUT_BUCKET`), set `ENABLE_AI_MEDIA=false` in `backend/server/.env` and restart. The post will finalize with just caption + decision (no media); the in-flight placeholder will be skipped, and the post will go straight to `pending_approval` with no thumbnail.

## Cron summary

| Cron | When | What |
|---|---|---|
| `dispatchDuePosts` | every 1 min | Posts with `status='approved' AND scheduledAt <= now` → FB (multipart upload of file bytes from MinIO) |
| `expirePendingApprovals` | every 1 min | `pending_approval` posts past their `approvalDeadline` → `expired` |
| `ai-job-retry` (BullMQ delayed) | at +1m / +5m / +15m | Re-enqueues failed AI jobs with exponential backoff |

## Where things live

| Service | Source | Port |
|---|---|---|
| Frontend (Next.js) | `frontend/src/` | 3001 |
| Backend (NestJS) | `backend/server/src/` | 3000 |
| AI Services (FastAPI) | `ai-services/app/` | 8000 |
| n8n workflow | `n8n/n8n.json` | 5678 |
| Database (Postgres) | (init migration) | 5432 |
| Storage (MinIO) | (presigned URLs) | 9000 |
| Email (Mailhog) | (dev SMTP) | 1025/8025 |

## What's been refactored

This is the simplified version of the project. The previous auto-decide and auto-schedule flows have been removed. See `docs/PROGRESS.md` for the full changelog. Key changes from the original spec:

- `content-plans` table and module — **removed**
- `auto_post_*` columns on `businesses` — **removed**
- `dailyDecide` and `materializeFixedSchedule` crons — **removed**
- `SchedulerService` — slimmed to just `dispatchDuePosts` + `expirePendingApprovals`
- `POST /posts` — new shape: `{ businessId, hint, postType, mediaType, featuredServiceIds }` (no caption/fbPageId; `mediaType` is the new field, defaults to `image`)
- `POST /internal/ai/decision/callback` — new route with new contract: `{ jobId, result: { suggestedScheduledAt, reasoning } }`
- AI Decision service — rewrote as a "time recommender" (not "should-post" decider)
- `posts.media_type` enum column — added 2026-06; persists the user's media choice per post
- `ai_jobs.metadata` jsonb + `ai_jobs.error_code` — added 2026-06; structured storage for failure context (e.g. RAI filter reasons)
- `DispatchPostProcessor` — switched from URL-based to multipart upload 2026-06 so Facebook doesn't need to fetch a private URL
