# ERP-AI Services

ไมโครเซอร์วิส AI สำหรับโปรเจกต์ ERP-AI มี 2 endpoint:

1. **AI Decision** — ตัดสินใจว่าธุรกิจ *ควรโพสต์หรือไม่*, *เมื่อไหร่*, และ *โพสต์แบบไหน*
2. **AI Caption** — สร้างแคปชั่นภาษาไทยสำหรับโพสต์

พัฒนาด้วย FastAPI + Groq (Llama 3.3 70B) และทำให้ตรงตาม contract ของฝั่ง backend
ที่ `docs/contracts/AI-DECISION.md` และ `AI-CAPTION.md`

## สถาปัตยกรรม: Async Callback

ทั้งสอง endpoint ทำงานแบบ **asynchronous** กล่าวคือ backend จะส่ง request ที่มี
`callbackUrl` มา ตัวเซอร์วิสจะตอบ **`202 Accepted`** กลับทันที แล้วประมวลผลใน
background จากนั้นจึง **POST ผลลัพธ์กลับ** ไปที่ `callbackUrl`

```
Backend  --POST /decide  (พร้อม callbackUrl)-->  AI Service
Backend  <--202 Accepted----------------------   AI Service
                                                 AI Service --(Groq)--> ผลลัพธ์
Backend  <--POST {callbackUrl} (ผลลัพธ์)-------   AI Service
```

การยืนยันตัวตน (Auth): ทุก request และ callback จะแนบ header `X-Internal-Token`
(เป็น secret ที่ใช้ร่วมกันสองฝั่ง)

---

## การติดตั้ง (Setup)

```powershell
cd ai-services
python -m venv venv
venv\Scripts\pip install -r requirements.txt
copy .env.example .env   # แล้วใส่ค่า GROQ_API_KEY และ INTERNAL_TOKEN
```

ค่าใน `.env`: `GROQ_API_KEY` (จำเป็น), `INTERNAL_TOKEN` (secret ที่ใช้ร่วมกัน)

## การรัน (Run)

```powershell
venv\Scripts\uvicorn app.main:app --reload
```

เอกสาร API: <http://localhost:8000/docs> · ตรวจสุขภาพระบบ: `GET /health`

---

## Endpoint 1 — AI Decision

`POST /api/ai/decision/decide` → ตอบ `202 Accepted` แล้ว callback ไปที่ `callbackUrl`

### Request (backend → AI)

```json
{
  "callbackUrl": "https://api.example.com/internal/ai/decide/callback",
  "planId": "9d2e5c4a-...",
  "business": {
    "id": "8a1f3b2c-...",
    "name": "ร้านกาแฟดอยช้าง",
    "industry": "ร้านกาแฟ",
    "tone": "เป็นกันเอง อบอุ่น",
    "targetAudience": "คนรุ่นใหม่ วัยทำงาน",
    "keywords": ["กาแฟสด", "ดอยช้าง"],
    "postsPerWeekTarget": 3,
    "minGapDays": 1
  },
  "recentPosts": [
    { "postedAt": "2026-06-24T13:00:00Z", "postType": "promotion" }
  ],
  "postsThisWeek": 1,
  "lastPostAt": "2026-06-24T13:00:00Z",
  "nowIso": "2026-06-28T06:00:00Z",
  "services": [
    { "id": "svc-1", "name": "ลาเต้เย็น", "priceMinor": 6500, "currency": "THB", "isActive": true }
  ],
  "recentFeaturedServiceIds": ["svc-9"]
}
```

> `services[]` ฝั่ง backend เป็นผู้ส่งมา (Option 1) เพื่อให้ AI เลือก `featuredServiceIds` ได้
> `priceMinor` มีหน่วยเป็น **สตางค์** (6500 = 65.00 บาท) ส่วน `recentFeaturedServiceIds`
> คือบริการที่เพิ่ง featured ไปไม่นาน เพื่อให้ AI เลี่ยงการเลือกซ้ำ
> ⚠️ ชื่อฟิลด์ต่างจากฝั่ง Caption: Decision ใช้ `priceMinor` แต่ Caption ใช้ `price`

### Callback (AI → backend)

```json
{
  "planId": "9d2e5c4a-...",
  "decision": {
    "shouldPost": true,
    "reasoning": "...",
    "suggestedScheduledAt": "2026-06-28T11:00:00Z",
    "postType": "promotion",
    "featuredServiceIds": ["svc-1"],
    "captionHint": "..."
  }
}
```

เมื่อ `shouldPost` เป็น `false` จะส่งกลับเฉพาะ `shouldPost` + `reasoning`
กรณีเกิดข้อผิดพลาด: `{ "planId": "...", "error": { "code": "internal_error", "message": "..." } }`

