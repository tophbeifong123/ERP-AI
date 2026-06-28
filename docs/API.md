# MarketMate — API Contract

## Conventions

### Base URL
```
http://localhost:3000
```

### Authentication
- All endpoints (except `/auth/*` and `/health`) require `Authorization: Bearer <accessToken>`.
- Access tokens expire in **15 min**; refresh tokens in **7 days**.
- Refresh tokens are **signed JWTs** (not opaque) and are rotated on every use.
- Use `/auth/refresh` to renew; passing a revoked/expired refresh token returns `401 invalid_token`.
- If a revoked refresh token is presented again (reuse), the **entire refresh-token chain for that user is revoked** (compromise response).

### Timestamps
- All timestamps are **ISO 8601** in UTC: `"2026-06-26T13:45:00.000Z"`.

### Pagination
- Query params: `?page=1&limit=20` (default `page=1`, `limit=20`, max `limit=100`).
- Response includes: `{ services: T[], total, page, limit }`.

### Error Format
```json
{
  "statusCode": 422,
  "error": "validation_failed",
  "message": "Validation failed",
  "details": [
    { "field": "email", "message": "must be a valid email" }
  ]
}
```

### Common Error Codes

| HTTP | Error key | Meaning |
|---|---|---|
| 400 | `Bad Request` | Validation failure (message is array of class-validator errors) |
| 400 | `invalid_or_expired_token` | Verify/reset/refresh token invalid |
| 401 | `Unauthorized` | Missing / invalid Authorization header or JWT |
| 401 | `invalid_credentials` | Login: wrong email or password |
| 401 | `invalid_token` | Refresh: token invalid or revoked |
| 401 | `email_not_verified` | User hasn't clicked the verify-email link |
| 401 | `Unauthorized` (message: "Not business owner") | OAuth start by non-owner |
| 403 | `Forbidden` (message: "not_owner") | OwnerGuard: not resource owner |
| 403 | `Email not verified` | EmailVerifiedGuard blocked unverified user |
| 404 | `Not Found` (message: "Business/Service/Page not found") | Resource not found |
| 409 | `email_taken` | Duplicate registration |
| 415 | `unsupported_media_type` | Wrong MIME for file upload |
| 413 | `file_too_large` | File exceeds 5/10 MB limit |
| 500 | `internal_error` | Unhandled server error |

---

## Common Types

```ts
type File = {
  id: string;
  ownerId: string;
  kind: "logo" | "service_image" | "post_media" | "temp";
  storageKey: string;
  mime: string;
  sizeBytes: number;
  publicUrl: string;
  createdAt: ISODateTime;
};

type Business = {
  id: string;
  ownerId: string;
  name: string;
  industry: string;
  description: string;
  targetAudience: string;
  tone: string;
  keywords: string[];
  autoPost: {
    enabled: boolean;
    mode: "ai_decide" | "fixed_schedule" | null;
    postsPerWeekTarget: number;          // 1-14
    minGapDays: number;                 // 0-7
    fixedScheduleRules: { dayOfWeek: 0-6; time: "HH:mm" }[];
  };
  logo: File | null;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
};

type Service = {
  id: string;
  businessId: string;
  name: string;
  description: string;
  price: number;
  currency: "THB";
  image: File | null;
  isActive: boolean;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
};

type FacebookPage = {
  id: string;
  businessId: string;
  fbPageId: string;
  pageName: string;
  pictureUrl: string | null;
  tokenExpiresAt: ISODateTime;
  createdAt: ISODateTime;
};

type Post = {
  id: string;
  businessId: string;
  fbPageId: string | null;
  caption: string | null;
  status: "draft" | "generating" | "pending_approval" | "approved" | "posted" | "rejected" | "expired" | "failed";
  postType: "promotion" | "product_showcase" | "brand_awareness" | "event" | null;
  generationSource: "auto_ai" | "fixed_schedule" | "manual";
  scheduledAt: ISODateTime | null;        // UTC
  approvalDeadline: ISODateTime | null;   // = scheduledAt
  postedAt: ISODateTime | null;           // UTC
  fbPostId: string | null;
  rejectionReason: "user_rejected" | "timeout" | null;
  errorCode: string | null;
  errorMessage: string | null;
  media: PostMedia[];                     // 1 รายการ (image หรือ short_video)
  featuredServices: Service[];
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
};

type PostMedia = {
  id: string;
  kind: "image" | "short_video";
  file: File;
  orderIndex: number;
};

type AiJob = {
  id: string;
  postId: string;
  planId: string | null;
  type: "caption" | "image" | "short_video";
  status: "queued" | "running" | "succeeded" | "failed";
  attempts: number;
  maxAttempts: number;
  lastError: string | null;
  payload: Record<string, unknown>;
  result: Record<string, unknown> | null;
  nextRunAt: ISODateTime;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
};
```

