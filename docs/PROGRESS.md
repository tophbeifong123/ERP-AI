# Project Progress — ERP-AI (MarketMate)

> Last updated: 2026-06-29
> Current Phase: **P4 Complete** (Polish, n8n integration, observability, structured errors)
> Next Phase: **P5** (per-business AI quota, video transcription, retry-on-RAI-suppress)
>
> **ทุก AI service ทำงานจริงแล้ว**: Decision + Caption (FastAPI + Groq) ใน `ai-services/`, Media (n8n + Vertex AI) ใน `n8n/n8n.json` End-to-end flow ทำงานครบ: สมัคร → onboard → สร้างโพสต์ (เลือก image หรือ short_video) → อนุมัติ → cron โพสต์ไป Facebook

---

## 🔧 Recent fixes (มิถุนายน 2026)

### n8n workflow bug — "Cannot read properties of undefined (reading 'data')"

- **Root cause:** `PUT Image/Video to MinIO` nodes ใน `n8n/n8n.json` ใช้ HTTP Request v4.2 แต่ใช้ parameter names ของ v1 (`specifyBody: "binary"`, `binaryPropertyName: "data"`) ซึ่ง v4.2 ไม่อ่าน ผลคือ body ไม่ถูกส่ง, `n8n` พยายามอ่าน `binary.data` → `undefined.data` → crash
- **Fix:** เปลี่ยนเป็น `contentType: "binaryData"`, `inputDataFieldName: "data"`, `responseFormat: "text"`, `fullResponse: true`
- **Verification:** end-to-end test โพสต์ `9c639bbd-…` (image) upload ไป MinIO สำเร็จ

### RAI filter detection (Veo 3.1 recitation check)

- **Symptom:** error "Could not find video URI: {…raiMediaFilteredCount:0, raiMediaFilteredReasons:['Recitation check failed.']…}"
- **Fix:** เพิ่ม check `raiMediaFilteredCount > 0 || raiMediaFilteredReasons.length > 0` ใน `Evaluate Video Status` node ก่อน fallthrough ถึง gcsUri lookup — ผลิตข้อความ "Content was filtered by Vertex AI safety check: <reasons>"
- **Output:** `ai_jobs.last_error = "content_safety: Content was filtered by Vertex AI safety check: Recitation check failed."` (human-readable)

### `posts.mediaType` selector (ผู้ใช้เลือก image / short_video)

- **New column:** `posts.media_type text NOT NULL DEFAULT 'image'` (migration `1719700000000-AddPostMediaType`)
- **DTO:** `POST /posts` รับ `mediaType?: 'image' | 'short_video'`
- **Service:** `enqueueFullAIPipeline()` enqueue เฉพาะ media kind ที่ผู้ใช้เลือก (ไม่ generate ทั้งคู่)
- **Frontend:** `CreatePostModal` มี radio toggle "รูปภาพ" / "วิดีโอสั้น" + dynamic toast
- **Verification:** end-to-end test โพสต์ video `ea078452-…` (3.2 MB MP4) สำเร็จ

### API: `GET /posts` ไม่ส่ง media rows

- **Symptom:** โพสต์มี `media` ใน DB แต่ `GET /posts` คืน `media: []` → frontend แสดง placeholder
- **Fix:** `posts.service.ts:list()` เพิ่ม `.leftJoinAndSelect('post.media', 'media').leftJoinAndSelect('media.file', 'file')`; `getOne()` เปลี่ยน relations เป็น `{ media: { file: true }, aiJobs: true }`
- **Verification:** `curl GET /posts?businessId=…` คืน media + publicUrl ครบ

### GCS bucket public access ถูกปิด (recurring root cause)

- **Symptom:** Veo 3.1 generate video สำเร็จ แต่ n8n โหลดวิดีโอจาก `storage.googleapis.com` ไม่ได้ → "Unable to fetch video file from URL"
- **Root cause:** `publicAccessPrevention=enforced` บน bucket `water-fish-veo-bucket` → reject ทุก `allUsers` IAM bindings
- **Fix:** `scripts/make_bucket_public.py` อัปเดตให้ 1) ตั้ง `publicAccessPrevention=inherited` (PUT ใหม่) แล้ว 2) เพิ่ม `allUsers=objectViewer` binding

### `posts.failed` ไม่ถูก revive เมื่อ retry สำเร็จ

- **Symptom:** post ถูก mark `failed` แล้ว, retry media สำเร็จ (มี post_media ใน DB) แต่ post ยังอยู่ใน `failed`
- **Root cause:** `checkPostGenerationComplete()` early-return ถ้า `post.status !== 'generating'`
- **Fix:** guard เปลี่ยนเป็น `!== 'generating' && !== 'failed'`; เพิ่ม revive path ที่ clear `errorCode`/`errorMessage`/`rejectionReason` ก่อน transition เป็น `pending_approval`
- **Test:** end-to-end โพสต์ video 3.2 MB MP4 → `pending_approval` สำเร็จ (3.5 นาที)

### Facebook dispatch ส่ง URL ที่ Facebook เข้าไม่ถึง

- **Symptom:** scheduled posts ถูก dispatch แต่ Facebook คืน error 324 "Missing or invalid image file"
- **Root cause:** `dispatch-post.processor.ts` ส่ง `{ url: 'http://localhost:9000/...' }` ให้ Facebook แต่ Facebook's servers เข้า `localhost` ไม่ได้
- **Fix:** เปลี่ยนเป็น multipart upload — `S3Service.downloadFile()` อ่านไฟล์จาก MinIO แล้ว POST bytes ตรงไปที่ `graph.facebook.com/{ver}/{page-id}/{photos|videos}` (เหมือน `testPostToPage` ที่ใช้ได้อยู่แล้ว)
- **Verification:** โพสต์ `b5910004-…` (text-only) → `posted` ✅; โพสต์ `11111111-…` (synthetic video) → `posted` ✅ `via /videos`

