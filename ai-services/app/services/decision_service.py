import json
from datetime import datetime, timezone

from groq import Groq

from app.core.config import settings
from app.core.security import post_callback
from app.schemas.decision import (
    DecisionRequest,
    Decision,
    DecisionCallback,
    DecisionErrorCallback,
    ErrorInfo,
)

client = Groq(api_key=settings.GROQ_API_KEY)
MODEL = "llama-3.3-70b-versatile"


def _build_prompt(req: DecisionRequest, now: datetime) -> str:
    if req.services:
        services_text = "\n".join(
            f"  - id: {s.id} | {s.name} | {s.description or 'N/A'}"
            + (f" | {s.price_minor / 100:.0f} {s.currency or 'THB'}" if s.price_minor else "")
            + (" | INACTIVE" if not s.is_active else "")
            for s in req.services
        )
    else:
        services_text = "  No services provided"

    recently_featured = (
        ", ".join(req.recent_featured_service_ids)
        if req.recent_featured_service_ids else "none"
    )

    recent_text = "\n".join(
        f"  - {p.posted_at.strftime('%Y-%m-%d')} ({p.post_type})" for p in req.recent_posts
    ) or "  No recent posts"

    last_post = req.last_post_at
    days_since = (now - last_post).days if last_post else None
    days_since_text = f"{days_since} days ago" if days_since is not None else "No posts yet"

    return f"""You are an AI marketing strategist for Thai SME businesses.
Decide whether the business should post on Facebook today.

## Business Info
- Name: {req.business.name}
- Industry: {req.business.industry or 'N/A'}
- Description: {req.business.description or 'N/A'}
- Tone: {req.business.tone or 'friendly'}
- Target Audience: {req.business.target_audience or 'general'}
- Keywords: {', '.join(req.business.keywords) if req.business.keywords else 'N/A'}

## Services/Products (choose featured ids ONLY from this list)
{services_text}

## Posting Rules
- Target: {req.business.posts_per_week_target} posts per week
- Minimum gap between posts: {req.business.min_gap_days} days
- Posts this week so far: {req.posts_this_week}
- Last post: {days_since_text}
- Recent posts:
{recent_text}
- Current date/time: {now.strftime('%Y-%m-%d %H:%M')} UTC

## Your Task
Decide if the business should post today. Pick 1-3 featured services that are
active, match the post type, and were NOT recently featured.
Recently featured service ids (avoid these): {recently_featured}

Respond in this exact JSON format (no other text):
{{
  "should_post": true or false,
  "reasoning": "Brief explanation",
  "suggested_scheduled_at": "YYYY-MM-DDTHH:MM:SSZ" or null,
  "post_type": "promotion" or "product_showcase" or "brand_awareness" or "event" or null,
  "featured_service_ids": ["id1"] or [],
  "caption_hint": "Brief hint for caption generation" or null
}}"""


def build_decision(req: DecisionRequest) -> Decision:
    """Core logic: rule guardrails first, then the AI. Returns a Decision."""
    now = req.now_iso or datetime.now(timezone.utc)

    if req.posts_this_week >= req.business.posts_per_week_target:
        return Decision(
            should_post=False,
            reasoning=f"Weekly target of {req.business.posts_per_week_target} posts already reached ({req.posts_this_week} this week)",
        )

    if req.last_post_at:
        days_since = (now - req.last_post_at).days
        if days_since < req.business.min_gap_days:
            return Decision(
                should_post=False,
                reasoning=f"Last post was {days_since} day(s) ago, minimum gap is {req.business.min_gap_days} day(s)",
            )

    prompt = _build_prompt(req, now)
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
        scheduled_at = datetime.fromisoformat(data["suggested_scheduled_at"].replace("Z", "+00:00"))

    return Decision(
        should_post=data["should_post"],
        reasoning=data["reasoning"],
        suggested_scheduled_at=scheduled_at,
        post_type=data.get("post_type"),
        featured_service_ids=data.get("featured_service_ids", []),
        caption_hint=data.get("caption_hint"),
    )


def process_decision(req: DecisionRequest) -> None:
    """Background task: run the decision and POST the result to callbackUrl."""
    try:
        decision = build_decision(req)
        payload = DecisionCallback(plan_id=req.plan_id, decision=decision)
    except Exception as e:
        payload = DecisionErrorCallback(
            plan_id=req.plan_id,
            error=ErrorInfo(code="internal_error", message=str(e)),
        )
    post_callback(req.callback_url, payload.model_dump(by_alias=True, mode="json"))