---

## Auth

### POST `/auth/register`
Create a new user. Sends verification email.

**Body**
```json
{ "email": "user@example.com", "password": "string (min 8)" }
```

**Response** `201`
```json
{ "user": { "id": "uuid", "email": "user@example.com" }, "message": "verification email sent" }
```

**Errors** `409 email_taken` | `422 validation_failed`

---

### POST `/auth/login`
**Body**
```json
{ "email": "user@example.com", "password": "string" }
```

**Response** `200`
```json
{
  "user": { "id": "uuid", "email": "user@example.com", "emailVerifiedAt": "2026-06-26T13:45:00.000Z" },
  "accessToken": "jwt (HS256, 15min)",
  "refreshToken": "jwt (HS256, 7d)"
}
```

**Errors** `401 invalid_credentials` | `403 email_not_verified`

---

### POST `/auth/refresh`
Rotates the refresh token. The old refresh token is marked `revoked_at`. If the old token was already revoked (reuse detection), the **entire refresh-token chain for that user is revoked**.

**Body**
```json
{ "refreshToken": "jwt" }
```

**Response** `200`
```json
{ "accessToken": "jwt", "refreshToken": "jwt" }
```

**Errors** `401 invalid_token` (also includes "Refresh token reuse detected" when reuse is found)

---

### POST `/auth/forgot-password`
**Body**
```json
{ "email": "user@example.com" }
```

**Response** `202`
```json
{ "message": "reset email sent" }
```

---

### POST `/auth/reset-password`
**Body**
```json
{ "token": "string", "newPassword": "string (min 8)" }
```

**Response** `200`
```json
{ "message": "password reset" }
```

Revokes all refresh tokens for the user (forces re-login on all devices).

**Errors** `400 invalid_or_expired_token`

### GET `/auth/reset-password?token=xxx` (landing page)
Browser-facing landing page. Redirects (meta refresh) to `${FRONTEND_URL}/reset-password?token=xxx` (or `${FRONTEND_URL}/login?reset_error=missing_token` if no token). Returns HTML 200.

---

### POST `/auth/verify-email`
**Body**
```json
{ "token": "string" }
```

**Response** `200`
```json
{ "message": "verified" }
```

**Errors** `400 invalid_or_expired_token`

### GET `/auth/verify-email?token=xxx` (landing page)
Browser-facing landing page. Verifies the email and redirects (meta refresh) to `${FRONTEND_URL}/login?verified=1` on success or `?verify_error=1` on failure. Returns HTML 200.

### POST `/auth/logout` (Public)
**Body**
```json
{ "refreshToken": "jwt" }
```

**Response** `204`

---

### POST `/auth/change-password` (requires JWT)
**Body**
```json
{ "oldPassword": "string", "newPassword": "string (min 8)" }
```

**Response** `200`
```json
{ "message": "password changed" }
```

