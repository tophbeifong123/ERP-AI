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
เขียนแคปชั่นโพสต์ Facebook ภาษาไทย 1 ชิ้น ที่:
1. ดึงดูดความสนใจตั้งแต่บรรทัดแรก
2. ใช้โทนการสื่อสารตามที่กำหนด
3. มี emoji ที่เหมาะสม (ไม่มากเกินไป)
4. มี call-to-action ชัดเจน
5. ใส่ hashtag ที่เกี่ยวข้องไว้ท้ายแคปชั่น
6. ความยาวแนะนำ 100-500 ตัวอักษร (ห้ามเกิน {MAX_CAPTION_CHARS})

ตอบกลับในรูปแบบ JSON นี้เท่านั้น (ห้ามมีข้อความอื่น):
{{
  "caption": "เนื้อหาแคปชั่นภาษาไทย รวม emoji และ hashtag ท้ายข้อความ"
}}"""


def build_caption(req: CaptionRequest) -> CaptionResult:
    """Core logic: generate a single Thai caption (hashtags embedded).

    If the LLM call fails, fall back to a template that wraps the user's
    hint in a Thai-looking caption with a basic hashtag set.
    """
    try:
        prompt = _build_prompt(req)
        response = client.chat.completions.create(
            model=MODEL,
            messages=[
                {"role": "system", "content": "คุณเป็นนักเขียนแคปชั่นการตลาดภาษาไทย ตอบกลับด้วย JSON ที่ถูกต้องเท่านั้น"},
                {"role": "user", "content": prompt},
            ],
            temperature=0.8,
            max_tokens=600,
        )

        raw = response.choices[0].message.content.strip()
        if raw.startswith("```"):
            raw = raw.split("\n", 1)[1].rsplit("```", 1)[0].strip()
        data = json.loads(raw)

        caption = data["caption"].strip()[:MAX_CAPTION_CHARS]
        if caption:
            return CaptionResult(caption=caption)
    except Exception as e:
        # Fall through to the fallback below
        import logging
        logging.warning(f"Caption LLM call failed, using hint fallback: {e}")

    # Fallback: build a basic Thai caption from the hint and business name.
    hint = (req.caption_hint or "").strip()
    biz_name = req.business.name or "ร้านค้า"
    type_label = {
        "promotion": "โปรโมชั่น",
        "product_showcase": "แนะนำสินค้า",
        "brand_awareness": "สร้างแบรนด์",
        "event": "กิจกรรม",
    }.get(req.post_type.value if req.post_type else "", "อัปเดต")
    hashtag_pool = ["#marketing", "#ร้านค้า", "#โปรโมชั่น", "#ขายดี", "#ลดราคา"]
    hashtags = " ".join(hashtag_pool[:3])
    body = hint if hint else f"{biz_name} มีอะไรน่าสนใจมากมาย ติดตามได้เลย"
    fallback = f"✨ {biz_name}\n\n{type_label}: {body}\n\nสนใจสอบถามข้อมูลเพิ่มเติมได้เลยค่ะ 👇\n\n{hashtags}"
    return CaptionResult(caption=fallback[:MAX_CAPTION_CHARS])


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
