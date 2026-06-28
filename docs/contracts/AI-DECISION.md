# Contract: AI Decision Service

> สำหรับทีม **marketing-ai dev** (บริการตัดสินใจ)
> เอกสารนี้อธิบาย API contract ระหว่าง Backend ↔ AI Decision Service

---

## ภาพรวม

AI Decision Service มีหน้าที่ตัดสินใจว่า **"วันนี้ธุรกิจนี้ควรโพสต์หรือไม่"** และถ้าควร จะโพสต์เวลาใด เป็นโพสต์ประเภทไหน ใช้บริการอะไร featured

**รูปแบบการสื่อสาร:** HTTP POST (Backend → AI) + HTTP POST callback (AI → Backend)

```
┌──────────────┐                              ┌──────────────────────┐
│   Backend    │ ─── POST /decide ──────────▶ │ AI Decision Service  │
│   (NestJS)   │                              │  (any stack)         │
│              │ ◀── POST callback ─────────  │                      │
└──────────────┘                              └──────────────────────┘
```

---

## 1. Endpoint ที่ AI ต้องเปิด

```
POST <AI_DECISION_URL>/decide
```

**Base URL** ของ AI Service จะถูกตั้งใน env ของ Backend เช่น `https://ai-decision.example.com`

**Authentication:** Header `X-Internal-Token: <shared secret>` — Backend จะส่ง secret นี้ไปให้ AI ทีมตอนตั้งค่า

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
  "callbackUrl": "https://api.example.com/internal/ai/decide/callback",
  "planId": "9d2e5c4a-1b3f-4e7a-8c2d-5a6b7c8d9e0f",
  "business": {
    "id": "8a1f3b2c-4d5e-6f7a-8b9c-0d1e2f3a4b5c",
    "name": "ร้านก๋วยเตี๋ยวลุงมา",
    "industry": "อาหารและเครื่องดื่ม",
    "description": "ก๋วยเตี๋ยวต้มตำสูตรโบราณ เปิดมา 30 ปี",
    "tone": "เป็นกันเอง อบอุ่น",
    "keywords": ["ก๋วยเตี๋ยว", "ต้มยำ", "อาหารตามสั่ง"],
    "targetAudience": "คนทำงานออฟฟิศ 25-45 ปี ในย่านลาดพร้าว",
    "postsPerWeekTarget": 3,
    "minGapDays": 1,
    "logoPublicUrl": "https://cdn.example.com/logos/abc.png"
  },
  "recentPosts": [
    {
      "postedAt": "2026-06-22T11:30:00.000Z",
      "postType": "product_showcase"
    },
    {
      "postedAt": "2026-06-24T13:00:00.000Z",
      "postType": "promotion"
    }
  ],
  "postsThisWeek": 2,
  "lastPostAt": "2026-06-24T13:00:00.000Z",
  "nowIso": "2026-06-27T06:00:00.000Z"
}
```

### Field Definitions

| Field | Type | Required | Description |
|---|---|---|---|
| `callbackUrl` | string | ✅ | URL ที่ AI จะ POST ผลลัพธ์กลับ (Backend endpoint) |
| `planId` | uuid | ✅ | ID ของ content_plans ใน Backend (ใช้ผูก callback) |
| `business.id` | uuid | ✅ | Business ID |
| `business.name` | string | ✅ | ชื่อธุรกิจ |
| `business.industry` | string | ✅ | อุตสาหกรรม |
| `business.description` | string | ❌ | คำอธิบาย |
| `business.tone` | string | ❌ | โทนเสียงแบรนด์ |
| `business.keywords` | string[] | ❌ | คำสำคัญ |
| `business.targetAudience` | string | ❌ | กลุ่มเป้าหมาย |
| `business.postsPerWeekTarget` | int | ✅ | เป้าหมวนโพสต์ต่อสัปดาห์ (1-14) |
| `business.minGapDays` | int | ✅ | ระยะห่างขั้นต่ำระหว่างโพสต์ (0-7 วัน) |
| `business.logoPublicUrl` | string | ❌ | URL โลโก้ (public) |
| `recentPosts` | object[] | ✅ | โพสต์ 14 วันล่าสุด (อาจว่างได้) |
| `recentPosts[].postedAt` | ISODateTime | ✅ | เวลาโพสต์ (UTC) |
| `recentPosts[].postType` | string | ✅ | ประเภทโพสต์ |
| `postsThisWeek` | int | ✅ | จำนวนโพสต์ในสัปดาห์นี้ (เริ่มจันทร์ 00:00 Asia/Bangkok) |
| `lastPostAt` | ISODateTime | ❌ | เวลาโพสต์ล่าสุด (null = ยังไม่เคยโพสต์) |
| `nowIso` | ISODateTime | ✅ | เวลาปัจจุบัน (UTC) |

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

### 3.1 กรณี `shouldPost = true`

```json
{
  "planId": "9d2e5c4a-1b3f-4e7a-8c2d-5a6b7c8d9e0f",
  "decision": {
    "shouldPost": true,
    "reasoning": "โพสต์ 2 ครั้งในสัปดาห์นี้ ห่างจากโพสต์ล่าสุด 3 วัน ควรโพสต์วันนี้เพื่อรักษาความถี่",
    "suggestedScheduledAt": "2026-06-27T11:00:00.000Z",
    "postType": "promotion",
    "featuredServiceIds": [
      "b1c2d3e4-f5a6-4b7c-8d9e-0f1a2b3c4d5e",
      "c2d3e4f5-a6b7-4c8d-9e0f-1a2b3c4d5e6f"
    ],
    "captionHint": "โปรโมชันวันศุกร์ เน้นก๋วยเตี๋ยวต้มยำ"
  }
}
```

### 3.2 กรณี `shouldPost = false`

```json
{
  "planId": "9d2e5c4a-1b3f-4e7a-8c2d-5a6b7c8d9e0f",
  "decision": {
    "shouldPost": false,
    "reasoning": "โพสต์ครบ 3 ครั้ง/สัปดาห์แล้ว ไม่ควรเพิ่ม"
  }
}
```

### 3.3 กรณี Error

```json
{
  "planId": "9d2e5c4a-1b3f-4e7a-8c2d-5a6b7c8d9e0f",
  "error": {
    "code": "internal_error",
    "message": "AI service temporarily unavailable"
  }
}
```

### Field Definitions (Response)

| Field | Type | Required | Description |
|---|---|---|---|
| `planId` | uuid | ✅ | ต้องตรงกับ request |
| `decision.shouldPost` | bool | ✅ | true = ควรโพสต์ / false = ข้ามวันนี้ |
| `decision.reasoning` | string | ✅ | เหตุผล (จะแสดงใน UI) |
| `decision.suggestedScheduledAt` | ISODateTime | ❌ (required เมื่อ shouldPost=true) | เวลาที่แนะนำ (UTC) |
| `decision.postType` | string | ❌ (required เมื่อ shouldPost=true) | ดู enum ด้านล่าง |
| `decision.featuredServiceIds` | uuid[] | ❌ (optional เมื่อ shouldPost=true) | รายการ service ที่แนะนำให้ featured |
| `decision.captionHint` | string | ❌ | คำแนะนำเพิ่มเติมสำหรับ Caption Service |
| `error.code` | string | ❌ (required เมื่อ error) | ดู error codes |
| `error.message` | string | ❌ | คำอธิบาย |

### `postType` enum

| Value | ความหมาย |
|---|---|
| `promotion` | โปรโมชั่น/ลดราคา |
| `product_showcase` | แสดงสินค้า/บริการ |
| `brand_awareness` | สร้างการรับรู้แบรนด์ |
| `event` | อีเวนต์/กิจกรรม |

### `error.code` enum

| Code | ความหมาย |
|---|---|
| `internal_error` | AI service ขัดข้อง (จะถูก retry) |
| `timeout` | ประมวลผลนานเกินไป (จะถูก retry) |
| `invalid_input` | Input ผิดพลาด (จะไม่ถูก retry) |

---

## 4. กฎการตัดสินใจ (สำหรับ AI Implementation)

### 4.1 เกณฑ์การตัดสิน `shouldPost`

**ควรโพสต์วันนี้ (`shouldPost=true`)** เมื่อ:
- `postsThisWeek < postsPerWeekTarget` และ
- ระยะห่างจากโพสต์ล่าสุด ≥ `minGapDays` และ
- เป็นวันที่เหมาะสมตาม `targetAudience` (เช่น คนทำงานออฟฟิศ — หลีกเลี่ยงวันหยุดยาว)

**ข้ามวันนี้ (`shouldPost=false`)** เมื่อ:
- `postsThisWeek >= postsPerWeekTarget` หรือ
- ระยะห่างจากโพสต์ล่าสุด < `minGapDays`

### 4.2 เกณฑ์การเลือก `suggestedScheduledAt`

- คำนวณจาก **Asia/Bangkok timezone** (UTC+7)
- วิเคราะห์จาก `targetAudience`:
  - "คนทำงานออฟฟิศ" → ช่วงเย็น 18:00-20:00 BKK
  - "วัยรุ่น" → ช่วง 20:00-22:00 BKK
  - "ผู้ปกครอง" → ช่วง 09:00-11:00 BKK
- หลีกเลี่ยงเวลาที่ user น่าจะยุ่ง (เช่น กลางดึก)
- แปลงเป็น **UTC** ก่อนส่งกลับ (เช่น 18:00 BKK = 11:00 UTC)

### 4.3 เกณฑ์การเลือก `postType`

- สลับประเภทเพื่อไม่ให้ซ้ำ: ถ้าโพสต์ล่าสุดเป็น `promotion` → รอบนี้ควรเป็น `product_showcase` หรือ `brand_awareness`
- ดู keyword และ description ของบริการที่ featured เพื่อเลือกประเภทที่เหมาะสม

### 4.4 เกณฑ์การเลือก `featuredServiceIds`

- เลือก 1-3 service ที่:
  - `isActive = true`
  - ยังไม่ถูก featured ในโพสต์ 3 รายการล่าสุด
  - ตรงกับ `postType` ที่เลือก

---

## 5. Timeout และ Retry

- Backend จะรอ callback **สูงสุด 10 นาที**
- ถ้าไม่ตอบกลับภายใน 10 นาที → mark `ai_jobs.status = 'failed'`, error = 'timeout'
- จะถูก retry **3 ครั้ง** (1m, 5m, 15m exponential backoff)
- ถ้าครบ 3 ครั้ง → ข้ามโพสต์นี้ (จะรอบ cron ถัดไป 06:00 ของวันพรุ่งนี้)

---

## 6. ตัวอย่าง cURL

### Request

```bash
curl -X POST https://ai-decision.example.com/decide \
  -H "Content-Type: application/json" \
  -H "X-Internal-Token: secret-xxx" \
  -d '{
    "callbackUrl": "https://api.example.com/internal/ai/decide/callback",
    "planId": "9d2e5c4a-1b3f-4e7a-8c2d-5a6b7c8d9e0f",
    "business": {
      "id": "8a1f3b2c-4d5e-6f7a-8b9c-0d1e2f3a4b5c",
      "name": "ร้านก๋วยเตี๋ยวลุงมา",
      "industry": "อาหารและเครื่องดื่ม",
      "tone": "เป็นกันเอง อบอุ่น",
      "keywords": ["ก๋วยเตี๋ยว", "ต้มยำ"],
      "targetAudience": "คนทำงานออฟฟิศ 25-45 ปี ในย่านลาดพร้าว",
      "postsPerWeekTarget": 3,
      "minGapDays": 1,
      "logoPublicUrl": "https://cdn.example.com/logos/abc.png"
    },
    "recentPosts": [
      {"postedAt": "2026-06-22T11:30:00.000Z", "postType": "product_showcase"},
      {"postedAt": "2026-06-24T13:00:00.000Z", "postType": "promotion"}
    ],
    "postsThisWeek": 2,
    "lastPostAt": "2026-06-24T13:00:00.000Z",
    "nowIso": "2026-06-27T06:00:00.000Z"
  }'