### `ai_jobs.metadata` (jsonb) — structured failure context

- **New columns:** `ai_jobs.metadata jsonb NOT NULL DEFAULT '{}'`, `ai_jobs.error_code text NULL`
- **Migration:** `1719700000001-AddAiJobMetadata`
- **Wire format:** n8n error chain ส่ง `payload.metadata.raiMediaFilteredReasons = [...]` → backend เก็บใน `metadata` แทนที่จะ parse จาก `lastError` string
- **Index:** `idx_ai_jobs_error_code WHERE error_code IS NOT NULL` สำหรับ filter admin UI

### gcp-key.json leak — git history purge

- **Symptom:** `gcp-key.json` (real GCP service account JSON) ถูก commit ใน commit `fe76f9be feat: connect all module` และ push ไป `origin` (public repo)
- **Fix:** 1) backup ไฟล์ไป `~/.config/erp-ai/`, 2) เพิ่ม `gcp-key.json` ใน `.gitignore` + สร้าง `gcp-key.json.example` template, 3) `git-filter-repo --invert-paths --path gcp-key.json` rewrite history, 4) reflog expire + gc, 5) **ต้อง user force-push ไป origin** (ผม push ไม่ได้เพราะไม่มี GitHub credentials), 6) **rotate key ใน GCP Console** (mandatory เพราะ secret ถูก expose)
- **Pre-push verification:** `git log --all --oneline -- gcp-key.json` คืนว่าง (ไม่มี commit ที่มีไฟล์นี้)

### Demo account seeded

- Email: `demo@erp-ai.test` / Password: `Test1234!` (สำหรับ dev/test login โดยไม่ต้อง register)
- Business: ร้านกาแฟโบราณ + มี connected Facebook Page (Test1122) ใน DB

---

---

## Phase P0 — Foundation ✅ COMPLETE

### Infrastructure

- [x] `docker-compose.yml` — PostgreSQL 15, Redis 7, MinIO, Mailhog with healthchecks
- [x] `.env` + `.env.example` — All environment variables configured
- [x] `.gitignore` — Comprehensive ignore rules

### Dependencies Installed

- [x] NestJS core modules (`@nestjs/typeorm`, `@nestjs/config`, `@nestjs/jwt`, `@nestjs/passport`, `@nestjs/schedule`, `@nestjs/bullmq`)
- [x] Database (`typeorm`, `pg`)
- [x] Queue (`bullmq`, `ioredis`)
- [x] Auth (`argon2`, `passport-jwt`, `jsonwebtoken`)
- [x] Storage (`@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner`)
- [x] Email (`nodemailer`)
- [x] Logging (`pino`, `pino-http`)
- [x] Validation (`class-validator`, `class-transformer`)
- [x] Utilities (`uuid`)

### Config Layer (`src/config/`)

- [x] `app.config.ts` — App settings, JWT secrets, AI service URLs, Facebook OAuth config
- [x] `database.config.ts` — PostgreSQL connection
- [x] `redis.config.ts` — Redis connection
- [x] `s3.config.ts` — MinIO/S3 settings
- [x] `mail.config.ts` — SMTP settings

### Database Schema (`src/database/`)

**16 Entities Created:**

1. [x] `User` — email, password_hash, email_verified_at, soft delete
2. [x] `RefreshToken` — token_hash, expires_at, revoked_at, rotation chain
3. [x] `EmailVerification` — token_hash, expires_at (24h), used_at
4. [x] `PasswordReset` — token_hash, expires_at (1h), used_at
5. [x] `File` — kind (logo/service_image/post_media), storage_key, public_url
6. [x] `Business` — owner_id, auto_post config, fixed_schedule_rules (jsonb), logo_file_id
7. [x] `Service` — business_id, price_minor (bigint satang), currency='THB', image_file_id
8. [x] `FacebookPage` — fb_page_id, access_token_encrypted (AES-GCM bytea), token_expires_at
9. [x] `ContentPlan` — decided_by, status, suggested_* fields, materialized_post_id
10. [x] `Post` — status (state machine), post_type, generation_source, scheduled_at, approval_deadline
11. [x] `PostMedia` — post_id, file_id, kind (image/short_video), order_index
12. [x] `PostFeaturedService` — M2M junction table (post_id, service_id)
13. [x] `AiJob` — type (caption/image/short_video), status, attempts, payload (jsonb), result (jsonb), next_run_at
14. [x] `Notification` — type (post_ready/post_posted/post_failed/post_expired), channel='email'
15. [x] `EmailLog` — template, payload (jsonb), status, sent_at
16. [x] `Unsubscribe` — token, category (marketing/transactional)

**Migration:**
- [x] `1700000000000-InitSchema.ts` — Full schema with all tables, indexes, CHECK constraints
- [x] Enabled `citext` extension for case-insensitive email
- [x] Partial indexes on `deleted_at IS NULL`
- [x] Composite indexes for query optimization

### Common Layer (`src/common/`)

**Crypto (`src/common/crypto/`):**
- [x] `EncryptionService` — AES-256-GCM encrypt/decrypt using `FB_TOKEN_ENCRYPTION_KEY` (32-byte base64)
- [x] `hash.util.ts` — `sha256()` and `randomToken(bytes)`

