# MarketMate — API Contract

## Conventions

### Base URL
```
http://localhost:3000
```

### Authentication
- All endpoints (except `/auth/*`, `/health`) require `Authorization: Bearer <accessToken>`.
- Access tokens expire in **15 min**; refresh tokens in **7 days**.
- Use `/auth/refresh` to renew.

### Timestamps
- All timestamps are **ISO 8601** in UTC: `"2026-06-26T13:45:00.000Z"`.

### Pagination
- Query params: `?page=1&limit=20` (default `page=1`, `limit=20`, max `limit=100`).
- Response includes: `{ data: T[], total, page, limit }`.

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

| HTTP | Code | Meaning |
|---|---|---|
| 400 | `bad_request` | Malformed request |
| 401 | `unauthorized` | Missing / invalid token |
| 403 | `forbidden` | Email not verified, or not owner |
| 404 | `not_found` | Resource not found |
| 409 | `conflict` | Duplicate (e.g. email taken) |
| 422 | `validation_failed` | Body / params failed validation |
| 429 | `rate_limited` | Too many requests |
| 500 | `internal_error` | Server error |

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
  "user": { "id": "uuid", "email": "user@example.com" },
  "accessToken": "jwt",
  "refreshToken": "jwt"
}
```

**Errors** `401 invalid_credentials` | `403 email_not_verified`

---

### POST `/auth/refresh`
**Body**
```json
{ "refreshToken": "jwt" }
```

**Response** `200`
```json
{ "accessToken": "jwt", "refreshToken": "jwt" }
```

**Errors** `401 invalid_token`

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

**Errors** `401 invalid_or_expired_token`

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

---

### POST `/auth/logout`
**Body**
```json
{ "refreshToken": "jwt" }
```

**Response** `204`

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

`currency` is always `"THB"` (MVP). Backend stores `price_minor` as bigint (e.g., 60 THB → 6000 satang).

**Response** `201`
```json
{ "service": { /* Service */ } }
```

---

### GET `/businesses/:id/services`
**Query** — `?active=true&page=1&limit=20`

**Response** `200`
```json
{
  "services": [ /* Service[] */ ],
  "total": 0,
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

### GET `/facebook/oauth/start`
**Query** — `?businessId=uuid`

**Response** `302` → redirect to Facebook OAuth URL.

---

### GET `/facebook/oauth/callback`
**Query** — `?code=string&state=string`

**Response** `302` → redirect to `/businesses/:id?fb=connected`

---

### GET `/facebook/pages`
**Query** — `?businessId=uuid`

**Response** `200`
```json
{
  "pages": [
    { "fbPageId": "string", "pageName": "string", "pictureUrl": "string | null" }
  ]
}
```

---

### POST `/businesses/:id/facebook-pages`
**Body**
```json
{ "fbPageId": "string" }
```

**Response** `201`
```json
{ "facebookPage": { /* FacebookPage */ } }
```

---

### DELETE `/businesses/:id/facebook-pages/:pageId`
**Response** `204`

---

## Posts

### GET `/businesses/:id/posts`
**Query** — `?status=pending_approval&postType=promotion&from=2026-06-01&to=2026-06-30&page=1&limit=20`

- `status`: filter (comma-separated เช่น `posted,rejected`)
- `postType`: filter
- `from`, `to`: filter `postedAt` range (ISO date)
- `page`, `limit`: pagination (max limit=100)

**Response** `200`
```json
{
  "posts": [ /* Post[] */ ],
  "total": 0,
  "page": 1,
  "limit": 20
}
```

---

### GET `/posts/:id`
**Response** `200`
```json
{ "post": { /* Post */ } }
```

---

### PATCH `/posts/:id`
Edit caption only (while in `pending_approval`).

**Body**
```json
{ "caption": "string" }
```

**Response** `200`
```json
{ "post": { /* Post */ } }
```

**Errors** `409 invalid_state` (not in `pending_approval`)

---

### POST `/posts/:id/approve`
Approve the post. Optionally edit `caption` and/or `scheduledAt` before approving.

**Body**
```json
{
  "caption": "string (optional)",
  "scheduledAt": "2026-06-27T20:00:00.000Z"
}
```

- `caption` is optional — if omitted, use AI's caption
- `scheduledAt` is optional — if omitted, use AI's suggested time
- `scheduledAt` must be in the future (UTC)
- Only works when `status = "pending_approval"`

**Response** `200`
```json
{ "post": { "id": "uuid", "status": "approved" } }
```

**Errors** `409 invalid_state` | `422 validation_failed` (e.g., scheduledAt in the past)

---

### POST `/posts/:id/reject`
Reject the post. `status` will become `"rejected"` with `rejectionReason = "user_rejected"`.

**Body**
```json
{ "reason": "string (optional)" }
```

**Response** `200`
```json
{ "post": { "id": "uuid", "status": "rejected" } }
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

## Health

### GET `/health`
**Response** `200`
```json
{ "status": "ok", "db": "ok", "redis": "ok", "storage": "ok" }
```

**Response** `503` — one or more subsystems unhealthy.
