import sys
sys.path.insert(0, '/app')
from app.schemas.caption import CaptionRequest, FeaturedService
from app.schemas.decision import BusinessContext
from app.schemas.caption import PostType
from app.services.caption_service import build_caption
import json

# Build a test request
biz = BusinessContext(id="b1", name="ร้านกาแฟโบราณ", industry="อาหาร", tone="friendly", keywords=["กาแฟ","หอม"], target_audience="วัยทำงาน")
svc = FeaturedService(id="s1", name="ลาเต้", description="กาแฟนมเย็น", price=6500, currency="THB")

req = CaptionRequest(
    callbackUrl="http://172.27.65.121:3000/internal/ai/caption/callback",
    jobId="test-job-1",
    postId="test-post-1",
    business=biz,
    postType=PostType.PROMOTION,
    featuredServices=[svc],
    captionHint="โปรโมชั่นลาเต้เย็น ลด 50% วันศุกร์นี้",
    targetAudience="วัยทำงาน",
)

print("Calling build_caption...")
result = build_caption(req)
print("RESULT:", repr(result.caption[:300]))
print("LENGTH:", len(result.caption))