**Redis (`src/common/redis/`):**
- [x] `RedisModule` — Global module providing `REDIS_CLIENT` (ioredis)

**Common (`src/common/common.module.ts`):**
- [x] `CommonModule` — Global module exposing `EncryptionService`

**Guards:**
- [x] `GlobalJwtGuard` — Global APP_GUARD using `@nestjs/passport` (replaces hand-rolled JwtAuthGuard from P0)
- [x] `JwtStrategy` — Validates JWT, sets `req.user = { id, email, emailVerifiedAt }`
- [x] `InternalTokenGuard` — Verify `X-Internal-Token` header for AI callbacks
- [x] `OwnerGuard` — Resolve owner via `DataSource` raw SQL (works across modules without per-module repo injection)
- [x] `EmailVerifiedGuard` — Block unverified users from protected endpoints

**Decorators:**
- [x] `@CurrentUser` — Extract user from request
- [x] `@Public` — Skip auth for public endpoints (used by GlobalJwtGuard)
- [x] `@ResourceType` — Specify resource type for OwnerGuard

**Filters:**
- [x] `AllExceptionsFilter` — Standardized error response with reqId

**Interceptors:**
- [x] `RequestIdInterceptor` — Generate/propagate X-Request-Id
- [x] `LoggingInterceptor` — pino request logging with duration

**Types (`src/types/express.d.ts`):**
- [x] `Request.reqId` and `Request.user` augmentation

### Modules

**FilesModule** (`src/modules/files/`):
- [x] `S3Service` — MinIO/S3 client, bucket auto-creation, upload, presigned URLs (PUT/GET), delete, ping
- [x] `FilesService` — Upload file, generate presigned upload URL, save presigned upload, delete
- [x] `FilesController` — `POST /files/upload/:kind` (multipart), `POST /files/presigned/:kind`
- [x] File validation (max 10MB, allowed MIME types)
- [x] Storage key generation with date-based paths (`logos/2026/06/27/uuid.png`)

**HealthModule** (`src/modules/health/`):
- [x] `HealthService` — Check DB (SELECT 1), Redis (PING), S3 (HeadBucket)
- [x] `HealthController` — `GET /health` (public, returns 200 or 503)
- [x] Response includes: status, db, redis, storage, version, uptime, errors

**EmailModule** (`src/modules/email/`):
- [x] `EmailService` — Enqueues email jobs to BullMQ
- [x] `EmailProcessor` — Consumer that sends via nodemailer (SMTP/Mailhog)
- [x] Templates: `verify-email`, `reset-password`, `post-ready`, `post-expired`, `post-posted`, `post-failed` (HTML + text)
- [x] `email_logs` INSERT with status: queued → sent/failed
- [x] Retry: 3 attempts, exponential backoff (30s base)
- [x] Enqueue methods: `enqueueVerifyEmail`, `enqueueResetPassword`, `enqueuePostReady`, `enqueuePostExpired`, `enqueuePostPosted`, `enqueuePostFailed`

**AuthModule** (`src/modules/auth/`):
- [x] `AuthService` — register, login, refresh (rotation), logout, forgot, reset, verify, change-password
- [x] `AuthController` — All 8 endpoints
- [x] `TokenService` — Sign/verify access JWT (15min) + refresh JWT (7d)
- [x] `JwtStrategy` — Passport JWT strategy
- [x] `GlobalJwtGuard` — Global APP_GUARD with `@Public()` skip
- [x] argon2id password hashing (64MB, 3 iterations)
- [x] Refresh-token reuse detection → revoke entire chain
- [x] Email/landing pages: `GET /auth/verify-email?token=...`, `GET /auth/reset-password?token=...`
- [x] Frontend redirect via meta refresh

**UsersModule** (`src/modules/users/`):
- [x] `GET /me` — Return current user info
- [x] `DELETE /me` — Soft delete user + revoke all refresh tokens

**BusinessesModule** (`src/modules/businesses/`):
- [x] `POST /businesses` — Create business (multipart for logo)
- [x] `GET /businesses` — List user's businesses
- [x] `GET /businesses/:id` — Get business detail
- [x] `PATCH /businesses/:id` — Update business
- [x] `DELETE /businesses/:id` — Soft delete
- [x] `POST /businesses/:id/logo` — Upload/change logo
- [x] `PATCH /businesses/:id/auto-post` — Update auto-post config (mode + cadence + fixed schedule)

**ServicesModule** (`src/modules/services/`):
- [x] `POST /businesses/:id/services` — Create service (multipart for image)
- [x] `GET /businesses/:id/services` — List services (paginated, filter by `active`)
- [x] `GET /services/:id` — Get service detail
- [x] `PATCH /services/:id` — Update service (incl. `isActive`)
- [x] `DELETE /services/:id` — Soft delete
- [x] Price stored as `bigint` satang (frontend sends THB, multiplied by 100)

**FacebookModule** (`src/modules/facebook/`):
- [x] `GET /facebook/oauth/start` — 302 to Facebook OAuth (requires JWT)
- [x] `GET /facebook/oauth/callback` — Public; exchanges code → long-lived user token, stores in Redis (10min TTL), redirects to `${FRONTEND_URL}/businesses/:id?fb=connected`
- [x] `GET /facebook/pages` — List pages from Facebook `/me/accounts`
- [x] `POST /businesses/:id/facebook-pages` — Connect page (AES-256-GCM encrypt page token)
- [x] `DELETE /businesses/:id/facebook-pages/:pageId` — Disconnect page (soft-delete)
- [x] State JWT (HMAC-SHA256, 10min TTL) encodes `{userId, businessId, nonce, iat, exp}`
- [x] `decryptToken()` for P3 dispatch

