"""End-to-end demo: AI Decision -> AI Caption pipeline.

Runs the full flow the way the backend eventually will:
  1. Ask the Decision service whether to post today.
  2. If yes, map the decision's output (post_type, featured ids, hint)
     into a Caption request and generate the Thai caption.

This makes REAL Groq API calls. Run from the ai-services folder:
    PYTHONIOENCODING=utf-8 venv/Scripts/python.exe scripts/demo_pipeline.py
"""
import json
import sys
from pathlib import Path
from datetime import datetime

# Allow running this file directly: add the ai-services root (parent of
# scripts/) to the import path so the `app` package can be found.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.schemas.decision import (
    DecisionRequest,
    BusinessContext,
    PostingConfig,
    RecentPostInfo,
    ServiceInfo,
)
from app.schemas.caption import CaptionRequest
from app.services.decision_service import decide
from app.services.caption_service import generate_caption


def main():
    # --- Shared business context + catalogue (the backend would load this) ---
    business = BusinessContext(
        business_id="shop-001",
        name="ร้านกาแฟดอยช้าง",
        industry="ร้านกาแฟ",
        description="กาแฟสดคั่วเองจากดอยช้าง บรรยากาศอบอุ่น",
        tone="เป็นกันเอง อบอุ่น",
        target_audience="คนรุ่นใหม่ วัยทำงาน",
        keywords=["กาแฟสด", "ดอยช้าง", "คาเฟ่"],
    )
    catalogue = [
        ServiceInfo(id="svc-1", name="ลาเต้เย็น", description="กาแฟนมเย็น", price_minor=6500),
        ServiceInfo(id="svc-2", name="อเมริกาโน่", description="กาแฟดำ", price_minor=5500),
    ]

    # --- STEP 1: Decision ---
    decision_req = DecisionRequest(
        business=business,
        posting_config=PostingConfig(posts_per_week_target=3, min_gap_days=1),
        recent_posts=RecentPostInfo(last_post_date=None, posts_this_week=0),
        services=catalogue,
        current_time=datetime.now(),
    )

    print("STEP 1 - Decision service deciding...")
    decision = decide(decision_req)
    print(json.dumps(decision.model_dump(), ensure_ascii=False, indent=2, default=str))

    if not decision.should_post:
        print("\nDecision says DO NOT post today. Pipeline stops here.")
        return

    # --- Glue: map decision output into a caption request ---
    featured = [s for s in catalogue if s.id in decision.featured_service_ids]

    caption_req = CaptionRequest(
        business=business,
        post_type=decision.post_type,
        featured_services=featured,
        caption_hint=decision.caption_hint,
        trigger_media=False,  # teammate's Media service may be offline
    )

    # --- STEP 2: Caption ---
    print("\nSTEP 2 - Caption service generating...")
    caption = generate_caption(caption_req)
    print(json.dumps(caption.model_dump(), ensure_ascii=False, indent=2, default=str))

    print("\nPIPELINE COMPLETE - decision flowed into caption successfully.")


if __name__ == "__main__":
    main()
