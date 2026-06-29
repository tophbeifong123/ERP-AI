# ERP-AI — Quick Start (Demo Flow)

## TL;DR

```bash
# 1. From the repo root
docker compose up -d            # postgres, redis, minio, mailhog, n8n, ai-services
cd backend/server && CI=true pnpm install
CI=true pnpm migration:run
# Start backend (in a terminal that you can leave running)
node dist/main.js              # http://localhost:3000

# 2. In another terminal
cd frontend && CI=true pnpm install
./node_modules/.bin/next dev -p 3001   # http://localhost:3001
```

Open **http://localhost:3001** → register → verify email (Mailhog :8025) → complete the 3-step onboarding → click "สร้างโพสต์ด้วย AI" on the dashboard.

## What happens when you "Generate post"

1. **User** types a short hint + picks services on the dashboard
2. **Backend** creates a `Post` in `generating` state and enqueues **4 AI jobs in parallel**:
   - `caption` → Groq generates a Thai caption from the hint
   - `image` → n8n generates an image and uploads to MinIO
   - `short_video` → optional (n8n)
   - `decision` → Groq recommends a publish time
3. **Frontend** polls every 3s while any post is `generating`; user sees the badge change
4. When **all 4 jobs succeed** → post transitions to `pending_approval`
5. **User** can edit caption / scheduled time / post type / services (**NOT the image**)
6. **User** clicks "อนุมัติ" → status becomes `approved`
7. **Cron** (`dispatchDuePosts`, every minute) picks up approved posts whose `scheduledAt <= now` and posts to Facebook
8. **Cron** (`expirePendingApprovals`, every minute) marks `pending_approval` posts whose `approvalDeadline` passed as `expired`

## Architecture

```
┌──────────────┐       ┌─────────────────┐       ┌──────────────┐
│  Frontend    │ HTTPS │  Backend (Nest)  │ Redis │  PostgreSQL  │
│  Next.js     │◄─────►│  :3000           │◄─────►│  :5432       │
│  :3001       │ JWT   │  BullMQ workers  │       └──────────────┘
└──────────────┘       │  + 2 crons       │       ┌──────────────┐
                       │                 │       │   MinIO      │
                       │   POST /posts    │       │   :9000      │
                       │   enqueues 4 AI  │       └──────────────┘
                       │   jobs           │       ┌──────────────┐
                       └────┬────────────┘       │  AI Services │
                            │                    │  :8000       │
                            │  async callbacks   │  Decision +   │
                            ▼                    │  Caption     │
                  ┌─────────────────┐             └──────┬───────┘
                  │  AI Services     │◄─────────────────►│
                  │  + n8n (:5678)   │                    │
                  │  (n8n calls       │                    │
                  │   MinIO via       │                    │
                  │   host.docker.    │                    │
                  │   internal)       │                    │
                  └─────────────────┘

Async contract:
  Backend ──POST /recommend-time──► AI Services
  AI Services ──202 Accepted──────► Backend
  AI Services ──POST /internal/ai/decision/callback──► Backend (with result)
```

## Prerequisites

- Docker (or Podman) with `docker compose`
- Node 20+ and pnpm
- A **Groq API key** at https://console.groq.com — required for AI Caption + Decision
- A Facebook App with `pages_show_list`, `pages_manage_posts`, `pages_read_engagement` scopes
- (For image generation via n8n) Google Cloud credentials for Vertex AI / Veo3

## Environment files

| File | Purpose |
|---|---|
| `/mnt/d/work/ERP-AI/.env` | Consumed by `docker compose` |
| `/mnt/d/work/ERP-AI/backend/server/.env` | Backend reads directly |
| `/mnt/d/work/ERP-AI/frontend/.env` (optional) | `NEXT_PUBLIC_API_URL=...` |

All `.env` files are git-ignored; only `.env.example` is committed.

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
3. Set access policy to `public` (so the Facebook Graph API can fetch the image)

If you can't do this, run:
```bash
docker exec erp-ai-minio mc alias set local http://localhost:9000 minioadmin minioadmin
docker exec erp-ai-minio mc anonymous set download local/erp-ai
```

## Demo without GCP (text-only image)

If n8n can't reach Vertex AI / Veo3 (no `GCP_PROJECT_ID` / `GCP_VEO_OUTPUT_BUCKET`), the image job will fail after 3 retries and the post will be marked `failed`. For a quick text-only demo, edit `backend/server/src/modules/posts/posts.service.ts:enqueueFullAIPipeline()` and remove the two media jobs (`image` + `short_video`).

## Cron summary

| Cron | When | What |
|---|---|---|
| `dispatchDuePosts` | every 1 min | Posts with `status='approved' AND scheduledAt <= now` → FB |
| `expirePendingApprovals` | every 1 min | `pending_approval` posts past their `approvalDeadline` → `expired` |
| `ai-job-retry` | every 30s | Re-enqueues failed AI jobs (with backoff 1m, 5m, 15m) |

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

This is the simplified version of the project. The previous auto-decide and auto-schedule flows have been removed. See `docs/REFACTOR.md` (if it exists) for the full changelog. Key changes:

- `content-plans` table and module — **removed**
- `auto_post_*` columns on `businesses` — **removed**
- `dailyDecide` and `materializeFixedSchedule` crons — **removed**
- `SchedulerService` — slimmed to just `dispatchDuePosts` + `expirePendingApprovals`
- `POST /posts` — new shape: `{ businessId, hint, postType, featuredServiceIds }` (no caption/fbPageId)
- `POST /internal/ai/decision/callback` — new route with new contract: `{ jobId, result: { suggestedScheduledAt, reasoning } }`
- AI Decision service — rewrote as a "time recommender" (not "should-post" decider)
