# Contract: AI Media Service (Image + Short Video)

> สำหรับทีม **ai-generate-media dev** (หรือทีมที่ดูแล n8n workflow)
> เอกสารนี้อธิบาย API contract ระหว่าง Backend ↔ AI Media Service
> Media Service รับผิดชอบทั้ง **image** และ **short_video** ใน MVP
>
> **อัปเดตล่าสุด (มิ.ย. 2026):** ระบบจริงใช้ **n8n workflow** เป็น media service ไม่ใช่ standalone HTTP service — contract นี้ยังเป็น schema จริง (เพราะ n8n ใช้ schema นี้กับ Vertex AI โดยตรง) แต่ flow คือ: **Backend → n8n webhook → Vertex AI → MinIO** แทนที่จะเป็น **Backend → AI service → MinIO**

---

## ภาพรวม

AI Media Service มีหน้าที่สร้าง **สื่อภาพ (image)** หรือ **วิดีโอสั้น (short_video, ≤15 วินาที)** สำหรับโพสต์

**สำคัญ:** Backend จะ **ออก Presigned URL** ให้ AI ใช้อัปโหลดไฟล์เข้า MinIO โดยตรง AI ไม่ต้องมี MinIO credentials

```
┌──────────────┐                              ┌──────────────────────┐
│   Backend    │ ── POST /webhook/generate-media──▶│  n8n workflow     │
│   (NestJS)   │  (X-Internal-Token)          │  (AI Media Service) │
│              │                              │                      │
│              │                              │  1. Submit Veo/GenAI │
│              │                              │     long-running op  │
│              │                              │  2. Poll until done  │
│              │                              │  3. Download from    │
│              │                              │     GCS public URL   │
│              │                              │  4. PUT → MinIO       │
│              │                              │     (presigned URL)  │
│              │ ◀── POST callback ─────────  │                      │
└──────────────┘     ┌────────────────┐        └──────────────────────┘
                     │   MinIO / S3   │
                     │  (object store)│
                     └────────────────┘
```

### 0. Enable/disable media generation

Media generation is **off by default**. Backend reads `ENABLE_AI_MEDIA` from `backend/server/.env`:

