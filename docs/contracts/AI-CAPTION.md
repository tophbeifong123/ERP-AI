# Contract: AI Caption Service

> สำหรับทีม **marketing-ai dev** (บริการสร้างคำบรรยาย)
> เอกสารนี้อธิบาย API contract ระหว่าง Backend ↔ AI Caption Service

---

## ภาพรวม

AI Caption Service มีหน้าที่สร้าง **แคปชั่นภาษาไทย** สำหรับโพสต์ Facebook โดยคำนึงถึงโทนของแบรนด์ กลุ่มเป้าหมาย และบริการที่ featured

**รูปแบบการสื่อสาร:** HTTP POST (Backend → AI) + HTTP POST callback (AI → Backend)

```
┌──────────────┐                              ┌──────────────────────┐
│   Backend    │ ─── POST /generate ────────▶ │ AI Caption Service   │
│   (NestJS)   │                              │  (any stack)         │
│              │ ◀── POST callback ─────────  │                      │
└──────────────┘                              └──────────────────────┘
```

---

## 1. Endpoint ที่ AI ต้องเปิด

```
POST <AI_CAPTION_URL>/generate
```

**Base URL** ของ AI Service จะถูกตั้งใน env ของ Backend เช่น `https://ai-caption.example.com`

**Authentication:** Header `X-Internal-Token: <shared secret>`

---

## 2. Request (Backend → AI)

### Headers

```
Content-Type: application/json
X-Internal-Token: <shared secret>
X-Request-Id: <uuid>           (optional — สำหรับ debug)
```

### Body

```json
{
  "callbackUrl": "https://api.example.com/internal/ai/caption/callback",
  "jobId": "7f8e9d0c-1b2a-4c3d-5e6f-7a8b9c0d1e2f",
  "postId": "6e7d8c9b-0a1b-2c3d-4e5f-6a7b8c9d0e1f",
  "business": {
    "id": "8a1f3b2c-4d5e-6f7a-8b9c-0d1e2f3a4b5c",
    "name": "ร้านก๋วยเตี๋ยวลุงมา",
    "industry": "อาหารและเครื่องดื่ม",
    "tone": "เป็นกันเอง อบอุ่น",
    "keywords": ["ก๋วยเตี๋ยว", "ต้มยำ", "อาหารตามสั่ง"]
  },
  "postType": "promotion",
  "featuredServices": [
    {
      "id": "b1c2d3e4-f5a6-4b7c-8d9e-0f1a2b3c4d5e",
      "name": "ก๋วยเตี๋ยวต้มยำ",
      "description": "ต้มยำรสจัด เส้นเหนียวนุ่ม ใส่กุ้งสด",
      "price": 60,
      "currency": "THB"
    },
    {
      "id": "c2d3e4f5-a6b7-4c8d-9e0f-1a2b3c4d5e6f",
      "name": "ข้าวผัดปู",
      "description": "ข้าวผัดปูเนื้อแน่น หอมกระเทียม",
      "price": 120,
      "currency": "THB"
    }
  ],
  "captionHint": "โปรโมชันวันศุกร์ เน้นก๋วยเตี๋ยวต้มยำ",
  "targetAudience": "คนทำงานออฟฟิศ 25-45 ปี ในย่านลาดพร้าว"
}
```

### Field Definitions