```

### Response (callback)

```bash
curl -X POST https://api.example.com/internal/ai/decide/callback \
  -H "Content-Type: application/json" \
  -H "X-Internal-Token: secret-xxx" \
  -d '{
    "planId": "9d2e5c4a-1b3f-4e7a-8c2d-5a6b7c8d9e0f",
    "decision": {
      "shouldPost": true,
      "reasoning": "โพสต์ 2 ครั้งในสัปดาห์นี้ ห่างจากโพสต์ล่าสุด 3 วัน ควรโพสต์วันนี้",
      "suggestedScheduledAt": "2026-06-27T11:00:00.000Z",
      "postType": "promotion",
      "featuredServiceIds": ["b1c2d3e4-f5a6-4b7c-8d9e-0f1a2b3c4d5e"],
      "captionHint": "โปรโมชันวันศุกร์"
    }
  }'
```

---

## 7. Testing

Backend จะเปิด endpoint `/internal/test/ai-decision-mock` (เฉพาะ dev) เพื่อให้ทดสอบ callback ได้โดยไม่ต้องเปิด AI service จริง

```bash
curl -X POST http://localhost:3000/internal/test/ai-decision-mock \
  -H "Content-Type: application/json" \
  -d '{ "planId": "xxx", "decision": { "shouldPost": true, ... } }'
```

---

## 8. ติดต่อ / สอบถาม

- **Backend dev:** [ชื่อทีม] (ดูจาก `docs/01-OVERVIEW.md`)
- **Channel:** [Slack/Discord/etc.]
- **Issue tracking:** [GitHub Issues URL]

อัปเดตล่าสุด: 2026-06-27
