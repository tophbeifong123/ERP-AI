"""End-to-end demo: AI Decision -> AI Caption pipeline (contract-aligned).

The live services are async: they accept a request and POST the result to a
`callbackUrl`. To demo locally without a callback server, this script calls the
core functions (build_decision / build_caption) directly and prints the exact
callback payloads that WOULD be sent to the backend (camelCase JSON).

Makes REAL Groq calls. Run from the ai-services folder:
    PYTHONIOENCODING=utf-8 venv/Scripts/python.exe scripts/demo_pipeline.py
"""
import json
import sys
from pathlib import Path
from datetime import datetime, timezone

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.schemas.decision import (
    DecisionRequest, BusinessContext, RecentPost, ServiceInfo, DecisionCallback,
)
from app.schemas.caption import CaptionRequest, CaptionCallback
from app.services.decision_service import build_decision
from app.services.caption_service import build_caption


def _dump(model):
    return json.dumps(model.model_dump(by_alias=True, mode="json"), ensure_ascii=False, indent=2)


def main():
    business = BusinessContext(
        id="8a1f3b2c-0001",
        name="ร้านกาแฟดอยช้าง",
        industry="ร้านกาแฟ",
        description="กาแฟสดคั่วเองจากดอยช้าง",
        tone="เป็นกันเอง อบอุ่น",
        target_audience="คนรุ่นใหม่ วัยทำงาน",
        keywords=["กาแฟสด", "ดอยช้าง"],
        posts_per_week_target=3,
        min_gap_days=1,
    )
    catalogue = [
        ServiceInfo(id="svc-1", name="ลาเต้เย็น", description="กาแฟนมเย็น", price=6500, currency="THB"),
        ServiceInfo(id="svc-2", name="อเมริกาโน่", description="กาแฟดำ", price=5500, currency="THB"),
    ]

    # --- STEP 1: Decision ---
    decision_req = DecisionRequest(
        callback_url="https://api.example.com/internal/ai/decide/callback",
        plan_id="plan-demo-001",
        business=business,
        recent_posts=[RecentPost(posted_at=datetime(2026, 6, 24, 13, 0, tzinfo=timezone.utc), post_type="promotion")],
        posts_this_week=1,
        last_post_at=datetime(2026, 6, 24, 13, 0, tzinfo=timezone.utc),
        now_iso=datetime.now(timezone.utc),
        services=catalogue,
    )

    print("STEP 1 - Decision callback payload (AI -> backend):")
    decision = build_decision(decision_req)
    print(_dump(DecisionCallback(plan_id=decision_req.plan_id, decision=decision)))

    if not decision.should_post:
        print("\nDecision says DO NOT post. Backend would stop here.")
        return

    # --- Glue: backend maps featuredServiceIds -> full services for caption ---
    featured = [s for s in catalogue if s.id in decision.featured_service_ids]

    caption_req = CaptionRequest(
        callback_url="https://api.example.com/internal/ai/caption/callback",
        job_id="job-demo-001",
        post_id="post-demo-001",
        business=business,
        post_type=decision.post_type,
        featured_services=featured,
        caption_hint=decision.caption_hint,
        target_audience=business.target_audience,
    )

    # --- STEP 2: Caption ---
    print("\nSTEP 2 - Caption callback payload (AI -> backend):")
    result = build_caption(caption_req)
    print(_dump(CaptionCallback(job_id=caption_req.job_id, result=result)))

    print("\nPIPELINE COMPLETE - decision flowed into caption successfully.")


if __name__ == "__main__":
    main()
