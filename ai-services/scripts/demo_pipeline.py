"""Demo: AI Caption -> media request generation (caption side).

The live service is async: it accepts a request and POSTs the result to a
`callbackUrl`. To demo locally without a callback server, this calls the core
`build_caption` directly and prints the exact callback payload that WOULD be
sent to the backend (camelCase envelope; the mediaRequest is snake_case for the
AI Media n8n service).

NOTE: this focuses on the Caption/media side. The Decision service is owned by
the team and has been redesigned (AI Time Recommender), so it is not chained
here.

Makes a REAL Groq call. Run from the ai-services folder:
    PYTHONIOENCODING=utf-8 venv/Scripts/python.exe scripts/demo_pipeline.py
"""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.schemas.caption import (
    CaptionRequest, CaptionCallback, FeaturedService,
)
from app.schemas.decision import BusinessContext
from app.services.caption_service import build_caption


def _dump(model):
    return json.dumps(model.model_dump(by_alias=True, mode="json"), ensure_ascii=False, indent=2)


def run(media_type: str):
    business = BusinessContext(
        id="8a1f3b2c-0001",
        name="ร้านกาแฟดอยช้าง",
        industry="ร้านกาแฟ",
        tone="เป็นกันเอง อบอุ่น",
        target_audience="คนรุ่นใหม่ วัยทำงาน",
        keywords=["กาแฟสด", "ดอยช้าง"],
    )
    featured = [
        FeaturedService(id="svc-1", name="ลาเต้เย็น", description="กาแฟนมเย็น", price=6500, currency="THB"),
        FeaturedService(id="svc-2", name="อเมริกาโน่", description="กาแฟดำ", price=5500, currency="THB"),
    ]
    caption_req = CaptionRequest(
        callback_url="https://api.example.com/internal/ai/caption/callback",
        job_id="job-demo-001",
        post_id="post-demo-001",
        business=business,
        post_type="product_showcase",
        featured_services=featured,
        caption_hint="เน้นความสดของกาแฟจากดอยช้าง",
        target_audience=business.target_audience,
        media_type=media_type,
    )

    print(f"=== Caption callback payload (mediaType={media_type}) ===")
    result = build_caption(caption_req)
    print(_dump(CaptionCallback(job_id=caption_req.job_id, result=result)))
    print()


def main():
    run("short_video")   # shows scenes + master_prompt
    run("image")         # shows single-scene image request


if __name__ == "__main__":
    main()
