from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    APP_NAME: str = "ERP-AI Services"
    DEBUG: bool = True
    HOST: str = "0.0.0.0"
    PORT: int = 8000

    # Shared secret expected in the X-Internal-Token header on incoming
    # requests, and sent back on the callback to the backend.
    INTERNAL_TOKEN: str = ""

    GROQ_API_KEY: str = ""

    model_config = {"env_file": ".env", "extra": "ignore"}


settings = Settings()
