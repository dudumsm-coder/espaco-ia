from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    APP_ENV: str = "development"

    DATABASE_URL: str

    CLERK_SECRET_KEY: str
    CLERK_JWKS_URL: str

    ANTHROPIC_API_KEY: str
    ANTHROPIC_MODEL: str = "claude-sonnet-4-6"

    STRIPE_SECRET_KEY: str = ""
    STRIPE_WEBHOOK_SECRET: str = ""

    FREE_CREDITS_MONTHLY: int = 15
    CHAT_CREDIT_COST: int = 10
    APPOINTMENT_CREDIT_COST: int = 50

    FRONTEND_URL: str = "http://localhost:3000"

    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()
