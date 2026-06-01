from pydantic_settings import BaseSettings
from pydantic import field_validator


class Settings(BaseSettings):
    APP_ENV: str = "development"
    SECRET_KEY: str
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    DATABASE_URL: str

    ANTHROPIC_API_KEY: str
    ANTHROPIC_MODEL: str = "claude-sonnet-4-6"

    STRIPE_SECRET_KEY: str
    STRIPE_WEBHOOK_SECRET: str

    FREE_CREDITS_MONTHLY: int = 15
    CHAT_CREDIT_COST: int = 10
    APPOINTMENT_CREDIT_COST: int = 50

    FRONTEND_URL: str = "http://localhost:3000"

    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()
