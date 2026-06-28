# ERP-AI Services

AI microservice for the ERP-AI project. Provides two endpoints:

1. **AI Decision** — decides *whether*, *when*, and *what* a business should post on Facebook.
2. **AI Caption** — generates a Thai-language caption for the post and (optionally) triggers the AI Media service.

Built with FastAPI + Groq (Llama 3.3 70B). Runs as a standalone service, decoupled from the main backend.

---

## Setup

```powershell
cd ai-services
python -m venv venv
venv\Scripts\pip install -r requirements.txt
copy .env.example .env   # then fill in GROQ_API_KEY
```

`.env` keys:

| Key | Purpose |
|-----|---------|
| `GROQ_API_KEY` | Groq API key (required) |
| `AI_MEDIA_SERVICE_URL` | Base URL of the AI Media service |
| `INTERNAL_TOKEN` | Shared secret, sent as `Authorization: Bearer` to AI Media |

## Run the server

```powershell
venv\Scripts\uvicorn app.main:app --reload
```

Interactive API docs: <http://localhost:8000/docs>
Health check: `GET /health` → `{"status": "ok"}`

---

## Endpoint 1 — AI Decision

`POST /api/ai/decision/decide`

Decides whether to post today. It first applies cheap rule-based guardrails
(weekly target reached? minimum gap since last post?) and only calls the AI
when those pass.

### Request

```json
{
  "business": {
    "business_id": "shop-001",
    "name": "ร้านกาแฟดอยช้าง",
    "industry": "ร้านกาแฟ",
    "description": "กาแฟสดคั่วเองจากดอยช้าง",
    "tone": "เป็นกันเอง อบอุ่น",
    "target_audience": "คนรุ่นใหม่ วัยทำงาน",
    "keywords": ["กาแฟสด", "ดอยช้าง"]
  },
  "posting_config": {
    "posts_per_week_target": 3,
    "min_gap_days": 1
  },
  "recent_posts": {
    "last_post_date": null,
    "posts_this_week": 0
  },
  "services": [
    { "id": "svc-1", "name": "ลาเต้เย็น", "description": "กาแฟนมเย็น", "price_minor": 6500 }
  ],
  "current_time": null
}
```

Notes:
- `price_minor` is in **satang** (6500 = 65.00 บาท).
- `current_time` may be `null` (server uses now).

### Response

```json
{
  "should_post": true,
  "reason": "Weekly target not reached and enough time has passed",
  "suggested_scheduled_at": "2026-06-28T19:00:00",
  "post_type": "product_showcase",
  "featured_service_ids": ["svc-1"],
  "caption_hint": "โปรดสัมผัสกาแฟสดคั่วเองจากดอยช้าง"
}
```

`post_type` is one of: `promotion`, `product_showcase`, `brand_awareness`, `event`.
When `should_post` is `false`, the other fields are `null`/empty.

---

## Endpoint 2 — AI Caption

`POST /api/ai/caption/generate`

Generates a Thai caption. If `trigger_media` is `true`, it also POSTs to the
AI Media service. The media call is **fault-tolerant** — if AI Media is down,
the caption still returns and `media_triggered` is `false`.

### Request

```json
{
  "business": {
    "business_id": "shop-001",
    "name": "ร้านกาแฟดอยช้าง",
    "tone": "เป็นกันเอง อบอุ่น",
    "target_audience": "คนรุ่นใหม่ วัยทำงาน",
    "keywords": ["กาแฟสด", "ดอยช้าง"]
  },
  "post_type": "product_showcase",
  "featured_services": [
    { "id": "svc-1", "name": "ลาเต้เย็น", "price_minor": 6500 }
  ],
  "caption_hint": "โปรดสัมผัสกาแฟสดคั่วเองจากดอยช้าง",
  "trigger_media": true
}
```

### Response

```json
{
  "caption": "วันนี้รู้สึกมันๆ กับลาเต้เย็น 😊 ราคาเพียง 65 บาท ...",
  "hashtags": ["#กาแฟสด", "#ดอยช้าง", "#คาเฟ่"],
  "call_to_action": "มาทานกาแฟสดคั่วเองที่ร้านกาแฟดอยช้างกัน!",
  "media_triggered": true,
  "media_status": "Media generation triggered"
}
```

When `trigger_media` is true, AI Media receives:

```json
{
  "business_id": "shop-001",
  "caption": "<generated caption>",
  "post_type": "product_showcase",
  "service_ids": ["svc-1"]
}
```

---

## Connecting the two (backend integration)

The Decision output feeds the Caption input. Note the one mapping the backend
must do: Decision returns `featured_service_ids` (IDs only), but Caption needs
`featured_services` (full objects), so look the IDs up in your catalogue:

```python
featured = [s for s in catalogue if s.id in decision.featured_service_ids]

caption_req = {
    "business": business,
    "post_type": decision.post_type,
    "featured_services": featured,
    "caption_hint": decision.caption_hint,
    "trigger_media": True,
}
```

A complete runnable example is in [`scripts/demo_pipeline.py`](scripts/demo_pipeline.py).

---

## Tests

```powershell
venv\Scripts\python.exe -m pytest -v
```

6 tests covering the decision rules, caption parsing, and media fault-tolerance.
Groq is mocked, so the suite makes no API calls.

> On Windows, set `PYTHONIOENCODING=utf-8` before running scripts that print Thai.
