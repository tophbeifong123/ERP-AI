# คู่มือการเชื่อมต่อ — AI Decision & Caption Services

สำหรับทีม backend ที่จะนำเซอร์วิสนี้ไปเชื่อมต่อกับ backend ของเว็บหลัก เซอร์วิสนี้
ทำให้ตรงตาม contract ที่ `docs/contracts/AI-DECISION.md` และ `AI-CAPTION.md` แล้ว

---

## 1. วิธีเรียกใช้เซอร์วิสเรา (backend → AI)

ทั้งสอง endpoint ทำงานแบบ **asynchronous** คือตอบ `202 Accepted` กลับทันที แล้วค่อย
POST ผลลัพธ์ไปที่ `callbackUrl` ที่ส่งมาใน request

| เซอร์วิส | Method & Path | คำตอบยืนยัน (ack) |
|---------|---------------|-------------------|
| Decision | `POST <AI_DECISION_URL>/decide` | `202 { "status": "accepted", "planId": "..." }` |
| Caption  | `POST <AI_CAPTION_URL>/generate` | `202 { "status": "accepted", "jobId": "..." }` |

**ตั้งค่า base URL เหล่านี้ใน env ของ backend** (สังเกต path prefix ด้วย):

```
AI_DECISION_URL = http://<ai-host>:8000/api/ai/decision
AI_CAPTION_URL  = http://<ai-host>:8000/api/ai/caption
```

**การยืนยันตัวตน (Auth):** แนบ secret ที่ใช้ร่วมกันในทุก request:
```
X-Internal-Token: <INTERNAL_TOKEN>
```
เราจะแนบ header เดียวกันนี้กลับไปตอน callback ด้วย เพื่อให้ฝั่งคุณยืนยันได้ว่าเป็นเราจริง

---

## 2. สิ่งที่เราส่งกลับ (AI → callbackUrl ของ backend)

เราจะ `POST` ไปที่ `callbackUrl` ของคุณ พร้อม header `Content-Type: application/json`
และ `X-Internal-Token`

**Callback ของ Decision:**
```json
{ "planId": "...", "decision": {
    "shouldPost": true, "reasoning": "...",
    "suggestedScheduledAt": "2026-06-28T11:00:00Z",
    "postType": "promotion", "featuredServiceIds": ["svc-1"], "captionHint": "..." } }
```
(เมื่อ `shouldPost` เป็น false: ส่งเฉพาะ `shouldPost` + `reasoning`)

**Callback ของ Caption:** (request ต้องมี `mediaType` = `image` หรือ `short_video`)
```json
{ "jobId": "...", "result": {
    "caption": "…แคปชั่นภาษาไทยฉบับเต็มพร้อม #hashtag…",
    "mediaRequest": {
      "content_type": "short_video",     // หรือ "image"
      "aspect_ratio": "9:16",            // image = "5:4"
      "style": "cinematic_fantasy",
      "negative_prompt": "blurry, low quality, text, logo, watermark",
      "scenes": [ { "prompt": "English scene 1" }, ... ],   // video=4, image=1
      "metadata": { "campaign_id": "<postId>" }
    } } }
```
> `mediaRequest` คือ payload สำหรับ AI Media โดยตรง (snake_case) scene prompts เป็น
> **ภาษาอังกฤษ** video = 4 ฉาก (ฉากละ ~8 วินาที), image = 1 ฉาก
> ⚠️ **backend ต้องเติม `callback_url`** ของ AI Media ก่อนส่งต่อ และต้องยืนยันค่า `style`
> ที่ใช้ได้กับทีม AI Media (default `cinematic_fantasy`)

**Callback กรณีข้อผิดพลาด (ทั้งสองเซอร์วิส):**
```json
{ "planId|jobId": "...", "error": { "code": "internal_error|model_error", "message": "..." } }
```

---

## 3. หมายเหตุเรื่องชื่อฟิลด์ (รบกวนตรวจสอบฝั่งคุณด้วย)

- `services[]` ของ Decision ใช้ **`priceMinor`** ส่วน `featuredServices[]` ของ Caption
  ใช้ **`price`** ทั้งคู่หน่วยเป็นสตางค์ (ตรงตาม contract ของคุณ — แจ้งไว้เพราะสองฝั่งใช้ชื่อต่างกัน)
- Request ของ Decision: บริการที่เพิ่ง featured มาในฟิลด์ระดับบนสุดชื่อ
  **`recentFeaturedServiceIds`** (ไม่ได้อยู่ใน `recentPosts[]`)
- ทุกฟิลด์เป็น **camelCase**

---

## 4. เรื่องเวลา (Timing)

- เราประมวลผลใน background แล้ว callback กลับเมื่อเสร็จ (การเรียก Groq ใช้เวลาราว 3–10 วินาที)
- contract ของคุณอนุญาตให้รอได้ถึง 10 นาที + มี retry ซึ่งเราทำงานเสร็จเร็วกว่านั้นมาก

---

## 5. สิ่งที่เราต้องการจากทีม backend

1. **Secret ที่ใช้ร่วมกัน** — ค่า `INTERNAL_TOKEN` เพื่อให้ตรงกันทั้งสองฝั่ง
2. **การเข้าถึงเครือข่าย** — เซอร์วิส AI ต้องเรียก `callbackUrl` ของคุณได้ และคุณต้อง
   เรียก host:port ของ AI ได้เช่นกัน
3. **การ deploy** — เซอร์วิส Python นี้จะรันที่ไหน (host เดียวกัน? container? URL อะไร?)
4. **ตัวกระตุ้นสำหรับทดสอบ** — ช่วยยิง request Decision จริงมาที่เซอร์วิสที่เรารันอยู่
   เพื่อยืนยันว่า callback ครบวงจร (end-to-end จริง)
5. **ตกลงเรื่อง `mediaPrompt`** — เราสร้าง prompt ภาษาอังกฤษให้แล้วในผลลัพธ์ของ Caption
   ต้องคุยกับทีม AI Media ว่าจะรับฟิลด์นี้เข้าไปใน request ของ media generation อย่างไร

---

## 6. การรันบนเครื่อง (สำหรับทดสอบร่วมกัน)

```powershell
cd ai-services
venv\Scripts\uvicorn app.main:app --host 0.0.0.0 --port 8000
```
ตรวจสุขภาพระบบ: `GET http://<ai-host>:8000/health` → `{"status":"ok"}`
