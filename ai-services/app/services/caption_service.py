import json

from groq import Groq

from app.core.config import settings
from app.core.security import post_callback
from app.schemas.caption import (
    CaptionRequest,
    CaptionResult,
    CaptionCallback,
    CaptionErrorCallback,
    MediaRequest,
    Scene,
)
from app.schemas.decision import ErrorInfo

client = Groq(api_key=settings.GROQ_API_KEY)
MODEL = "llama-3.3-70b-versatile"

MAX_CAPTION_CHARS = 2000
MAX_SCENE_CHARS = 600

# AI Media payload defaults. NOTE: confirm valid `style` values + aspect ratios
# with the AI Media teammate — these are best-guess defaults.
ASPECT_RATIO = {"image": "4:5", "short_video": "9:16"}
VIDEO_SCENE_COUNT = 4   # each scene ~8s (AI Media limit) -> ~32s total
IMAGE_SCENE_COUNT = 1
DEFAULT_STYLE = "modern_minimal"   # fallback if the model doesn't pick a style
MAX_STYLE_CHARS = 60
NEGATIVE_PROMPT = "blurry, low quality, text, logo, watermark"


def _scene_count(media_type: str) -> int:
    return VIDEO_SCENE_COUNT if media_type == "short_video" else IMAGE_SCENE_COUNT


def _build_prompt(req: CaptionRequest) -> str:
    if req.featured_services:
        services_text = "\n".join(
            f"  - {s.name}: {s.description or 'N/A'}"
            + (f" (ราคา {s.price / 100:.0f} {s.currency or 'บาท'})" if s.price else "")
            for s in req.featured_services
        )
    else:
        services_text = "  ไม่มีบริการที่ต้องเน้น"

    n = _scene_count(req.media_type)
    if req.media_type == "short_video":
        scene_instruction = (
            f"สร้าง scene ภาษาอังกฤษ {n} ฉาก ที่ \"ต่อเนื่องเป็นเรื่องเดียวกัน\" "
            f"(แต่ละฉากยาวประมาณ 8 วินาที รวมเป็นวิดีโอสั้น) เรียงลำดับเล่าเรื่อง "
            f"เริ่ม-กลาง-จบ ให้เห็นสินค้า/บริการ ฉากสุดท้ายให้สื่อ call-to-action "
            f"ด้วย \"ภาพ\" เท่านั้น (เช่น คนยิ้มชูแก้วเชิญชวน) ห้ามใช้ป้าย/ข้อความ/ตัวเลขราคา"
        )
    else:
        scene_instruction = (
            f"สร้าง scene ภาษาอังกฤษ {n} ฉาก สำหรับภาพนิ่ง 1 ภาพที่ดึงดูดที่สุด"
        )

    return f"""คุณเป็นนักการตลาดดิจิทัลมืออาชีพสำหรับธุรกิจ SME ไทย
และเป็นผู้เชี่ยวชาญการเขียน prompt สร้างภาพ/วิดีโอ (ภาษาอังกฤษ)

## ข้อมูลธุรกิจ
- ชื่อร้าน: {req.business.name}
- ประเภทธุรกิจ: {req.business.industry or 'ทั่วไป'}
- โทนการสื่อสาร: {req.business.tone or 'เป็นกันเอง'}
- กลุ่มเป้าหมาย: {req.target_audience or 'ลูกค้าทั่วไป'}
- คีย์เวิร์ด: {', '.join(req.business.keywords) if req.business.keywords else 'N/A'}

## ประเภทโพสต์: {req.post_type.value}
## ชนิดสื่อที่ต้องสร้าง: {req.media_type}

## บริการ/สินค้าที่ต้องการเน้น
{services_text}

## คำแนะนำเพิ่มเติม
{req.caption_hint or 'ไม่มี'}

## งานของคุณ
สร้าง 2 สิ่ง:

### 1) caption (ภาษาไทย)
แคปชั่นโพสต์ Facebook ภาษาไทย 1 ชิ้น: ดึงดูดตั้งแต่บรรทัดแรก, ใช้โทนที่กำหนด,
มี emoji พอเหมาะ, มี call-to-action, ใส่ hashtag ท้ายข้อความ,
ความยาวแนะนำ 100-500 ตัวอักษร (ห้ามเกิน {MAX_CAPTION_CHARS})

### 2) scenes (ภาษาอังกฤษเท่านั้น)
{scene_instruction}
ข้อกำหนดของแต่ละ scene:
- เป็น **ภาษาอังกฤษ** บรรยายภาพ: subject, setting, lighting, composition, mood
- สอดคล้องกับสินค้า/บริการ ประเภทโพสต์ และโทนแบรนด์
- photorealistic / appetizing ถ้าเกี่ยวกับอาหาร
- **ห้ามบรรยายตัวอักษร ข้อความ ป้าย เมนู โลโก้ หรือตัวเลขราคาในฉากเด็ดขาด**
  (ห้ามเขียนสิ่งที่ทำให้เกิดข้อความในภาพ เช่น "a sign that says...", "text reading...")
  ถ้าต้องสื่อโปรโมชัน/ราคา ให้ใช้ภาษากายและการกระทำแทน (no text, no logo, no watermark)
- กระชับ ไม่เกิน {MAX_SCENE_CHARS} ตัวอักษรต่อฉาก

### 3) style (ภาษาอังกฤษ สั้นๆ)
เลือก "สไตล์ภาพรวม" ที่เหมาะกับสินค้า/แบรนด์/ประเภทโพสต์มากที่สุด เป็นวลีสั้นๆ ภาษาอังกฤษ
(เช่น "warm lifestyle photography", "modern minimal product shot", "cinematic food commercial")

ตอบกลับเป็น JSON นี้เท่านั้น (ห้ามมีข้อความอื่น) โดย scenes มี {n} รายการ:
{{
  "caption": "เนื้อหาแคปชั่นภาษาไทย รวม emoji และ hashtag",
  "style": "short English style descriptor",
  "scenes": ["English scene 1", ...]
}}"""


