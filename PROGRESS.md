# Project Progress — ERP-AI (MarketMate)

> Last updated: 2026-06-27
> Current Phase: **P0 Complete** (Foundation)
> Next Phase: **P1** (Auth + Business + Facebook)

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

- [x] `app.config.ts` — App settings, JWT secrets, AI service URLs
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

**Guards:**
- [x] `JwtAuthGuard` — Verify JWT access token (HS256, 15min TTL)
- [x] `InternalTokenGuard` — Verify `X-Internal-Token` header for AI callbacks
- [x] `OwnerGuard` — Check resource ownership (business/post/service)
- [x] `EmailVerifiedGuard` — Block unverified users from protected endpoints

**Decorators:**
- [x] `@CurrentUser` — Extract user from request
- [x] `@Public` — Skip auth for public endpoints
- [x] `@ResourceType` — Specify resource type for OwnerGuard

**Filters:**
- [x] `AllExceptionsFilter` — Standardized error response with reqId

**Interceptors:**
- [x] `RequestIdInterceptor` — Generate/propagate X-Request-Id
- [x] `LoggingInterceptor` — pino request logging with duration

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

### App Wiring

- [x] `app.module.ts` — ConfigModule, TypeOrmModule, ScheduleModule, BullModule, Redis provider
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

---

## Phase P1 — Auth + Business + Facebook ⏳ TODO

### Auth Module (`src/modules/auth/`)

- [ ] `auth.module.ts`
- [ ] `auth.service.ts`
- [ ] `auth.controller.ts`
- [ ] `POST /auth/register` — argon2id hash, INSERT user, enqueue verify-email
- [ ] `POST /auth/login` — verify password, issue JWT (15min) + opaque refresh token (7d)
- [ ] `POST /auth/refresh` — rotate refresh token chain
- [ ] `POST /auth/logout` — revoke current refresh token
- [ ] `POST /auth/forgot-password` — generate reset token (1h TTL), enqueue email
- [ ] `POST /auth/reset-password` — verify token, update password, revoke all tokens
- [ ] `POST /auth/verify-email` — verify token, set `email_verified_at`
- [ ] `POST /auth/change-password` — verify old password, update new

### Users Module (`src/modules/users/`)

- [ ] `users.module.ts`
- [ ] `users.service.ts`
- [ ] `users.controller.ts`
- [ ] `GET /me` — Return current user info
- [ ] `DELETE /me` — Soft delete user + revoke tokens

### Businesses Module (`src/modules/businesses/`)

- [ ] `businesses.module.ts`
- [ ] `businesses.service.ts`
- [ ] `businesses.controller.ts`
- [ ] `POST /businesses` — Create business (multipart for logo)
- [ ] `GET /businesses` — List user's businesses
- [ ] `GET /businesses/:id` — Get business detail
- [ ] `PATCH /businesses/:id` — Update business
- [ ] `DELETE /businesses/:id` — Soft delete
- [ ] `POST /businesses/:id/logo` — Upload/change logo
- [ ] `PATCH /businesses/:id/auto-post` — Update auto-post config

### Services Module (`src/modules/services/`)

- [ ] `services.module.ts`
- [ ] `services.service.ts`
- [ ] `services.controller.ts`
- [ ] `POST /businesses/:id/services` — Create service (multipart for image)
- [ ] `GET /businesses/:id/services` — List services (with filters)
- [ ] `GET /services/:id` — Get service detail
- [ ] `PATCH /services/:id` — Update service
- [ ] `DELETE /services/:id` — Soft delete

### Facebook Module (`src/modules/facebook/`)

- [ ] `facebook.module.ts`
- [ ] `facebook.service.ts`
- [ ] `facebook.controller.ts`
- [ ] `GET /facebook/oauth/start` — Redirect to Facebook OAuth
- [ ] `GET /facebook/oauth/callback` — Handle callback, exchange code
- [ ] `GET /facebook/pages` — List pages from Facebook API
- [ ] `POST /businesses/:id/facebook-pages` — Connect page (encrypt token AES-GCM)
- [ ] `DELETE /businesses/:id/facebook-pages/:pageId` — Disconnect page
- [ ] Facebook Graph API client (for posting)

### Email Module (`src/modules/email/`)

- [ ] `email.module.ts`
- [ ] `email.service.ts`
- [ ] SMTP transport setup (Mailhog dev / SES prod)
- [ ] Email templates: `verify-email`, `reset-password`
- [ ] Queue email jobs to BullMQ

---

## Phase P2 — AI Pipeline + Approval + Email ⏳ TODO

### AI Module (`src/modules/ai/`)

- [ ] `ai.module.ts`
- [ ] `ai.service.ts`
- [ ] `ai.controller.ts`
- [ ] `POST /internal/ai/decide/callback` — AI Decision callback (InternalTokenGuard)
- [ ] `POST /internal/ai/caption/callback` — AI Caption callback
- [ ] `POST /internal/ai/image/callback` — AI Image callback
- [ ] `POST /internal/ai/short_video/callback` — AI Video callback
- [ ] State machine transitions on callback