**AiModule** (`src/modules/ai/`):
- [x] `state-machine.ts` — `PostStateMachine` with allowed transitions
- [x] `ai.service.ts` — `decide()` (creates content plan), `materialize()` (plan → post), `captionCallback()`, `imageCallback()`, `shortVideoCallback()`, `fail()` (with retry/backoff), `enqueueCaptionJob()` (BullMQ producer)
- [x] `ai.controller.ts` — `POST /internal/ai/decide/callback`, `/caption/callback`, `/image/callback`, `/short_video/callback`, `/job/fail` (all `Public()` + `InternalTokenGuard`)
- [x] `ai.module.ts` — BullMQ `ai` queue, entities for Post/ContentPlan/AiJob/Business/Service/User

**PostsModule** (`src/modules/posts/`):
- [x] `state-machine.ts` — full Post state transitions (draft → generating → pending_approval → approved/rejected/expired → posted/failed)
- [x] `posts.service.ts` — CRUD with filters, `transition()`, `approve()`, `reject()`, featured services, media, owner check
- [x] `posts.controller.ts` — `POST /posts`, `GET /posts?businessId=&status=&postType=&from=&to=`, `GET /posts/:id`, `PATCH /posts/:id`, `POST /posts/:id/approve`, `POST /posts/:id/reject`, `DELETE /posts/:id`
- [x] `posts.module.ts` — with User entity (for `EmailVerifiedGuard`)

**ContentPlansModule** (`src/modules/content-plans/`):
- [x] `content-plans.service.ts` — list/get/cancel/materialize
- [x] `content-plans.controller.ts` — `GET /content-plans?businessId=&status=&decidedBy=`, `GET /content-plans/:id`, `POST /content-plans/:id/materialize`, `POST /content-plans/:id/cancel`
- [x] `content-plans.module.ts`

**AiJobsModule** (`src/modules/ai-jobs/`):
- [x] `ai-jobs.service.ts` — list/get/retry/findDueJobs
- [x] `ai-jobs.controller.ts` — `GET /ai-jobs?type=&status=&postId=`, `GET /ai-jobs/:id`, `POST /ai-jobs/:id/retry`
- [x] `ai-jobs.module.ts`

**NotificationsModule** (`src/modules/notifications/`):
- [x] `notifications.service.ts` — list/get/markRead/markAllRead/create
- [x] `notifications.controller.ts` — `GET /notifications?type=&unreadOnly=`, `GET /notifications/:id`, `PATCH /notifications/:id/read`, `POST /notifications/read-all`
- [x] `notifications.module.ts`

**SchedulerModule** (`src/modules/scheduler/`):
- [x] `scheduler.service.ts` with cron jobs:
  - `dailyDecide` — `0 6 * * *` Asia/Bangkok — query businesses with auto_post_enabled
  - `materializeFixedSchedule` — hourly — fixed_schedule rules
  - `dispatchDuePosts` — every minute — enqueues `dispatch-post` BullMQ job for `status=approved + scheduled_at <= now`
  - `expirePendingApprovals` — every minute — auto-reject pending_approval past approval_deadline + fires `post_expired` event
  - `retryAiJobs` — every 30s — queued jobs with next_run_at <= now
  - `refreshFacebookTokens` — daily 1 AM — pages with token_expires_at < now+7d
  - `enqueueRefreshTokenCleanup` — daily 2 AM — enqueues `refresh-token-cleanup` BullMQ job
  - `cleanupOrphanFiles` — daily 3 AM
- [x] `scheduler.module.ts` — registers `dispatch-post` and `refresh-token-cleanup` BullMQ queues

**JobsModule** (`src/modules/jobs/`):
- [x] `caption.processor.ts` — calls `${AI_CAPTION_URL}/caption`, retries on failure, marks AI job status
- [x] `media.processor.ts` — calls `${AI_MEDIA_URL}/generate` for both `image` and `short_video` job types
- [x] `dispatch-post.processor.ts` — decrypts FB page token, posts caption to `/{fbPageId}/feed`, fires `post_posted` or `post_failed` event
- [x] `refresh-token.processor.ts` — deletes refresh tokens older than 30 days
- [x] `jobs.module.ts` — registers `caption`, `media`, `dispatch-post`, `refresh-token-cleanup` BullMQ queues

**PostEventsService** (`src/modules/posts/post-events.service.ts`):
- [x] `emit(event, ctx)` — creates notification + enqueues email for each lifecycle event
- [x] `emitForStatus(postId, to, extra)` — convenience that maps Post state transitions to events
- [x] Hooked into `posts.service.transition()` and `ai.service.captionCallback()`
- [x] Hooked into `scheduler.expirePendingApprovals()`
- [x] `post-events.module.ts` — wires notifications + email + facebook deps

**OwnerGuard** (`src/common/guards/owner.guard.ts`):
- [x] Resolves owner via `DataSource` raw SQL (no per-module repo injection)
- [x] Supports `business | service | post | facebook-page | content-plan` resource types

### App Wiring

- [x] `app.module.ts` — ConfigModule, TypeOrmModule, ScheduleModule, BullModule, RedisModule (global), CommonModule (global), EmailModule, AuthModule, UsersModule, BusinessesModule, ServicesModule, FacebookModule, AiModule, PostsModule, ContentPlansModule, AiJobsModule, NotificationsModule, SchedulerModule, JobsModule, FilesModule, HealthModule
- [x] `main.ts` — CORS, ValidationPipe, global filters/interceptors, port config
- [x] `test-connections.ts` — Standalone script to test all service connections

