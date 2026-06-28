from fastapi import FastAPI
from app.api.routes import decision, caption

app = FastAPI(
    title="ERP-AI Services",
    description="AI Decision and AI Caption microservice (Media is now handled by n8n)",
    version="0.3.0",
)

app.include_router(decision.router, prefix="/api/ai/decision", tags=["AI Decision"])
app.include_router(caption.router, prefix="/api/ai/caption", tags=["AI Caption"])


@app.get("/health")
async def health_check():
    return {"status": "ok"}
