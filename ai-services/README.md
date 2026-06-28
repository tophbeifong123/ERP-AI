# ERP-AI Services

AI microservice for the ERP-AI project. Two endpoints:

1. **AI Decision** — decides *whether*, *when*, and *what* a business should post.
2. **AI Caption** — generates a Thai-language caption for the post.

Built with FastAPI + Groq (Llama 3.3 70B). Aligned to the backend contracts in
`docs/contracts/AI-DECISION.md` and `AI-CAPTION.md`.

## Architecture: async callback

Both endpoints are **asynchronous**. The backend POSTs a request containing a
`callbackUrl`; the service replies **`202 Accepted`** immediately, does the work
in the background, then **POSTs the result back** to `callbackUrl`.

```
Backend  --POST /decide  (with callbackUrl)-->  AI Service
Backend  <--202 Accepted--------------------    AI Service
                                                AI Service --(Groq)--> result
Backend  <--POST {callbackUrl} (result)-------  AI Service
```

Auth: every request and callback carries an `X-Internal-Token` header (shared secret).

---

## Setup

```powershell
cd ai-services
python -m venv venv
venv\Scripts\pip install -r requirements.txt
copy .env.example .env   # then fill in GROQ_API_KEY and INTERNAL_TOKEN
```

`.env` keys: `GROQ_API_KEY` (required), `INTERNAL_TOKEN` (shared secret).

## Run

```powershell
venv\Scripts\uvicorn app.main:app --reload
```

Docs: <http://localhost:8000/docs> · Health: `GET /health`

---

## Endpoint 1 — AI Decision

`POST /api/ai/decision/decide` → `202 Accepted`, then callback to `callbackUrl`.

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

> `services[]` is sent by the backend (Option 1) so the AI can pick `featuredServiceIds`.
> `priceMinor` is in **satang** (6500 = 65.00 THB). `recentFeaturedServiceIds` lists
> services already featured recently, so the AI avoids repeating them.
> ⚠️ Field name differs from Caption: Decision uses `priceMinor`, Caption uses `price`.

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

When `shouldPost` is `false`, only `shouldPost` + `reasoning` are sent. On failure:
`{ "planId": "...", "error": { "code": "internal_error", "message": "..." } }`.

---

## Endpoint 2 — AI Caption

`POST /api/ai/caption/generate` → `202 Accepted`, then callback to `callbackUrl`.

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

```json
{
  "jobId": "7f8e9d0c-...",
  "result": { "caption": "ศุกร์นี้พบกับโปรสุดคุ้ม! 🍜 ... #กาแฟสด #ดอยช้าง" }
}
```

The caption is a single string (hashtags embedded), ≤2000 chars (100–500 recommended).
On failure: `{ "jobId": "...", "error": { "code": "model_error", "message": "..." } }`.

> **Media:** this service does **not** trigger AI Media. The backend orchestrates
> image/video generation separately (see `docs/contracts/AI-MEDIA.md`).

---

## Connecting the two (backend)

Decision returns `featuredServiceIds` (IDs); Caption needs `featuredServices`
(full objects). The backend looks the IDs up in its catalogue between the calls.
See [`scripts/demo_pipeline.py`](scripts/demo_pipeline.py) for a runnable example
that prints both callback payloads.

## Tests

```powershell
venv\Scripts\python.exe -m pytest -v
```

11 tests covering camelCase parsing, decision rules, caption generation, and
callback payload shape. Groq is mocked — no API calls.

> On Windows, set `PYTHONIOENCODING=utf-8` before running scripts that print Thai.