### Scripts Added (`package.json`)

```json
"typeorm": "ts-node -r tsconfig-paths/register ./node_modules/typeorm/cli.js",
"migration:generate": "pnpm typeorm migration:generate -d src/database/data-source.ts",
"migration:run": "pnpm typeorm migration:run -d src/database/data-source.ts",
"migration:revert": "pnpm typeorm migration:revert -d src/database/data-source.ts",
"test:connections": "ts-node -r tsconfig-paths/register src/test-connections.ts"
```

### P2 Smoke-Test Results (2026-06-28)

Verified end-to-end with `curl` against running stack:

- ✅ `POST /posts` with `generationSource="auto_ai"` → 201, status=`generating`, creates 3 `ai_jobs` (caption, image, short_video) with `status=queued`
- ✅ `GET /ai-jobs?postId={id}` → returns 3 jobs (caption, image, short_video) all queued
- ✅ `POST /internal/ai/caption/callback` → post transitions `generating` → `pending_approval`, sets caption
- ✅ `GET /notifications` → 1 notification of type `post_ready` for the user
- ✅ `email_logs` table → 1 row with `template='post-ready'`, `status='sent'`
- ✅ Email renders with: `To: p1tester@example.com`, `Subject: New post ready for review — <businessName>`
- ✅ Mailhog receives the post-ready email
- ✅ Cron `dispatchDuePosts` runs every minute (visible in logs)
- ✅ Cron `expirePendingApprovals` runs every minute
- ✅ Cron `retryAiJobs` runs every 30s
- ✅ Cron `enqueueRefreshTokenCleanup` scheduled daily at 2 AM



Verified end-to-end with `curl` against running stack:

**Auth (P1):**
- ✅ `POST /auth/register` → 201 + verification email queued to Mailhog
- ✅ `POST /auth/verify-email` (token from email) → 200
- ✅ `POST /auth/login` → 200 + JWT pair
- ✅ `GET /me` with JWT → 200
- ✅ Unverified user → 403 `email_not_verified` on protected routes
- ✅ `POST /auth/refresh` → 200 + new tokens; old token revoked
- ✅ `POST /auth/logout` → 204
- ✅ `POST /auth/change-password` → 200; other sessions revoked
- ✅ `POST /auth/forgot-password` → 202; reset email sent
- ✅ `POST /auth/login` with wrong password → 401 `invalid_credentials`
- ✅ Duplicate email registration → 409 `email_taken`
- ✅ Validation: password < 8 chars → 400, invalid email → 400
- ✅ Soft-deleted user (`DELETE /me`) can't login or use existing tokens
- ✅ BullMQ email consumer logs `email_logs` rows with `status='sent'`

**Business + Service (P1):**
- ✅ `POST /businesses` (with autoPost config) → 201
- ✅ `POST /businesses/:id/services` (price 60 THB → priceMinor 6000) → 201
- ✅ `POST /files/upload/logo` (multipart) → 201, file in MinIO
- ✅ OwnerGuard: user B accessing user A's business → 403 `not_owner`

**Facebook (P1):**
- ✅ `GET /facebook/oauth/start?businessId=...` → 302 to Facebook with state JWT

**AI Pipeline (P1):**
- ✅ `POST /posts` (manual) → 201, status=`draft`
- ✅ `POST /internal/ai/caption/callback` → transitions `draft` → `pending_approval`, sets caption
- ✅ `POST /internal/ai/image/callback` → marks AI image job as `succeeded`
- ✅ `POST /internal/ai/short_video/callback` → marks AI short_video job as `succeeded`
- ✅ `POST /internal/ai/job/fail` → increments `attempts`, sets `next_run_at` for retry, or marks `failed` at max attempts
- ✅ `POST /internal/ai/decide/callback` → creates `ContentPlan` (status=`planned`, decided_by=`ai`)
- ✅ `POST /content-plans/:id/materialize` (with OwnerGuard) → creates `Post` in `draft` status, marks plan `materialized`
- ✅ `PATCH /posts/:id` (in `pending_approval`) → 200, caption updated
- ✅ `POST /posts/:id/approve` (`pending_approval` → `approved`) → 200
- ✅ `POST /posts/:id/reject` after `approved` → 400 `invalid_state_transition`
- ✅ `PATCH /posts/:id` after `approved` → 400 `invalid_state_for_edit`
- ✅ `GET /content-plans?businessId=...` → returns plans list
- ✅ `GET /ai-jobs` → returns AI jobs list
- ✅ `GET /notifications` → returns notifications (empty initially)
- ✅ `POST /notifications/read-all` → returns `{updated: 0}`
- ✅ Internal token enforced — wrong `X-Internal-Token` → 401
- ✅ Cron jobs running: `dispatchDuePosts` (every minute), `expirePendingApprovals` (every minute), `retryAiJobs` (every 30s), `dailyDecide` (06:00 BKK), `materializeFixedSchedule` (hourly), `refreshFacebookTokens` (daily 1AM), `cleanupOrphanFiles` (daily 3AM)

---

## Phase P1 — Auth + Business + Facebook + AI Pipeline ✅ COMPLETE

> See P0 section above for the full breakdown of all P1 deliverables.

### Key design decisions made in P1