Revokes all other refresh tokens for the user (current device's token stays valid if `refreshToken` is also passed in the body).

**Errors** `401 invalid_credentials`

---

## Me

### GET `/me`
**Response** `200`
```json
{
  "id": "uuid",
  "email": "user@example.com",
  "emailVerifiedAt": "2026-06-26T13:45:00.000Z" | null,
  "createdAt": "2026-06-26T13:45:00.000Z"
}
```

---

### DELETE `/me` (soft delete + revoke all refresh tokens)
**Response** `204`

---

## Businesses

### POST `/businesses`
Create a business with auto-post config.

**Body** (multipart/form-data — `logo` is optional file)
```json
{
  "name": "string",
  "industry": "string",
  "description": "string",
  "targetAudience": "string",
  "tone": "friendly | professional | playful | luxurious | minimal",
  "keywords": ["string"],
  "autoPost": {
    "enabled": true,
    "mode": "ai_decide",                  // or "fixed_schedule"
    "postsPerWeekTarget": 3,              // 1-14
    "minGapDays": 1,                      // 0-7
    "fixedScheduleRules": []              // required when mode=fixed_schedule
  }
}
```

**Response** `201`
```json
{ "business": { /* Business */ } }
```

---

### GET `/businesses`
**Response** `200`
```json
{ "businesses": [ /* Business[] */ ] }
```

---

### GET `/businesses/:id`
**Response** `200`
```json
{ "business": { /* Business */ } }
```

**Errors** `404 not_found` | `403 forbidden`

---

### PATCH `/businesses/:id`
**Body** — `Partial<CreateBusinessDto>`

**Response** `200`
```json
{ "business": { /* Business */ } }
```

---

### DELETE `/businesses/:id`
**Response** `204`

---

### POST `/businesses/:id/logo`
**Body** — `multipart/form-data` (file, max 5MB, image/*)

**Response** `201`
```json
{ "file": { /* File */ } }
```

**Errors** `413 file_too_large` | `415 unsupported_media_type`

---

### PATCH `/businesses/:id/auto-post`
Update auto-post configuration (mode + cadence + fixed schedule).

**Body**
```json
{
  "enabled": true,
  "mode": "ai_decide",
  "postsPerWeekTarget": 3,
  "minGapDays": 1,
  "fixedScheduleRules": [
    { "dayOfWeek": 1, "time": "20:00" },
    { "dayOfWeek": 4, "time": "10:00" }
  ]
}
```

- `dayOfWeek`: 0=Sunday, 1=Monday, ..., 6=Saturday
- `time`: HH:mm (Asia/Bangkok)
- `fixedScheduleRules` required when `mode = "fixed_schedule"`

**Response** `200`
```json
{ "business": { /* Business */ } }
```

## Services

### POST `/businesses/:id/services`
**Body** (multipart/form-data — `image` is optional file)
```json
{
  "name": "string",
  "description": "string",
  "price": 60,               // THB (frontend) — backend stores as satang (bigint)
  "currency": "THB"
}
```

`currency` is always `"THB"` (MVP). Backend stores `price_minor` as bigint (e.g., 60 THB → 6000 satang). `price_minor` is serialized as a string when read from raw DB rows (e.g., `"6000"`); newly created entities return it as a number.

**Response** `201`
```json
{ "service": { "id": "uuid", "businessId": "uuid", "name": "Latte", "description": "...", "priceMinor": 6000, "currency": "THB", "imageFileId": null, "isActive": true, "createdAt": "...", "updatedAt": "...", "deletedAt": null } }
```

---

### GET `/businesses/:id/services`
**Query** — `?active=true&page=1&limit=20` (max `limit=100`)

**Response** `200`
```json
{
  "services": [
    { "id": "uuid", "name": "Latte", "priceMinor": "6000", "currency": "THB", "isActive": true, ... }
  ],
  "total": 1,
  "page": 1,
  "limit": 20
}
```

---

### GET `/services/:id`
**Response** `200`
```json
{ "service": { /* Service */ } }
```

---

### PATCH `/services/:id`
**Body** — `Partial<CreateServiceDto> & { isActive?: boolean }`

**Response** `200`
```json
{ "service": { /* Service */ } }
```

---

### DELETE `/services/:id`
**Response** `204`

---

## Facebook

### GET `/facebook/oauth/start` (requires JWT)
**Query** — `?businessId=uuid`

**Response** `302` → redirect to Facebook OAuth URL.

**Errors** `400 fb_not_configured` | `404 not_found` | `403 forbidden` (not business owner)

---

### GET `/facebook/oauth/callback` (Public)
**Query** — `?code=string&state=string`

**Response** `302` → redirect to `${FRONTEND_URL}/businesses/:id?fb=connected` (success) or `${FRONTEND_URL}/businesses?fb=error&msg=...` (failure)

The user access token (long-lived) is stored in Redis for 10 minutes, keyed by `fb:user_token:${userId}:${businessId}`.

---

### GET `/facebook/pages` (requires JWT)
**Query** — `?businessId=uuid`

**Response** `200`
```json
{
  "pages": [
    { "fbPageId": "string", "pageName": "string", "pictureUrl": "string | null" }
  ]
}
```

**Errors** `400 fb_session_expired` (need to restart OAuth)

---

### POST `/businesses/:id/facebook-pages` (requires JWT + OwnerGuard)
**Body**
```json
{ "fbPageId": "string" }
```

**Response** `201`
```json
{ "facebookPage": { "id": "uuid", "businessId": "uuid", "fbPageId": "string", "pageName": "string", "pictureUrl": "string | null", "tokenExpiresAt": "iso", "scopes": ["pages_show_list", "pages_manage_posts", "pages_read_engagement"], "createdAt": "...", "updatedAt": "...", "deletedAt": null } }
```

Page access token is encrypted with AES-256-GCM before storage.

**Errors** `400 fb_session_expired` | `404 fb_page_not_found`

---

### DELETE `/businesses/:id/facebook-pages/:pageId` (requires JWT + OwnerGuard)
**Response** `204` (soft-deletes the `facebook_pages` row)

---

## Posts

### POST `/posts` (requires JWT, EmailVerified)
Create a post manually or as the result of AI generation.

**Body**
```json
{
  "businessId": "uuid",
  "fbPageId": "uuid (optional)",
  "caption": "string (optional)",
  "postType": "promotion | product_showcase | brand_awareness | event (optional)",
  "generationSource": "auto_ai | fixed_schedule | manual",
  "scheduledAt": "2026-06-27T20:00:00.000Z (optional, UTC)",
  "approvalDeadline": "2026-06-28T20:00:00.000Z (optional, UTC)",
  "mediaIds": ["uuid (optional)"],
  "featuredServiceIds": ["uuid (optional)"]
}
```

**Response** `201`
```json
{ "post": { /* Post with status="draft" */ } }
```

---

### GET `/posts` (requires JWT, EmailVerified)
List posts with filters.

**Query** — `?businessId=uuid&status=pending_approval&postType=promotion&from=2026-06-01&to=2026-06-30`

**Response** `200`
```json
{ "posts": [ /* Post[] */ ] }
```

---

### GET `/posts/:id` (requires JWT, OwnerGuard)
**Response** `200`
```json
{
  "post": {
    "id": "uuid", "businessId": "uuid", "caption": "...", "status": "draft",
    "postType": "product_showcase", "generationSource": "manual",
    "scheduledAt": null, "approvalDeadline": null, "postedAt": null,
    "fbPostId": null, "rejectionReason": null, "errorCode": null, "errorMessage": null,
    "media": [], "aiJobs": []
  }
}
```

---

### PATCH `/posts/:id` (requires JWT, OwnerGuard)
Edit caption, scheduledAt, approvalDeadline, or featuredServiceIds. Only allowed in `draft` or `pending_approval`.

**Body**
```json
{
  "caption": "string (optional)",
  "scheduledAt": "iso (optional)",
  "approvalDeadline": "iso (optional)",
  "featuredServiceIds": ["uuid (optional)"]
}
```

**Response** `200`
```json
{ "post": { /* Post */ } }
```

**Errors** `400 invalid_state_for_edit` (not in `draft`/`pending_approval`)

---

### POST `/posts/:id/approve` (requires JWT, OwnerGuard)
Transition `pending_approval` → `approved`.

**Response** `200`
```json
{ "post": { "id": "uuid", "status": "approved" } }
```

**Errors** `400 invalid_state_transition`

---

### POST `/posts/:id/reject` (requires JWT, OwnerGuard)
Transition `pending_approval` → `rejected`.

**Body**
```json
{ "reason": "user_rejected | timeout (default: user_rejected)" }
```

**Response** `200`
```json
{ "post": { "id": "uuid", "status": "rejected", "rejectionReason": "user_rejected" } }
```

---

### DELETE `/posts/:id` (requires JWT, OwnerGuard)
Soft-delete the post. Returns 204.

---

## Content Plans

### GET `/content-plans` (requires JWT, EmailVerified)
List content plans (AI decisions).

**Query** — `?businessId=uuid&status=planned|materialized|cancelled&decidedBy=ai|user`

**Response** `200`
```json
{ "plans": [ /* ContentPlan[] */ ] }
```

---

### GET `/content-plans/:id` (requires JWT, EmailVerified)
**Response** `200`
```json
{ "plan": { /* ContentPlan */ } }
```

---

### POST `/content-plans/:id/materialize` (requires JWT, OwnerGuard)
Materialize the plan into a Post in `draft` status.

**Response** `200`
```json
{
  "plan": { /* updated plan with status="materialized" */ },
  "post": { /* new post */ }
}
```

---

### POST `/content-plans/:id/cancel` (requires JWT, OwnerGuard)
Cancel the plan (status → `cancelled`).

**Response** `200`
```json
{ "plan": { /* plan */ } }
```

---

## AI Jobs

### GET `/ai-jobs` (requires JWT, EmailVerified)
List AI jobs.

**Query** — `?type=caption|image|short_video&status=queued|running|succeeded|failed&postId=uuid`

**Response** `200`
```json
{ "jobs": [ /* AiJob[] */ ] }
```

---

### GET `/ai-jobs/:id` (requires JWT, EmailVerified)
**Response** `200`
```json
{ "job": { /* AiJob */ } }
```

---

### POST `/ai-jobs/:id/retry` (requires JWT, EmailVerified)
Re-queue a `failed` AI job (resets `attempts=0` and `nextRunAt=now`).

**Response** `200`
```json
{ "job": { /* updated job */ } }
```

---

## Notifications

### GET `/notifications` (requires JWT)
**Query** — `?type=post_ready|post_posted|post_failed|post_expired&unreadOnly=true`

**Response** `200`
```json
{ "notifications": [ /* Notification[] */ ] }
```

---

### GET `/notifications/:id` (requires JWT)
**Response** `200`
```json
{ "notification": { /* Notification */ } }
```

---

### PATCH `/notifications/:id/read` (requires JWT)
Mark a single notification as read.

**Response** `200`
```json
{ "notification": { /* Notification with readAt set */ } }
```

---

### POST `/notifications/read-all` (requires JWT)
Mark all unread notifications as read.

**Response** `200`
```json
{ "updated": 0 }
```

---

## Manual Post Generation

### POST `/businesses/:id/posts`
User-triggered post generation. Triggers the same AI pipeline as auto mode. Works in both auto and manual business modes (for ad-hoc posts like promotions).

**Body**
```json
{
  "postType": "promotion | product_showcase | brand_awareness | event",
  "featuredServiceIds": ["uuid"],
  "captionHint": "string (optional)",
  "scheduleAt": "2026-06-27T20:00:00.000Z (optional, UTC)"
}
```

All fields except `postType` are optional. If `scheduleAt` is omitted, the system calls the AI Decision Service to pick a time.

**Response** `202`
```json
{
  "post": { "id": "uuid", "status": "generating" },
  "message": "post is being generated, you will be notified by email"
}
```

---

## Internal AI Callbacks

These endpoints are called by the **AI services** (Decision / Caption / Media). Protected by `X-Internal-Token` header (not user JWT). See [`docs/06-AUTH.md`](./docs/06-AUTH.md) section 3.

**All callbacks require:** `X-Internal-Token: <shared secret>`

### POST `/internal/ai/decide/callback`
Called by **AI Decision Service** with the result.

**Body**
```json
{
  "planId": "uuid",
  "decision": {
    "shouldPost": true,
    "reasoning": "โพสต์ 2 ครั้งในสัปดาห์นี้...",
    "suggestedScheduledAt": "2026-06-27T11:00:00.000Z",
    "postType": "promotion",
    "featuredServiceIds": ["uuid"],
    "captionHint": "โปรโมชันวันศุกร์"
  }
}
```

Or for `shouldPost: false`:
```json
{
  "planId": "uuid",
  "decision": {
    "shouldPost": false,
    "reasoning": "โพสต์ครบ 3 ครั้ง/สัปดาห์แล้ว"
  }
}
```

See full contract: [`docs/contracts/AI-DECISION.md`](./docs/contracts/AI-DECISION.md)

**Response** `200`

---

### POST `/internal/ai/caption/callback`
Called by **AI Caption Service** with the generated caption.

**Body**
```json
{
  "jobId": "uuid",
  "result": {
    "caption": "ศุกร์นี้พบกับโปรโปรโมชันสุดคุ้ม!..."
  }
}
```

Or on error:
```json
{
  "jobId": "uuid",
  "error": { "code": "model_error", "message": "upstream timeout" }
}
```

See full contract: [`docs/contracts/AI-CAPTION.md`](./docs/contracts/AI-CAPTION.md)

**Response** `200`

---

### POST `/internal/ai/image/callback`
Called by **AI Media Service** after image generation + upload to MinIO.

**Body**
```json
{
  "jobId": "uuid",
  "result": {
    "storageKey": "posts/media/2026/06/27/abc.png",
    "publicUrl": "https://cdn.example.com/posts/media/2026/06/27/abc.png",
    "width": 1080,
    "height": 1080,
    "durationSec": null
  }
}
```

See full contract: [`docs/contracts/AI-MEDIA.md`](./docs/contracts/AI-MEDIA.md)

**Response** `200`

---

### POST `/internal/ai/short_video/callback`
Called by **AI Media Service** after short video generation + upload.

**Body**
```json
{
  "jobId": "uuid",
  "result": {
    "storageKey": "posts/media/2026/06/27/abc.mp4",
    "publicUrl": "https://cdn.example.com/posts/media/2026/06/27/abc.mp4",
    "width": 1080,
    "height": 1920,
    "durationSec": 15
  }
}
```

See full contract: [`docs/contracts/AI-MEDIA.md`](./docs/contracts/AI-MEDIA.md)

**Response** `200`

---

## Files

### POST `/files/upload/:kind` (multipart/form-data, requires JWT)
Direct multipart upload. `kind` is one of `logo | service_image | post_media`. Field name is `file`.

**Limits**
- Max size: 10 MB (logos inside `POST /businesses/:id/logo` are capped at 5 MB)
- MIME types: `image/png`, `image/jpeg`, `image/jpg`, `image/webp`, `video/mp4`

**Response** `201`
```json
{ "file": { "id": "uuid", "ownerId": "uuid", "kind": "logo", "storageKey": "logos/2026/06/27/uuid.png", "mime": "image/png", "sizeBytes": 12345, "publicUrl": "http://localhost:9000/erp-ai/logos/2026/06/27/uuid.png", "createdAt": "..." } }
```

**Errors** `400 Bad Request` (no file, invalid kind, invalid MIME)

---

### POST `/files/presigned/:kind` (requires JWT)
Returns a presigned PUT URL for direct-to-S3 upload (useful for large files / AI services).

**Response** `200`
```json
{ "presignedUrl": "https://...", "storageKey": "...", "publicUrl": "...", "expiresAt": "..." }
```

---

## Health

### GET `/health` (public)
**Response** `200`
```json
{ "status": "ok", "db": "ok", "redis": "ok", "storage": "ok", "version": "1.0.0", "uptime": 123 }
```

Returns `503` with `status: "degraded"` if any check fails (and an `errors` object).

**Response** `503` — one or more subsystems unhealthy.

---

## Post Lifecycle Notifications & Emails

When a post transitions between states, the system automatically:

1. Inserts a row into the `notifications` table for the business owner
2. Enqueues an email to the `email` BullMQ queue (sent via SMTP)

| Event | Trigger | Notification type | Email template | When |
|---|---|---|---|---|
| `post_ready` | post enters `pending_approval` | `post_ready` | `post-ready` | AI caption done OR user edits and submits for review |
| `post_posted` | post enters `posted` | `post_posted` | `post-posted` | Facebook Graph API returns 200 with `id` |
| `post_failed` | post enters `failed` | `post_failed` | `post-failed` | Facebook Graph API returns error OR all retries exhausted |
| `post_expired` | post enters `rejected` or `expired` | `post_expired` | `post-expired` | User rejects OR auto-reject cron after `approval_deadline` |

The event bus is implemented by `PostEventsService` (`src/modules/posts/post-events.service.ts`) which is called from:
- `PostsService.transition()` (for `approve`/`reject`/manual `transition()`)
- `AiService.captionCallback()` (when caption is generated)
- `SchedulerService.expirePendingApprovals()` (for auto-expiry)
- `DispatchPostProcessor.process()` (for `posted` and `failed`)

### Email template payload shape

```json
// post-ready
{
  "businessName": "Acme Coffee",
  "postId": "uuid",
  "caption": "...",
  "postType": "product_showcase",
  "approvalDeadline": "2026-06-28T20:00:00.000Z"
}

