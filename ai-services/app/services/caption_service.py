import json

from groq import Groq

from app.core.config import settings
from app.core.security import post_callback
from app.schemas.caption import (
    CaptionRequest,
    CaptionResult,
    CaptionCallback,
    CaptionErrorCallback,
)
from app.schemas.decision import ErrorInfo

client = Groq(api_key=settings.GROQ_API_KEY)
MODEL = "llama-3.3-70b-versatile"

MAX_CAPTION_CHARS = 2000
MAX_MEDIA_PROMPT_CHARS = 1000


def _build_prompt(req: CaptionRequest) -> str:
    if req.featured_services:
        services_text = "\n".join(
            f"  - {s.name}: {s.description or 'N/A'}"
            + (f" (ราคา {s.price / 100:.0f} {s.currency or 'บาท'})" if s.price else "")
            for s in req.featured_services
        )
    else:
        services_text = "  ไม่มีบริการที่ต้องเน้น"

    return f"""คุณเป็นนักการตลาดดิจิทัลมืออาชีพสำหรับธุรกิจ SME ไทย
หน้าที่ของคุณคือเขียนแคปชั่นโพสต์ Facebook ภาษาไทยที่ดึงดูดและเป็นธรรมชาติ

## ข้อมูลธุรกิจ
- ชื่อร้าน: {req.business.name}
- ประเภทธุรกิจ: {req.business.industry or 'ทั่วไป'}
- โทนการสื่อสาร: {req.business.tone or 'เป็นกันเอง'}
- กลุ่มเป้าหมาย: {req.target_audience or 'ลูกค้าทั่วไป'}
- คีย์เวิร์ด: {', '.join(req.business.keywords) if req.business.keywords else 'N/A'}

## ประเภทโพสต์
{req.post_type.value}

## บริการ/สินค้าที่ต้องการเน้น
{services_text}

## คำแนะนำเพิ่มเติม
{req.caption_hint or 'ไม่มี'}

## งานของคุณ
สร้าง 2 สิ่งต่อไปนี้:

### 1) caption (ภาษาไทย)
แคปชั่นโพสต์ Facebook ภาษาไทย 1 ชิ้น ที่:
- ดึงดูดความสนใจตั้งแต่บรรทัดแรก
- ใช้โทนการสื่อสารตามที่กำหนด
- มี emoji ที่เหมาะสม (ไม่มากเกินไป) และมี call-to-action ชัดเจน
- ใส่ hashtag ที่เกี่ยวข้องไว้ท้ายแคปชั่น
- ความยาวแนะนำ 100-500 ตัวอักษร (ห้ามเกิน {MAX_CAPTION_CHARS})

### 2) mediaPrompt (ภาษาอังกฤษเท่านั้น)
คำสั่งบรรยายภาพ/วิดีโอสั้นสำหรับ AI สร้างสื่อ (image / short video generator).
ต้องเป็น **ภาษาอังกฤษ** และเป็นการ "บรรยายภาพ" ไม่ใช่การแปลแคปชั่น โดย:
- บรรยายฉาก: subject, setting, lighting, composition, mood, style
- สอดคล้องกับสินค้า/บริการที่เน้น ประเภทโพสต์ และโทนแบรนด์
- เหมาะกับงานถ่ายภาพโฆษณาอาหาร/สินค้า (photorealistic, appetizing ถ้าเกี่ยวกับอาหาร)
- อย่าใส่ตัวอักษร/ข้อความลงในภาพ (no text, no watermark, no logo)
- กระชับ ไม่เกิน {MAX_MEDIA_PROMPT_CHARS} ตัวอักษร

ตอบกลับในรูปแบบ JSON นี้เท่านั้น (ห้ามมีข้อความอื่น):
{{
  "caption": "เนื้อหาแคปชั่นภาษาไทย รวม emoji และ hashtag ท้ายข้อความ",
  "mediaPrompt": "English visual description for image/video generation"
}}"""


def build_caption(req: CaptionRequest) -> CaptionResult:
    """Core logic: generate a Thai caption + an English media prompt in one call."""
    prompt = _build_prompt(req)
    response = client.chat.completions.create(
        model=MODEL,
        messages=[
            {"role": "system", "content": "คุณเป็นนักเขียนแคปชั่นการตลาดภาษาไทยและผู้เชี่ยวชาญการเขียน prompt สร้างภาพภาษาอังกฤษ ตอบกลับด้วย JSON ที่ถูกต้องเท่านั้น"},
            {"role": "user", "content": prompt},
        ],
        temperature=0.8,
        max_tokens=800,
    )

    raw = response.choices[0].message.content.strip()
    if raw.startswith("```"):
        raw = raw.split("\n", 1)[1].rsplit("```", 1)[0].strip()
    data = json.loads(raw)

    caption = data["caption"].strip()[:MAX_CAPTION_CHARS]
    media_prompt = (data.get("mediaPrompt") or "").strip()[:MAX_MEDIA_PROMPT_CHARS] or None
    return CaptionResult(caption=caption, media_prompt=media_prompt)


def process_caption(req: CaptionRequest) -> None:
    """Background task: generate the caption and POST it to callbackUrl."""
    try:
        result = build_caption(req)
        payload = CaptionCallback(job_id=req.job_id, result=result)
    except Exception as e:
        payload = CaptionErrorCallback(
            job_id=req.job_id,
            error=ErrorInfo(code="model_error", message=str(e)),
        )
    post_callback(req.callback_url, payload.model_dump(by_alias=True, mode="json"))