1. **Refresh token format: JWT** (not opaque) — 7d TTL signed with `JWT_REFRESH_SECRET`; `refresh_tokens.token_hash` stores sha256 for revocation
2. **Refresh rotation chain** with reuse detection — reuse triggers full chain revoke
3. **Global JwtAuthGuard** via `APP_GUARD` with `@Public()` skip
4. **Email via BullMQ** (queue + worker) — never sent inline from auth handlers
5. **Verify/reset link target: backend direct** — small HTML landing page with meta-refresh to `${FRONTEND_URL}/...`
6. **AES-256-GCM** for Facebook page tokens (`FB_TOKEN_ENCRYPTION_KEY` must be base64 32-byte)
7. **OwnerGuard via DataSource** — raw SQL keeps guard free of per-module repo dependencies; supports `business | service | post | facebook-page | content-plan`
8. **Redis-cached user access token** (10 min TTL) during OAuth flow — passed from callback to `listPages`/`connectPage`
9. **State JWT** for OAuth CSRF protection (10 min TTL, signed with access secret)
10. **EmailVerifiedGuard** runs DB lookup on every protected request (acceptable for MVP; optimize later)
11. **Post state machine** — `draft → generating/pending_approval → approved/rejected/expired → posted/failed`; transitions enforced via `PostStateMachine.assertTransition()`
12. **Content plans as separate table** — AI decisions create plans first, plans get materialized to posts via `POST /content-plans/:id/materialize`
13. **Internal AI callbacks** — all under `/internal/ai/*` with `InternalTokenGuard`; `Public()` decorator to bypass JWT
14. **Cron jobs** — `dailyDecide` (06:00 BKK), `materializeFixedSchedule` (hourly), `dispatchDuePosts` (every minute), `expirePendingApprovals` (every minute, SELECT + update in-place), `retryAiJobs` (every 30s), `refreshFacebookTokens` (daily 1AM), `cleanupOrphanFiles` (daily 3AM)
15. **AI job retry** — exponential backoff via `nextRunAt`, `maxAttempts=3`, status transitions: `queued → running → succeeded/failed`

---

## Phase P2 — Email Templates + Queue Processors ✅ COMPLETE

### Email Templates

- [x] `post-ready` — Post ready for approval (HTML + text, includes review URL + auto-rejection deadline)
- [x] `post-expired` — Post auto-rejected (timeout) or user-rejected
- [x] `post-posted` — Post published to Facebook (with page name + FB post ID + view URL)
- [x] `post-failed` — Post failed to publish (with error code + error message)

### Queue Processors (`src/modules/jobs/`)

- [x] `caption.processor.ts` — Calls `${AI_CAPTION_URL}/caption` with `X-Internal-Token`; on success sets `caption` + transitions to `pending_approval`; retries via `nextRunAt` (30s base), `maxAttempts=3`
- [x] `media.processor.ts` — Calls `${AI_MEDIA_URL}/generate` for `image` and `short_video` job types; 60s retry base
- [x] `dispatch-post.processor.ts` — Decrypts FB page token via `EncryptionService`; posts to `https://graph.facebook.com/{graphVersion}/{fbPageId}/feed`; on success transitions to `posted` + fires `post_posted` event; on failure transitions to `failed` + fires `post_failed` event
- [x] `refresh-token.processor.ts` — Deletes refresh tokens older than 30 days (configurable via job data)

### Event Hooks (`PostEventsService`)

- [x] `post_ready` — fired on `draft|generating → pending_approval` (via `posts.service.transition()` and `ai.service.captionCallback()`)
- [x] `post_posted` — fired on `approved → posted` (via `posts.service.transition()` and `dispatch-post.processor.ts`)
- [x] `post_failed` — fired on `→ failed` (via `posts.service.transition()` and `dispatch-post.processor.ts`)
- [x] `post_expired` — fired on `→ expired` or `→ rejected` (via `scheduler.expirePendingApprovals()` and `posts.service.transition()`)

### Auto_AI Flow (Phase 20)

- [x] When a post is created with `generationSource: "auto_ai"`, `PostsService`:
  1. Creates 3 `ai_jobs` rows (caption, image, short_video) with `status=queued`
  2. Enqueues all 3 to BullMQ (`caption` and `media` queues)
  3. Transitions post to `generating`
- [x] When a post is approved, the cron job `dispatchDuePosts` (every minute) enqueues to `dispatch-post` queue

---

## Phase P3 — Polish ⏳ TODO

- [ ] Rate limiting (login: 5 attempts / 15 min / IP) — use `@nestjs/throttler`
- [ ] Bull Board for queue monitoring (dev only)
- [ ] Error handling hardening
- [ ] Structured logging audit
- [ ] Integration tests (Jest + supertest)
- [ ] API documentation (Swagger/OpenAPI via `@nestjs/swagger`)
- [ ] Add a real AI caption service stub for end-to-end testing
- [ ] E-mail unsubscribe link handling (Unsubscribe entity already exists)
- [ ] FB page long-lived token refresh via real Graph API call

---

## Phase P4 — Polish ⏳ TODO

- [ ] Rate limiting (login: 5 attempts / 15 min / IP)
- [ ] Bull Board for queue monitoring (dev only)
- [ ] Error handling hardening
- [ ] Structured logging audit
- [ ] Integration tests
- [ ] API documentation (Swagger/OpenAPI)

---

## How to Get Started (Next Agent)

### 1. Start Docker Services

```bash
docker compose up -d
```

Wait for all containers to be healthy:
```bash
docker compose ps
```

### 2. Test Connections

```bash
cd backend/server
pnpm install --prefer-offline
pnpm test:connections
```

Expected output:
```
✅ PostgreSQL connected
✅ Redis connected
✅ MinIO connected
✅ SMTP connected
```

### 3. Run Migrations

```bash
pnpm migration:run
```

### 4. Build & Start Development Server

```bash
pnpm nest build
node dist/main.js
# or for watch mode (slower to start):
pnpm start:dev
```

