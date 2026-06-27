import json
from datetime import datetime, timedelta
from groq import Groq
from app.core.config import settings
from app.schemas.decision import (
    DecisionRequest,
    DecisionResponse,
    PostType,
)

client = Groq(api_key=settings.GROQ_API_KEY)
MODEL = "llama-3.3-70b-versatile"


def _build_prompt(req: DecisionRequest) -> str:
    now = req.current_time or datetime.now()
    services_text = ""
    if req.services:
        services_text = "\n".join(
            f"  - ID: {s.id}, Name: {s.name}, Description: {s.description or 'N/A'}, Price: {s.price_minor or 'N/A'} satang"
            for s in req.services
        )
    else:
        services_text = "  No services available"

    last_post = req.recent_posts.last_post_date
    days_since_last = (now - last_post).days if last_post else None
    days_since_text = f"{days_since_last} days ago" if days_since_last is not None else "No posts yet"

    return f"""You are an AI marketing strategist for Thai SME businesses.
Your job is to decide whether a business should post on Facebook today.

## Business Info
- Name: {req.business.name}
- Industry: {req.business.industry or 'N/A'}
- Description: {req.business.description or 'N/A'}
- Tone: {req.business.tone or 'friendly'}
- Target Audience: {req.business.target_audience or 'general'}
- Keywords: {', '.join(req.business.keywords) if req.business.keywords else 'N/A'}

## Services/Products
{services_text}

## Posting Rules
- Target: {req.posting_config.posts_per_week_target} posts per week
- Minimum gap between posts: {req.posting_config.min_gap_days} days
- Posts this week so far: {req.recent_posts.posts_this_week}
- Last post: {days_since_text}
- Current date/time: {now.strftime('%Y-%m-%d %H:%M')} (Bangkok time)

## Your Task
Decide if the business should post today. Consider:
1. Have they reached their weekly target already?
2. Has enough time passed since the last post (min_gap_days)?
3. What type of post would be most effective today?
4. Which service/product should be featured (if any)?
5. What time would be best for their target audience?

Respond in this exact JSON format (no other text):
{{
  "should_post": true or false,
  "reason": "Brief explanation in English",
  "suggested_scheduled_at": "YYYY-MM-DDTHH:MM:SS" or null,
  "post_type": "promotion" or "product_showcase" or "brand_awareness" or "event" or null,
  "featured_service_ids": ["id1"] or [],
  "caption_hint": "Brief hint for caption generation in Thai context" or null
}}"""


def decide(req: DecisionRequest) -> DecisionResponse:
    now = req.current_time or datetime.now()

    if req.recent_posts.posts_this_week >= req.posting_config.posts_per_week_target:
        return DecisionResponse(
            should_post=False,
            reason=f"Weekly target of {req.posting_config.posts_per_week_target} posts already reached ({req.recent_posts.posts_this_week} posts this week)",
        )

    if req.recent_posts.last_post_date:
        days_since = (now - req.recent_posts.last_post_date).days
        if days_since < req.posting_config.min_gap_days:
            return DecisionResponse(
                should_post=False,
                reason=f"Last post was {days_since} day(s) ago, minimum gap is {req.posting_config.min_gap_days} day(s)",
            )

    prompt = _build_prompt(req)

    response = client.chat.completions.create(
        model=MODEL,
        messages=[
            {"role": "system", "content": "You are a marketing AI. Respond only with valid JSON."},
            {"role": "user", "content": prompt},
        ],
        temperature=0.7,
        max_tokens=500,
    )

    raw = response.choices[0].message.content.strip()
    if raw.startswith("```"):
        raw = raw.split("\n", 1)[1].rsplit("```", 1)[0].strip()

    data = json.loads(raw)

    scheduled_at = None
    if data.get("suggested_scheduled_at"):
        scheduled_at = datetime.fromisoformat(data["suggested_scheduled_at"])

    return DecisionResponse(
        should_post=data["should_post"],
        reason=data["reason"],
        suggested_scheduled_at=scheduled_at,
        post_type=data.get("post_type"),
        featured_service_ids=data.get("featured_service_ids", []),
        caption_hint=data.get("caption_hint"),
    )