### Posts Module (`src/modules/posts/`)

- [ ] `posts.module.ts`
- [ ] `posts.service.ts`
- [ ] `posts.controller.ts`
- [ ] `state-machine.ts` — `PostStateMachine.transition()` with allowed transitions
- [ ] `POST /businesses/:id/posts` — Manual generation (enqueue caption + media jobs)
- [ ] `GET /businesses/:id/posts` — List with filters (status, postType, date range)
- [ ] `GET /posts/:id` — Detail with media + featured services
- [ ] `PATCH /posts/:id` — Edit caption (pending_approval only)
- [ ] `POST /posts/:id/approve` — Transition with optional caption/scheduledAt edit
- [ ] `POST /posts/:id/reject` — Transition with optional reason

### Email Templates (continued)

- [ ] `post-ready` — Post ready for approval
- [ ] `post-expired` — Post auto-rejected (timeout)
- [ ] `post-posted` — Post published to Facebook
- [ ] `post-failed` — Post failed after retries

---

## Phase P3 — Full Automation ⏳ TODO

### Queue Processors (`src/jobs/processors/`)

- [ ] `caption.processor.ts` — Call AI Caption Service
- [ ] `media.processor.ts` — Generate presigned URL → Call AI Media Service
- [ ] `dispatch-post.processor.ts` — Post to Facebook Graph API
- [ ] `email.processor.ts` — Send email via SMTP
- [ ] `refresh-token.processor.ts` — Cleanup expired tokens

### Cron Jobs (`src/scheduler/`)

- [ ] `daily-decide.cron.ts` — 06:00 BKK, query businesses, call AI Decision
- [ ] `materialize-fixed-schedule.cron.ts` — Hourly, create content_plans from fixed_schedule_rules
- [ ] `dispatch-due-posts.cron.ts` — Every minute, dispatch approved posts
- [ ] `expire-pending-approvals.cron.ts` — Every minute, auto-reject expired posts (SELECT FOR UPDATE)
- [ ] `ai-job-retry.cron.ts` — Every 30s, retry failed AI jobs (exponential backoff)
- [ ] `fb-token-refresh.cron.ts` — Daily, refresh Facebook tokens expiring < 7 days
- [ ] `cleanup-orphan-files.cron.ts` — Daily, delete unreferenced files
- [ ] `drain-email-queue.cron.ts` — Every minute, send queued emails

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

### 4. Start Development Server

```bash
pnpm start:dev
```

Server runs at `http://localhost:3000`

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

---

## Architecture Decisions Made

1. **Database**: PostgreSQL 15 with `citext` for case-insensitive email
2. **ORM**: TypeORM with forward-only migrations (no rollback)
3. **Money**: Stored as `bigint` in satang (minor units), e.g., 6000 = 60 THB
4. **Timestamps**: All `timestamptz` stored in UTC
5. **Soft Delete**: `deleted_at IS NULL` pattern
6. **Enums**: Text + CHECK constraint (not Postgres ENUM for flexibility)
7. **Tokens**: Hashed with SHA256 before storage (refresh tokens, verification tokens)
8. **Facebook Tokens**: Encrypted with AES-256-GCM (stored as bytea)
9. **File Storage**: MinIO (S3-compatible) with presigned URLs for AI uploads
10. **Queue**: BullMQ with Redis backend
11. **Auth**: JWT access (15min) + opaque refresh (7d) with rotation
12. **Password**: argon2id hashing
13. **Logging**: pino structured JSON with request ID propagation

---

## Key Files Reference

| Purpose | Path |
|---|---|
| Docker services | `docker-compose.yml` |
| Environment config | `backend/server/.env` |
| Database entities | `backend/server/src/database/entities/` |
| Initial migration | `backend/server/src/database/migrations/1700000000000-InitSchema.ts` |
| S3/MinIO service | `backend/server/src/modules/files/s3.service.ts` |
| Health check | `backend/server/src/modules/health/health.controller.ts` |
| App bootstrap | `backend/server/src/main.ts` |
| Root module | `backend/server/src/app.module.ts` |
| API contract | `API.md` |
| Full documentation | `docs/` |

---

## Notes for Next Agent

- **Build timeout**: `pnpm build` may timeout on first run. Use `npx tsc --noEmit` to check types.
- **Docker on WSL**: If using WSL, ensure Docker Desktop is running and WSL integration is enabled.
- **MinIO bucket**: Auto-created on first connection by `S3Service.onModuleInit()`.
- **Migration naming**: Use timestamp format `YYYYMMDDHHMMSS-Description.ts`.
- **State machine**: Post status transitions must go through `PostStateMachine` (not direct updates).
- **Owner guard**: Always use `@ResourceType('business')` decorator with OwnerGuard.
- **Email queue**: Emails should be queued via BullMQ, not sent synchronously.

---

**Questions?** Check `docs/00-INDEX.md` for full documentation index.