Server runs at `http://localhost:3000`. Logs go to stdout.

### 5. Verify Health

```bash
curl http://localhost:3000/health
```

Expected response:
```json
{
  "status": "ok",
  "db": "ok",
  "redis": "ok",
  "storage": "ok",
  "version": "1.0.0",
  "uptime": 123
}
```

### 6. End-to-end smoke test (P1)

```bash
# Register
curl -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"alice@example.com","password":"correcthorsebatterystaple"}'

# Check Mailhog UI for verification email: http://localhost:8025
# Extract token from email, then:
curl -X POST http://localhost:3000/auth/verify-email \
  -H "Content-Type: application/json" \
  -d '{"token":"<token>"}'

# Login
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"alice@example.com","password":"correcthorsebatterystaple"}'

# Use the accessToken in Authorization: Bearer <token>
curl http://localhost:3000/me -H "Authorization: Bearer <accessToken>"
```

---

## Architecture Decisions Made

1. **Database**: PostgreSQL 15 with `citext` for case-insensitive email
2. **ORM**: TypeORM with forward-only migrations (no rollback)
3. **Money**: Stored as `bigint` in satang (minor units), e.g., 6000 = 60 THB
4. **Timestamps**: All `timestamptz` stored in UTC
5. **Soft Delete**: `deleted_at IS NULL` pattern
6. **Enums**: Text + CHECK constraint (not Postgres ENUM for flexibility)
7. **Tokens**: Hashed with SHA256 before storage (refresh tokens, verification tokens)
8. **Facebook Tokens**: Encrypted with AES-256-GCM (stored as bytea) — IV ‖ authTag ‖ ciphertext
9. **File Storage**: MinIO (S3-compatible) with presigned URLs for AI uploads
10. **Queue**: BullMQ with Redis backend
11. **Auth**: JWT access (15min) + JWT refresh (7d) with rotation chain + reuse detection
12. **Password**: argon2id hashing (64MB, 3 iter, parallelism 1)
13. **Logging**: pino structured JSON with request ID propagation
14. **OAuth State**: HMAC-SHA256 JWT (10min TTL) — separate from access tokens
15. **OAuth User Token Cache**: Redis (10min TTL) — bridges callback to listPages/connect
16. **Global Guards**: `GlobalJwtGuard` (APP_GUARD) + per-controller `EmailVerifiedGuard`
17. **Owner Guard**: `DataSource.query()` raw SQL (no per-module repo injection)

---

## Key Files Reference

| Purpose | Path |
|---|---|
| Docker services | `docker-compose.yml` |
| Environment config | `backend/server/.env` |
| Database entities | `backend/server/src/database/entities/` |
| Initial migration | `backend/server/src/database/migrations/1700000000000-InitSchema.ts` |
| AES-256-GCM encryption | `backend/server/src/common/crypto/encryption.service.ts` |
| JWT service | `backend/server/src/modules/auth/token.service.ts` |
| Global JWT guard | `backend/server/src/modules/auth/guards/global-jwt.guard.ts` |
| Email queue + processor | `backend/server/src/modules/email/` |
| AI module (callbacks + state machine) | `backend/server/src/modules/ai/` |
| Posts module (state machine + CRUD + auto_AI enqueue) | `backend/server/src/modules/posts/` |
| PostEventsService (notifications + emails on transitions) | `backend/server/src/modules/posts/post-events.service.ts` |
| Content plans module | `backend/server/src/modules/content-plans/` |
| AI jobs module | `backend/server/src/modules/ai-jobs/` |
| Notifications module | `backend/server/src/modules/notifications/` |
| Cron jobs | `backend/server/src/modules/scheduler/` |
| Queue processors (caption, media, dispatch, refresh-token) | `backend/server/src/modules/jobs/` |
| S3/MinIO service | `backend/server/src/modules/files/s3.service.ts` |
| Health check | `backend/server/src/modules/health/health.controller.ts` |
| Facebook OAuth service | `backend/server/src/modules/facebook/facebook.service.ts` |
| Owner guard (DataSource SQL) | `backend/server/src/common/guards/owner.guard.ts` |
| App bootstrap | `backend/server/src/main.ts` |
| Root module | `backend/server/src/app.module.ts` |
| API contract | `API.md` |
| Full documentation | `docs/` |

---

## Notes for Next Agent

- **Build**: `pnpm nest build` is slow on first run; use `node dist/main.js` after build. For dev iteration, `pnpm start:dev` works but watch startup is slow.
- **Docker on WSL**: If using WSL, ensure Docker Desktop is running and WSL integration is enabled. Use `/mnt/c/Program\ Files/Docker/Docker/resources/bin/docker.exe` from WSL.
- **MinIO bucket**: Auto-created on first connection by `S3Service.onModuleInit()`.
- **Migration naming**: Use timestamp format `YYYYMMDDHHMMSS-Description.ts`.
- **State machine**: Post status transitions must go through `PostStateMachine` (not direct updates). — P2
- **Owner guard**: Always use `@ResourceType('business' | 'service' | 'post' | 'facebook-page')` decorator with OwnerGuard.
- **Email queue**: Emails are queued via BullMQ in `EmailService.enqueue()`. Templates are simple HTML strings in `src/modules/email/templates/email.templates.ts`.
- **Facebook token storage**: All page access tokens MUST be stored encrypted via `EncryptionService.encrypt()`. Use `EncryptionService.decrypt()` to retrieve for posting (P3).
- **Refresh token storage**: Only `sha256(refreshJwt)` is stored in `refresh_tokens.token_hash`. The raw JWT is returned to client.
- **Reuse detection**: If a revoked refresh token is presented, ALL active refresh tokens for that user are revoked (treat as compromise).
- **Frontend links**: Verify/reset emails link to `${APP_URL}/auth/{action}?token=...` (backend direct). Backend serves a small HTML page that auto-redirects to `${FRONTEND_URL}/...`.
- **OwnerGuard uses DataSource.query()**: This is intentional to avoid per-module repo injection complexity. The query is parameterized and indexed.