def _build_media_request(req: CaptionRequest, scene_prompts: list[str], style: str) -> MediaRequest:
    n = _scene_count(req.media_type)
    cleaned = [p.strip()[:MAX_SCENE_CHARS] for p in scene_prompts if p and p.strip()]
    scenes = [Scene(prompt=p) for p in cleaned[:n]]
    return MediaRequest(
        content_type=req.media_type,
        aspect_ratio=ASPECT_RATIO[req.media_type],
        style=style,
        negative_prompt=NEGATIVE_PROMPT,
        prompt=cleaned[0] if cleaned else "",   # image branch reads this
        scenes=scenes,
        metadata={"campaign_id": req.post_id},
    )


def build_caption(req: CaptionRequest) -> CaptionResult:
    """Generate a Thai caption + an English AI Media request in one Groq call."""
    prompt = _build_prompt(req)
    response = client.chat.completions.create(
        model=MODEL,
        messages=[
            {"role": "system", "content": "คุณเป็นนักเขียนแคปชั่นการตลาดภาษาไทยและผู้เชี่ยวชาญการเขียน prompt สร้างภาพ/วิดีโอภาษาอังกฤษ ตอบกลับด้วย JSON ที่ถูกต้องเท่านั้น"},
            {"role": "user", "content": prompt},
        ],
        temperature=0.8,
        max_tokens=1200,
    )

    raw = response.choices[0].message.content.strip()
    if raw.startswith("```"):
        raw = raw.split("\n", 1)[1].rsplit("```", 1)[0].strip()
    data = json.loads(raw)

    caption = data["caption"].strip()[:MAX_CAPTION_CHARS]
    scene_prompts = data.get("scenes") or []
    style = (data.get("style") or "").strip()[:MAX_STYLE_CHARS] or DEFAULT_STYLE
    media_request = _build_media_request(req, scene_prompts, style) if scene_prompts else None
    return CaptionResult(caption=caption, media_request=media_request)


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
