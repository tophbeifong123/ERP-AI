from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    APP_NAME: str = "ERP-AI Services"
    DEBUG: bool = True
    HOST: str = "0.0.0.0"
    PORT: int = 8000

    BACKEND_BASE_URL: str = "http://localhost:3001"
    INTERNAL_TOKEN: str = ""

    AI_MEDIA_SERVICE_URL: str = "http://localhost:8001"

    GROQ_API_KEY: str = ""

    model_config = {"env_file": ".env", "extra": "ignore"}


settings = Settings()