---

**Questions?** Check `docs/00-INDEX.md` for full documentation index.

---

## 🗒️ Session Log

### 2026-06-28 (Today)

**Build mode session — added 2-AI plan + Postman collection + cleanup**

#### Changes
- ✅ **`postman/ERP-AI.postman_collection.json`** (NEW, 80 KB, 66 requests across 11 folders)
- ✅ **`postman/ERP-AI.postman_environment.json`** (NEW, 21 variables)
- ✅ **`postman/README.md`** (NEW, full import + flow walkthrough)
- ✅ **`postman/generate.py`** (NEW, source-of-truth for the collection — re-runnable)
- ✅ **`.gitignore`** updated — added AI stubs, postman local-only files, .claude/.opencode state, test artifacts

#### Today's verification (end-to-end with `curl`)
- ✅ Register → Verify → Login → Refresh → Logout → Change-password
- ✅ Businesses (CRUD + logo upload + auto-post)
- ✅ Services (CRUD with price→satang)
- ✅ Posts (manual): create, list, edit, approve, reject, soft-delete
- ✅ Internal AI callbacks (with manual `INSERT INTO ai_jobs`)
  - Caption callback transitions post → `pending_approval`
  - Fires `post_ready` notification + email
- ✅ Cross-user forbidden (OwnerGuard): Bob → Alice → 403 `not_owner`
- ✅ Negative tests: 401, 403, 400, 409 all working
- ✅ Email + notification + email_logs all populated

#### What's still broken (known gaps for next session)
- 🔴 `dailyDecide` cron is a stub (line 32-41 of `scheduler.service.ts`) — just logs, never calls AI, never creates plan
- 🔴 `materializeFixedSchedule` cron is a stub — same
- 🔴 `caption.processor.ts` calls `${AI_CAPTION_URL}/caption` → ECONNREFUSED (no AI service)
- 🔴 `media.processor.ts` calls `${AI_MEDIA_URL}/generate` → ECONNREFUSED
- 🔴 `auto_ai` posts get stuck in `generating` for ~90s then jobs marked `failed`
- 🔴 Facebook dispatch needs real page token (worker code is correct, untestable without real FB)

#### Confirmed next-session plan (not implemented yet)
1. **AI Decision Service** (stub) at `backend/ai-stubs/decision-caption-service/` (port 4001)
   - `POST /decide` — returns `{ shouldPost: false, reasoning: "..." }` (per user: "decision by AI will not trigger")
   - `POST /caption` — returns static caption with `{postType}` + `{businessName}` interpolated
2. **AI Content Service** (stub) at `backend/ai-stubs/content-service/` (port 4002)
   - `POST /generate` — uploads placeholder PNG to MinIO at startup, returns same `fileId` per call
3. **Update `dailyDecide` cron** to actually create `content_plans` row + call `${AI_DECISION_URL}/decide` + wait for callback
4. **Update `materializeFixedSchedule` cron** to create plans directly in DB (no AI needed)
5. **Update `app.config.ts` / `.env`**: keep 3 vars (`AI_DECISION_URL`, `AI_CAPTION_URL`, `AI_MEDIA_URL`) but point `AI_DECISION_URL` + `AI_CAPTION_URL` to same port 4001
6. **Add `pnpm-workspace.yaml`** + `concurrently` at root for `pnpm dev:all` to start backend + 2 stubs together
7. **Add health checks to Postman collection** (`GET http://localhost:4001/health` and `:4002/health`)
8. **Update PROGRESS.md** to P2.5 (AI stubs complete) when done

#### Today's open questions (answered by user, parked)
- **A1:** Fixed-schedule cron → keep as stub for now (manual materialize from Postman). ✅
- **A2:** Content stub: pre-upload placeholder to MinIO at startup, return real `fileId` ✅
- **A3:** Same fileId every call ✅
- **A4:** Architecture: separate monorepo folders (`backend/ai-stubs/{decision-caption-service,content-service}`) ✅
- **A5:** Add Postman health-checks for AI stubs ✅ (will do next session)
- **A6:** Don't add to `docker-compose.yml` yet — run on host via `pnpm dev` ✅
- **A7:** Stubs port numbers: keep existing 4001 + 4002 ✅

#### Files of interest
- `backend/server/src/modules/scheduler/scheduler.service.ts:32-41` — `dailyDecide` stub (target for next session)
- `backend/server/src/modules/scheduler/scheduler.service.ts:43-54` — `materializeFixedSchedule` stub
- `backend/server/src/modules/jobs/caption.processor.ts:51-65` — outbound fetch to AI
- `backend/server/src/modules/jobs/media.processor.ts:51-65` — outbound fetch to AI
- `backend/server/src/modules/ai/ai.service.ts:64-87` — `decide()` already accepts a `DecideDto`; just need to update the cron to call it
- `docs/contracts/AI-DECISION.md` — full payload spec for what AI service should accept/return
- `postman/ERP-AI.postman_collection.json` — 66 requests ready to import into Postman

**Next session target: implement the 2-AI stubs + wire `dailyDecide` + `materializeFixedSchedule` + test end-to-end with Postman.**