---

## Endpoint 2 — AI Caption

`POST /api/ai/caption/generate` → ตอบ `202 Accepted` แล้ว callback ไปที่ `callbackUrl`

### Request (backend → AI)

```json
{
  "callbackUrl": "https://api.example.com/internal/ai/caption/callback",
  "jobId": "7f8e9d0c-...",
  "postId": "6e7d8c9b-...",
  "business": {
    "id": "8a1f3b2c-...",
    "name": "ร้านกาแฟดอยช้าง",
    "tone": "เป็นกันเอง อบอุ่น",
    "keywords": ["กาแฟสด", "ดอยช้าง"]
  },
  "postType": "promotion",
  "featuredServices": [
    { "id": "svc-1", "name": "ลาเต้เย็น", "description": "กาแฟนมเย็น", "price": 6500, "currency": "THB" }
  ],
  "captionHint": "...",
  "targetAudience": "คนรุ่นใหม่ วัยทำงาน"
}
```

### Callback (AI → backend)

request มีฟิลด์ `mediaType` = `"image"` หรือ `"short_video"` (backend เป็นผู้กำหนด)

```json
{
  "jobId": "7f8e9d0c-...",
  "result": {
    "caption": "ศุกร์นี้พบกับโปรสุดคุ้ม! 🍜 ... #กาแฟสด #ดอยช้าง",
    "mediaRequest": {
      "content_type": "short_video",
      "aspect_ratio": "9:16",
      "style": "cinematic_fantasy",
      "negative_prompt": "blurry, low quality, text, logo, watermark",
      "scenes": [
        { "prompt": "Scene 1: English visual description ..." },
        { "prompt": "Scene 2: ..." },
        { "prompt": "Scene 3: ..." },
        { "prompt": "Scene 4: ..." }
      ],
      "metadata": { "campaign_id": "post-id" }
    }
  }
}
```

`caption` เป็นข้อความเดียว (ฝัง hashtag ไว้ในตัว) ความยาวไม่เกิน 2000 ตัวอักษร
(แนะนำ 100–500 ตัวอักษร) กรณีเกิดข้อผิดพลาด:
`{ "jobId": "...", "error": { "code": "model_error", "message": "..." } }`

> **`mediaRequest` (scene prompts ภาษาอังกฤษ):** payload สำหรับ AI Media ในรูปแบบของ
> AI Media เอง (snake_case). `content_type` มาจาก `mediaType` ใน request:
> `image` → 1 scene, `aspect_ratio` `5:4`; `short_video` → 4 scenes (ฉากละ ~8 วินาที,
> ต่อเนื่องเป็นเรื่องเดียว), `aspect_ratio` `9:16`
>
> ⚠️ **ต้องยืนยันกับทีม:** (1) backend ต้องเติม `callback_url` ก่อนส่งต่อให้ AI Media;
> (2) ค่า `style` ที่ใช้ได้มีอะไรบ้าง (ตอนนี้ default `cinematic_fantasy`);
> (3) โครงสร้างนี้ยังไม่ตรงกับ `docs/contracts/AI-MEDIA.md` เดิม — ใช้ตามที่ทีม AI Media
> กำหนดล่าสุด

> **เรื่องสื่อ (Media):** เซอร์วิสนี้ **ไม่ได้** เรียก AI Media เอง เราเพียงสร้าง `mediaRequest`
> ให้ ส่วน backend จะเป็นผู้ส่งต่อ (พร้อมเติม `callback_url`) ไปยัง AI Media

---

## การเชื่อมต่อสองเซอร์วิส (สำหรับ backend)

Decision จะส่ง `featuredServiceIds` (เป็น id เท่านั้น) ส่วน Caption ต้องการ
`featuredServices` (เป็นออบเจกต์เต็ม) ดังนั้น backend ต้องนำ id ไปค้นหาใน
แค็ตตาล็อกของตัวเองระหว่างสองการเรียก ดูตัวอย่างที่รันได้จริงได้ที่
[`scripts/demo_pipeline.py`](scripts/demo_pipeline.py) ซึ่งจะพิมพ์ payload ของ
callback ทั้งสองออกมา

## การทดสอบ (Tests)

```powershell
venv\Scripts\python.exe -m pytest -v
```

มี 11 เทสต์ ครอบคลุมการแปลง camelCase, กฎการตัดสินใจ, การสร้างแคปชั่น และ
รูปแบบ payload ของ callback โดย Groq ถูก mock ไว้ จึงไม่มีการเรียก API จริง

> บน Windows ให้ตั้งค่า `PYTHONIOENCODING=utf-8` ก่อนรันสคริปต์ที่พิมพ์ภาษาไทย