- `ENABLE_AI_MEDIA=false` (default) — Backend enqueues only `caption` + `decision` jobs. Post finalizes with no thumbnail. Suitable for dev without GCP.
- `ENABLE_AI_MEDIA=true` — Backend enqueues the `image` **or** `short_video` job based on `posts.mediaType` (user's choice). Requires:
  - `GCP_PROJECT_ID` (Vertex AI project)
  - `GCP_LOCATION` (e.g. `us-central1`)
  - `GCP_VEO_OUTPUT_BUCKET` (GCS bucket where Veo 3.1 writes; must be `publicAccessPrevention=inherited` + `allUsers=objectViewer` — run `python3 scripts/make_bucket_public.py`)
  - `gcp-key.json` at repo root (service account with Vertex AI User role)

---

## 1. Endpoint ที่ AI ต้องเปิด

```
POST <AI_MEDIA_URL>/generate-media
```

**Single endpoint** (เดิมสเปกมีสอง endpoint แยก image/short_video แต่ระบบจริงใช้ endpoint เดียว — n8n เราจ์จาก `body.type` ใน payload)

**Base URL** เช่น `http://n8n:5678/webhook` ใน Docker, หรือ `http://localhost:5678/webhook` ใน dev

**Authentication:** Header `X-Internal-Token: <shared secret>` (env `INTERNAL_API_KEY` ใน n8n และ backend)

---

## 1.1 Media type selector (ผู้ใช้เลือกเอง)

- `posts.mediaType` enum: `image` | `short_video` (default `image`)
- ผู้ใช้เลือกตอนสร้างโพสต์ผ่าน `CreatePostModal` ใน frontend
- Backend enqueue media job เพียง **1 อย่าง** ตามค่านี้ (ไม่ generate ทั้งคู่)
- Frontend แสดง in-flight placeholder ตาม mediaType:
  - `image` → "กำลังสร้างรูปภาพ…"
  - `short_video` → "กำลังสร้างวิดีโอ…"

---

## 2. Request (Backend → AI)

### Headers

```
Content-Type: application/json
X-Internal-Token: <shared secret>
X-Request-Id: <uuid>           (optional)
```

### 2.1 Body สำหรับ Image

```json
{
  "callbackUrl": "https://api.example.com/internal/ai/image/callback",
  "jobId": "5d4e3f2a-1b0c-4d3e-5f6a-7b8c9d0e1f2a",
  "postId": "6e7d8c9b-0a1b-2c3d-4e5f-6a7b8c9d0e1f",

  "upload": {
    "method": "PUT",
    "presignedUrl": "https://minio.example.com/posts/media/2026/06/27/abc.png?X-Amz-Signature=xxx",
    "storageKey": "posts/media/2026/06/27/abc.png",
    "publicUrl": "https://cdn.example.com/posts/media/2026/06/27/abc.png",
    "headers": {
      "Content-Type": "image/png"
    },
    "expiresAt": "2026-06-27T06:10:00.000Z",
    "maxBytes": 10485760
  },

  "business": {
    "id": "8a1f3b2c-4d5e-6f7a-8b9c-0d1e2f3a4b5c",
    "name": "ร้านก๋วยเตี๋ยวลุงมา",
    "industry": "อาหารและเครื่องดื่ม",
    "tone": "เป็นกันเอง อบอุ่น",
    "keywords": ["ก๋วยเตี๋ยว", "ต้มยำ"],
    "logoPublicUrl": "https://cdn.example.com/logos/abc.png"
  },
  "postType": "promotion",
  "caption": "ศุกร์นี้พบกับโปรโปรโมชันสุดคุ้ม! 🍜\nก๋วยเตี๋ยวต้มยำรสจัด เพียง 60 บาท",
  "featuredServices": [
    {
      "id": "b1c2d3e4-f5a6-4b7c-8d9e-0f1a2b3c4d5e",
      "name": "ก๋วยเตี๋ยวต้มยำ",
      "imagePublicUrl": "https://cdn.example.com/services/xyz.png"
    }
  ]
}
```

### 2.2 Body สำหรับ Short Video

```json
{
  "callbackUrl": "https://api.example.com/internal/ai/short_video/callback",
  "jobId": "5d4e3f2a-1b0c-4d3e-5f6a-7b8c9d0e1f2a",
  "postId": "6e7d8c9b-0a1b-2c3d-4e5f-6a7b8c9d0e1f",

  "upload": {
    "method": "PUT",
    "presignedUrl": "https://minio.example.com/posts/media/2026/06/27/abc.mp4?X-Amz-Signature=xxx",
    "storageKey": "posts/media/2026/06/27/abc.mp4",
    "publicUrl": "https://cdn.example.com/posts/media/2026/06/27/abc.mp4",
    "headers": {
      "Content-Type": "video/mp4"
    },
    "expiresAt": "2026-06-27T06:10:00.000Z",
    "maxBytes": 52428800
  },

  "business": {
    "id": "8a1f3b2c-4d5e-6f7a-8b9c-0d1e2f3a4b5c",
    "name": "ร้านก๋วยเตี๋ยวลุงมา",
    "industry": "อาหารและเครื่องดื่ม",
    "tone": "เป็นกันเอง อบอุ่น",
    "keywords": ["ก๋วยเตี๋ยว", "ต้มยำ"],
    "logoPublicUrl": "https://cdn.example.com/logos/abc.png"
  },
  "postType": "promotion",
  "caption": "ศุกร์นี้พบกับโปรโปรโมชันสุดคุ้ม! 🍜\nก๋วยเตี๋ยวต้มยำรสจัด เพียง 60 บาท",
  "featuredServices": [
    {
      "id": "b1c2d3e4-f5a6-4b7c-8d9e-0f1a2b3c4d5e",
      "name": "ก๋วยเตี๋ยวต้มยำ",
      "imagePublicUrl": "https://cdn.example.com/services/xyz.png"
    }
  ]
}
```

### Field Definitions

| Field | Type | Required | Description |
|---|---|---|---|
| `callbackUrl` | string | ✅ | URL ที่ AI จะ POST ผลลัพธ์กลับ |
| `jobId` | uuid | ✅ | ID ของ ai_jobs (ผูก callback) |
| `postId` | uuid | ✅ | ID ของ post |
| `upload.method` | string | ✅ | "PUT" (เสมอ) |
| `upload.presignedUrl` | string | ✅ | URL สำหรับ PUT ไฟล์ (หมดอายุใน 5 นาที) |
| `upload.storageKey` | string | ✅ | Key ใน object store (เช่น `posts/media/2026/06/27/abc.png`) |
| `upload.publicUrl` | string | ✅ | URL สาธารณะที่จะเข้าถึงไฟล์หลังอัปโหลด |
| `upload.headers` | object | ✅ | Headers ที่ต้องส่งตอน PUT (เช่น Content-Type) |
| `upload.expiresAt` | ISODateTime | ✅ | เวลาหมดอายุของ presigned URL |
| `upload.maxBytes` | int | ✅ | ขนาดไฟล์สูงสุด (10MB image / 50MB video) |
| `business.id` | uuid | ✅ | Business ID |
| `business.name` | string | ✅ | ชื่อธุรกิจ |
| `business.industry` | string | ❌ | อุตสาหกรรม |
| `business.tone` | string | ❌ | โทนเสียงแบรนด์ |
| `business.keywords` | string[] | ❌ | คำสำคัญ |
| `business.logoPublicUrl` | string | ❌ | URL โลโก้ (อาจใช้ overlay ในภาพ) |
| `postType` | string | ✅ | promotion / product_showcase / brand_awareness / event |
| `caption` | string | ✅ | แคปชั่นที่ generate แล้ว (ใช้เป็น context) |
| `featuredServices` | object[] | ❌ | บริการ featured (อาจมี imagePublicUrl ให้ใช้เป็น reference) |

---

## 3. Response (AI → Backend callback)

### 3.1 กรณีสำเร็จ

```json
{
  "jobId": "5d4e3f2a-1b0c-4d3e-5f6a-7b8c9d0e1f2a",
  "result": {
    "storageKey": "posts/media/2026/06/27/abc.png",
    "publicUrl": "https://cdn.example.com/posts/media/2026/06/27/abc.png",
    "width": 1080,
    "height": 1080,
    "durationSec": null
  }
}
```

**สำหรับ short_video:**
```json
{
  "jobId": "5d4e3f2a-1b0c-4d3e-5f6a-7b8c9d0e1f2a",
  "result": {
    "storageKey": "posts/media/2026/06/27/abc.mp4",
    "publicUrl": "https://cdn.example.com/posts/media/2026/06/27/abc.mp4",
    "width": 1080,
    "height": 1920,
    "durationSec": 15
  }
}
```

### 3.2 กรณี Error

```json
{
  "jobId": "5d4e3f2a-1b0c-4d3e-5f6a-7b8c9d0e1f2a",
  "error": {
    "code": "generation_failed",
    "message": "Model rejected prompt"
  }
}
```

### Field Definitions (Response)

| Field | Type | Required | Description |
|---|---|---|---|
| `jobId` | uuid | ✅ | ต้องตรงกับ request |
| `result.storageKey` | string | ❌ (required เมื่อ success) | **ต้องตรงกับ** `upload.storageKey` ใน request |
| `result.publicUrl` | string | ❌ (required เมื่อ success) | **ต้องตรงกับ** `upload.publicUrl` ใน request |
| `result.width` | int | ❌ | ความกว้าง (px) |
| `result.height` | int | ❌ | ความสูง (px) |
| `result.durationSec` | int | ❌ (image=null, video=ตัวเลข) | ความยาววิดีโอ (วินาที) |
| `error.code` | string | ❌ | ดู error codes |
| `error.message` | string | ❌ | คำอธิบาย |

### `error.code` enum

| Code | ความหมาย | Retry? |
|---|---|---|
| `internal_error` | AI service ขัดข้อง | ✅ |
| `timeout` | ประมวลผลนานเกินไป | ✅ |
| `rate_limited` | เกิน rate limit | ✅ |
| `generation_failed` | Model ไม่สามารถ generate ได้ | ✅ (≤ 2 ครั้ง) |
| `content_policy` | Output ถูก block | ❌ |
| `content_safety` | Vertex AI block ด้วย RAI check (เช่น recitation) | ❌ |
| `upload_failed` | อัปโหลดไฟล์ไม่สำเร็จ (เช่น presigned URL หมดอายุ หรือ GCS download 401) | ✅ |

### 3.3 กรณี Error + structured metadata (มิ.ย. 2026)

ตั้งแต่ มิ.ย. 2026 AI สามารถส่ง `metadata` (jsonb) เพิ่มเติมเพื่อให้ backend เก็บ structured failure context:

```json
{
  "jobId": "5d4e3f2a-1b0c-4d3e-5f6a-7b8c9d0e1f2a",
  "error": {
    "code": "content_safety",
    "message": "Content was filtered by Vertex AI safety check: Recitation check failed."
  },
  "metadata": {
    "raiMediaFilteredCount": 0,
    "raiMediaFilteredReasons": ["Recitation check failed."]
  }
}
```

Backend เก็บ `metadata` ลง `ai_jobs.metadata` (jsonb) เพื่อให้ admin/dev ตรวจสอบย้อนหลังได้ โดยไม่ต้อง parse จาก `lastError` string

ตัวอย่างเพิ่มเติม:
- `content_safety` + `metadata.raiMediaFilteredReasons`: ใช้โดย Veo 3.1 (recitation check)
- `upload_failed` + `metadata.httpCode` + `metadata.url`: ใช้โดย MinIO PUT failures (จะเพิ่มในอนาคต)

---

## 4. ขั้นตอนการอัปโหลดไฟล์ (Presigned URL Flow)

AI ต้องทำตามขั้นตอนนี้:

### Step 1: สร้างไฟล์
- สร้าง image (PNG/JPG) หรือ short video (MP4) ตาม context

### Step 2: ตรวจสอบขนาด

| ประเภท | ขนาดสูงสุด | ขนาดแนะนำ | นามสกุล |
|---|---|---|---|
| image | 10 MB | < 2 MB | png / jpg / webp |
| short_video | 50 MB | < 20 MB | mp4 |

ถ้าเกิน → return error `generation_failed` (ไม่ต้องลองอัปโหลด)

### Step 3: PUT ไป Presigned URL

```bash
curl -X PUT "https://minio.example.com/posts/media/2026/06/27/abc.png?X-Amz-Signature=xxx" \
  -H "Content-Type: image/png" \
  --data-binary @/path/to/generated-image.png
```

**สำคัญ:**
- ใช้ HTTP method PUT
- Header `Content-Type` ต้องตรงกับที่ Backend กำหนดใน `upload.headers`
- ตรวจ response status = 200/204 = สำเร็จ
- ถ้า status อื่น → return error `upload_failed`

### Step 4: POST callback กลับ Backend

ส่ง `storageKey` และ `publicUrl` กลับมา **ตามเดิม** ที่ Backend ส่งไปให้

---

## 5. ข้อกำหนดทางเทคนิค

### 5.1 Image

| Property | Spec |
|---|---|
| ขนาด | ≤ 10 MB |
| นามสกุล | png / jpg / webp |
| Resolution แนะนำ | 1080×1080 (square) หรือ 1080×1350 (portrait) |
| ต้องเป็น | RGB (ไม่ใช่ CMYK) |
| ห้าม | ภาพเปลือย อาวุธ ยาเสพติด การเมือง เนื้อหาที่ผิดกฎหมาย |

### 5.2 Short Video

| Property | Spec |
|---|---|
| ขนาด | ≤ 50 MB |
| ความยาว | ≤ 15 วินาที |
| นามสกุล | mp4 |
| Codec | H.264 (video) + AAC (audio) |
| Resolution แนะนำ | 1080×1920 (vertical, 9:16) สำหรับ Facebook Reel |
| FPS | 24 / 30 |
| Bitrate | ≤ 5 Mbps |
| ต้องมี | เสียง (ถ้าเป็นไปได้) หรือ text overlay |

---

## 6. Timeout และ Retry

- Backend จะรอ callback **สูงสุด 15 นาที** (media ใช้เวลานาน)
- ถ้าไม่ตอบกลับภายใน 15 นาที → mark `ai_jobs.status = 'failed'`
- จะถูก retry **3 ครั้ง** (1m, 5m, 15m exponential backoff)
- ถ้าครบ 3 ครั้ง → post ถูก mark `failed` + ส่ง email แจ้ง user
- **Presigned URL หมดอายุ 5 นาที** ถ้า AI ใช้เวลาสร้างนานกว่านั้น ต้องขอ presigned URL ใหม่ (เรียก `POST /internal/ai/{type}/refresh-upload` — ให้ Backend เพิ่มทีหลัง)

---

## 7. ตัวอย่าง cURL เต็ม (Image)

### Request

```bash
curl -X POST https://ai-media.example.com/generate/image \
  -H "Content-Type: application/json" \
  -H "X-Internal-Token: secret-xxx" \
  -d '{
    "callbackUrl": "https://api.example.com/internal/ai/image/callback",
    "jobId": "5d4e3f2a-1b0c-4d3e-5f6a-7b8c9d0e1f2a",
    "postId": "6e7d8c9b-0a1b-2c3d-4e5f-6a7b8c9d0e1f",
    "upload": {
      "method": "PUT",
      "presignedUrl": "https://minio.example.com/posts/media/2026/06/27/abc.png?X-Amz-Signature=xxx",
      "storageKey": "posts/media/2026/06/27/abc.png",
      "publicUrl": "https://cdn.example.com/posts/media/2026/06/27/abc.png",
      "headers": {"Content-Type": "image/png"},
      "expiresAt": "2026-06-27T06:10:00.000Z",
      "maxBytes": 10485760
    },
    "business": {
      "id": "8a1f3b2c-4d5e-6f7a-8b9c-0d1e2f3a4b5c",
      "name": "ร้านก๋วยเตี๋ยวลุงมา",
      "tone": "เป็นกันเอง อบอุ่น",
      "keywords": ["ก๋วยเตี๋ยว", "ต้มยำ"],
      "logoPublicUrl": "https://cdn.example.com/logos/abc.png"
    },
    "postType": "promotion",
    "caption": "ศุกร์นี้พบกับโปรโปรโมชันสุดคุ้ม!",
    "featuredServices": [
      {
        "id": "b1c2d3e4-f5a6-4b7c-8d9e-0f1a2b3c4d5e",
        "name": "ก๋วยเตี๋ยวต้มยำ",
        "imagePublicUrl": "https://cdn.example.com/services/xyz.png"
      }
    ]
  }'
```

### AI อัปโหลด

```bash
curl -X PUT "https://minio.example.com/posts/media/2026/06/27/abc.png?X-Amz-Signature=xxx" \
  -H "Content-Type: image/png" \
  --data-binary @/tmp/generated.png
```

### AI ตอบกลับ Backend

```bash
curl -X POST https://api.example.com/internal/ai/image/callback \
  -H "Content-Type: application/json" \
  -H "X-Internal-Token: secret-xxx" \
  -d '{
    "jobId": "5d4e3f2a-1b0c-4d3e-5f6a-7b8c9d0e1f2a",
    "result": {
      "storageKey": "posts/media/2026/06/27/abc.png",
      "publicUrl": "https://cdn.example.com/posts/media/2026/06/27/abc.png",
      "width": 1080,
      "height": 1080,
      "durationSec": null
    }
  }'
```

---

## 8. Testing

Backend จะเปิด endpoint `/internal/test/ai-media-mock` (เฉพาะ dev) เพื่อให้ทดสอบ callback ได้

---

## 9. ติดต่อ / สอบถาม

- **Backend dev:** [ชื่อทีม] (ดูจาก `docs/01-OVERVIEW.md`)
- **Channel:** [Slack/Discord/etc.]
- **Issue tracking:** [GitHub Issues URL]

อัปเดตล่าสุด: 2026-06-27
