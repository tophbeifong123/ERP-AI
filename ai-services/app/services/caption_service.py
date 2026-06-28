import json
import httpx
from groq import Groq
from app.core.config import settings
from app.schemas.caption import CaptionRequest, CaptionResponse

client = Groq(api_key=settings.GROQ_API_KEY)
MODEL = "llama-3.3-70b-versatile"


def _build_prompt(req: CaptionRequest) -> str:
    services_text = ""
    if req.featured_services:
        services_text = "\n".join(
            f"  - {s.name}: {s.description or 'N/A'}"
            + (f" (ราคา {s.price_minor / 100:.0f} บาท)" if s.price_minor else "")
            for s in req.featured_services
        )
    else:
        services_text = "  ไม่มีบริการที่ต้องเน้น"

    return f"""คุณเป็นนักการตลาดดิจิทัลมืออาชีพสำหรับธุรกิจ SME ไทย
หน้าที่ของคุณคือเขียนแคปชั่นโพสต์ Facebook ภาษาไทยที่ดึงดูดและเป็นธรรมชาติ

## ข้อมูลธุรกิจ
- ชื่อร้าน: {req.business.name}
- ประเภทธุรกิจ: {req.business.industry or 'ทั่วไป'}
- รายละเอียด: {req.business.description or 'N/A'}
- โทนการสื่อสาร: {req.business.tone or 'เป็นกันเอง'}
- กลุ่มเป้าหมาย: {req.business.target_audience or 'ลูกค้าทั่วไป'}
- คีย์เวิร์ด: {', '.join(req.business.keywords) if req.business.keywords else 'N/A'}

## ประเภทโพสต์
{req.post_type.value if req.post_type else 'brand_awareness'}

## บริการ/สินค้าที่ต้องการเน้น
{services_text}

## คำแนะนำเพิ่มเติม
{req.caption_hint or 'ไม่มี'}

## งานของคุณ
เขียนแคปชั่นโพสต์ Facebook ภาษาไทยที่:
1. ดึงดูดความสนใจตั้งแต่บรรทัดแรก
2. ใช้โทนการสื่อสารตามที่กำหนด
3. มี emoji ที่เหมาะสม (ไม่มากเกินไป)
4. มี call-to-action ชัดเจน
5. เหมาะกับกลุ่มเป้าหมาย

ตอบกลับในรูปแบบ JSON นี้เท่านั้น (ห้ามมีข้อความอื่น):
{{
  "caption": "เนื้อหาแคปชั่นภาษาไทย รวม emoji",
  "hashtags": ["#แฮชแท็ก1", "#แฮชแท็ก2"],
  "call_to_action": "ประโยคชวนให้ลูกค้าทำอะไรต่อ"
}}"""


def _trigger_media(req: CaptionRequest, caption: str) -> tuple[bool, str]:
    """Fire-and-report call to the AI Media service. Never raises."""
    try:
        headers = {}
        if settings.INTERNAL_TOKEN:
            headers["Authorization"] = f"Bearer {settings.INTERNAL_TOKEN}"

        payload = {
            "business_id": req.business.business_id,
            "caption": caption,
            "post_type": req.post_type.value if req.post_type else None,
            "service_ids": [s.id for s in req.featured_services],
        }

        with httpx.Client(timeout=10.0) as http:
            resp = http.post(
                f"{settings.AI_MEDIA_SERVICE_URL}/api/ai/media/generate",
                json=payload,
                headers=headers,
            )
            resp.raise_for_status()
        return True, "Media generation triggered"
    except Exception as e:
        return False, f"Media service unavailable: {e}"


def generate_caption(req: CaptionRequest) -> CaptionResponse:
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

    caption = data["caption"]
    hashtags = data.get("hashtags", [])
    call_to_action = data.get("call_to_action")

    media_triggered = False
    media_status = None
    if req.trigger_media:
        media_triggered, media_status = _trigger_media(req, caption)

    return CaptionResponse(
        caption=caption,
        hashtags=hashtags,
        call_to_action=call_to_action,
        media_triggered=media_triggered,
        media_status=media_status,
    )