| Field | Type | Required | Description |
|---|---|---|---|
| `callbackUrl` | string | ✅ | URL ที่ AI จะ POST ผลลัพธ์กลับ |
| `jobId` | uuid | ✅ | ID ของ ai_jobs ใน Backend (ใช้ผูก callback) |
| `postId` | uuid | ✅ | ID ของ post ที่กำลังสร้าง |
| `business.id` | uuid | ✅ | Business ID |
| `business.name` | string | ✅ | ชื่อธุรกิจ |
| `business.industry` | string | ❌ | อุตสาหกรรม |
| `business.tone` | string | ❌ | โทนเสียงแบรนด์ |
| `business.keywords` | string[] | ❌ | คำสำคัญ |
| `postType` | string | ✅ | ดู enum ด้านล่าง |
| `featuredServices` | object[] | ❌ | บริการ/สินค้าที่ featured (อาจว่าง) |
| `featuredServices[].id` | uuid | ✅ | Service ID |
| `featuredServices[].name` | string | ✅ | ชื่อบริการ |
| `featuredServices[].description` | string | ❌ | คำอธิบาย |
| `featuredServices[].price` | int | ✅ | ราคา (หน่วย: สตางค์ เช่น 6000 = 60 บาท) |
| `featuredServices[].currency` | string | ✅ | "THB" (เท่านั้นใน MVP) |
| `captionHint` | string | ❌ | คำแนะนำเพิ่มเติม (เช่น "โปรโมชันวันศุกร์") |
| `targetAudience` | string | ❌ | กลุ่มเป้าหมาย |

### `postType` enum

| Value | ความหมาย |
|---|---|
| `promotion` | โปรโมชั่น/ลดราคา |
| `product_showcase` | แสดงสินค้า/บริการ |
| `brand_awareness` | สร้างการรับรู้แบรนด์ |
| `event` | อีเวนต์/กิจกรรม |

---

## 3. Response (AI → Backend callback)

### Endpoint ที่ AI ต้องเรียกกลับ

```
POST {callbackUrl}   // ค่าจาก request body
```

### Headers

```
Content-Type: application/json
X-Internal-Token: <shared secret เดียวกัน>
```

### 3.1 กรณีสำเร็จ

```json
{
  "jobId": "7f8e9d0c-1b2a-4c3d-5e6f-7a8b9c0d1e2f",
  "result": {
    "caption": "ศุกร์นี้พบกับโปรโปรโมชันสุดคุ้ม! 🍜\n\nก๋วยเตี๋ยวต้มยำรสจัด เส้นเหนียวนุ่ม ใส่กุ้งสด เพียง 60 บาท\n\n📍 ร้านก๋วยเตี๋ยวลุงมา\n⏰ เปิดทุกวัน 10:00-21:00\n\n#ก๋วยเตี๋ยว #ต้มยำ #อาหารตามสั่ง"
  }
}
```

### 3.2 กรณี Error

```json
{
  "jobId": "7f8e9d0c-1b2a-4c3d-5e6f-7a8b9c0d1e2f",
  "error": {
    "code": "model_error",
    "message": "Upstream model timeout"
  }
}
```

### Field Definitions (Response)

| Field | Type | Required | Description |
|---|---|---|---|
| `jobId` | uuid | ✅ | ต้องตรงกับ request |
| `result.caption` | string | ❌ (required เมื่อ success) | แคปชั่นภาษาไทย (≤ 2000 ตัวอักษร, มี newline ได้) |
| `error.code` | string | ❌ (required เมื่อ error) | ดู error codes |
| `error.message` | string | ❌ | คำอธิบาย |

### `error.code` enum

| Code | ความหมาย | Retry? |
|---|---|---|
| `internal_error` | AI service ขัดข้อง | ✅ |
| `timeout` | ประมวลผลนานเกินไป | ✅ |
| `rate_limited` | เกิน rate limit | ✅ (หลัง delay) |
| `invalid_input` | Input ผิดพลาด | ❌ |
| `content_policy` | Output ถูก block โดย policy | ❌ |

---

## 4. แนวทางสร้างแคปชั่น

### 4.1 ความยาว
- แนะนำ 100-500 ตัวอักษร (ยาวเกินไป FB จะซ่อน)
- ไม่ควรเกิน 2000 ตัวอักษร

### 4.2 โครงสร้างแนะนำ

