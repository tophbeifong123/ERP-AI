from fastapi import FastAPI
from app.api.routes import decision, caption, media

app = FastAPI(
    title="ERP-AI Services",
    description="AI Decision, AI Caption, and AI Media stub microservice",
    version="0.2.0",
)

app.include_router(decision.router, prefix="/api/ai/decision", tags=["AI Decision"])
app.include_router(caption.router, prefix="/api/ai/caption", tags=["AI Caption"])
app.include_router(media.router, prefix="/api/ai/media", tags=["AI Media (stub)"])


@app.get("/health")
async def health_check():
    return {"status": "ok"}