// post-posted
{
  "businessName": "Acme Coffee",
  "postId": "uuid",
  "caption": "...",
  "fbPostId": "123_456",
  "pageName": "Acme Coffee Page",
  "viewUrl": "https://facebook.com/123_456"
}

// post-failed
{
  "businessName": "Acme Coffee",
  "postId": "uuid",
  "caption": "...",
  "errorCode": "E190",
  "errorMessage": "Invalid OAuth access token"
}

// post-expired
{
  "businessName": "Acme Coffee",
  "postId": "uuid",
  "caption": "...",
  "reason": "timeout" | "user_rejected"
}
```

---

## Auto-AI Pipeline (Background Jobs)

When a post is created with `generationSource: "auto_ai"`, the following happens **synchronously** in the request:

1. `PostsService.create()` inserts the post in `draft` status
2. `PostsService.enqueueAiPipeline(postId)` creates 3 `ai_jobs` (caption, image, short_video)
3. All 3 jobs are enqueued to BullMQ (`caption` and `media` queues)
4. The post is transitioned to `generating`

### Caption job (`caption.processor.ts`)

Picks up caption jobs, calls `${AI_CAPTION_URL}/caption` with:
```json
{
  "jobId": "uuid",
  "postId": "uuid",
  "businessId": "uuid",
  "postType": "product_showcase",
  "captionHint": "...",
  "callbackUrl": "http://localhost:3000/internal/ai/caption/callback"
}
```

On success: sets `caption` on the post, transitions to `pending_approval`, marks AI job `succeeded`.
On failure: increments `attempts`, sets `nextRunAt = now + 30s`, re-queues (max 3 attempts). At max attempts, marks `failed`.

### Media job (`media.processor.ts`)

Same pattern as caption but calls `${AI_MEDIA_URL}/generate` for both `image` and `short_video` types. 60s retry base.

### Dispatch job (`dispatch-post.processor.ts`)

Triggered by the `dispatchDuePosts` cron (every minute) for posts with `status='approved' AND scheduled_at <= now()`.

1. Decrypts the Facebook page token via `EncryptionService`
2. POSTs to `https://graph.facebook.com/{graphVersion}/{fbPageId}/feed` with `{ message, access_token }`
3. On success: stores `fbPostId`, sets `status='posted'`, sets `postedAt = now`, fires `post_posted` event
4. On failure: sets `status='failed'`, stores `errorCode` and `errorMessage`, fires `post_failed` event

### Refresh-token cleanup job (`refresh-token.processor.ts`)

Triggered by the `enqueueRefreshTokenCleanup` cron (daily at 2 AM). Deletes all `refresh_tokens` rows with `expires_at < now - 30 days`. Configurable via job data `{ olderThanDays: 30 }`.