```
[Hook ดึงดูดความสนใจ 1-2 บรรทัด]

[รายละเอียดบริการ/โปรโมชัน 2-3 บรรทัด]

[Call-to-action 1 บรรทัด]

[Hashtags 3-5 คำ]
```

### 4.3 หลักการ

- ใช้ภาษาไทยเป็นหลัก (ยกเว้นชื่อแบรนด์ภาษาอังกฤษ)
- สะกดผิดบ่อย: "ต้ม**ยำ**" ไม่ใช่ "ต้มแยม", "ก๋วย**เตี๋ยว**" ไม่ใช่ "ก๋วยเตี๊ยว"
- หลีกเลี่ยงคำเกินจริง เช่น "ดีที่สุดในโลก"
- หลีกเลี่ยง emoji มากเกินไป (≤ 5 ตัว)
- ปฏิบัติตามกฎหมายไทย: ไม่โฆษณายา อาหารเสริม แอลกอฮอล์

---

## 5. Timeout และ Retry

- Backend จะรอ callback **สูงสุด 5 นาที**
- ถ้าไม่ตอบกลับภายใน 5 นาที → mark `ai_jobs.status = 'failed'`
- จะถูก retry **3 ครั้ง** (1m, 5m, 15m exponential backoff)
- ถ้าครบ 3 ครั้ง → post ถูก mark `failed` + ส่ง email แจ้ง user

---

## 6. ตัวอย่าง cURL

### Request

```bash
curl -X POST https://ai-caption.example.com/generate \
  -H "Content-Type: application/json" \
  -H "X-Internal-Token: secret-xxx" \
  -d '{
    "callbackUrl": "https://api.example.com/internal/ai/caption/callback",
    "jobId": "7f8e9d0c-1b2a-4c3d-5e6f-7a8b9c0d1e2f",
    "postId": "6e7d8c9b-0a1b-2c3d-4e5f-6a7b8c9d0e1f",
    "business": {
      "id": "8a1f3b2c-4d5e-6f7a-8b9c-0d1e2f3a4b5c",
      "name": "ร้านก๋วยเตี๋ยวลุงมา",
      "tone": "เป็นกันเอง อบอุ่น",
      "keywords": ["ก๋วยเตี๋ยว", "ต้มยำ"]
    },
    "postType": "promotion",
    "featuredServices": [
      {
        "id": "b1c2d3e4-f5a6-4b7c-8d9e-0f1a2b3c4d5e",
        "name": "ก๋วยเตี๋ยวต้มยำ",
        "description": "ต้มยำรสจัด เส้นเหนียวนุ่ม ใส่กุ้งสด",
        "price": 6000,
        "currency": "THB"
      }
    ],
    "captionHint": "โปรโมชันวันศุกร์",
    "targetAudience": "คนทำงานออฟฟิศ 25-45 ปี"
  }'
```

### Response (callback)

```bash
curl -X POST https://api.example.com/internal/ai/caption/callback \
  -H "Content-Type: application/json" \
  -H "X-Internal-Token: secret-xxx" \
  -d '{
    "jobId": "7f8e9d0c-1b2a-4c3d-5e6f-7a8b9c0d1e2f",
    "result": {
      "caption": "ศุกร์นี้พบกับโปรโปรโมชันสุดคุ้ม! 🍜\n\nก๋วยเตี๋ยวต้มยำรสจัด เพียง 60 บาท\n\n#ก๋วยเตี๋ยว #ต้มยำ"
    }
  }'
```

---

## 7. Testing

Backend จะเปิด endpoint `/internal/test/ai-caption-mock` (เฉพาะ dev) เพื่อให้ทดสอบ callback ได้

---

## 8. ติดต่อ / สอบถาม

- **Backend dev:** [ชื่อทีม] (ดูจาก `docs/01-OVERVIEW.md`)
- **Channel:** [Slack/Discord/etc.]
- **Issue tracking:** [GitHub Issues URL]

อัปเดตล่าสุด: 2026-06-27
