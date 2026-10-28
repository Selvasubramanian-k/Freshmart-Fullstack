from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    MONGO_URI: str = "mongodb://localhost:27017"
    DB_NAME: str = "freshmart"
    JWT_SECRET: str = "change-this-to-a-long-random-string"
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRE_MINUTES: int = 1440
    CORS_ORIGINS: str = "http://localhost:5173,http://127.0.0.1:5173"
    PLATFORM_COMMISSION_PERCENT: float = 10.0

    # Delivery fee rules
    FREE_DELIVERY_ABOVE: float = 499.0
    DELIVERY_FEE: float = 30.0
    LOW_STOCK_THRESHOLD: int = 10

    # Mobile OTP login
    # OTP_DEV_MODE=true -> the code comes back in the API reply and shows on screen (demo / local only!).
    # Keep it false on a real store: then anyone who knows a number could log in as that person.
    OTP_DEV_MODE: bool = False
    OTP_TTL_SECONDS: int = 300          # code works for 5 minutes
    OTP_RESEND_SECONDS: int = 30        # wait before asking for a new code
    OTP_MAX_PER_HOUR: int = 5           # codes per number per hour
    OTP_MAX_ATTEMPTS: int = 5           # wrong tries before the code is thrown away
    # SMS: leave SMS_PROVIDER empty -> codes are only printed in the server log.
    # "msg91" -> needs SMS_API_KEY + SMS_TEMPLATE_ID (DLT approved template with ##OTP##).
    SMS_PROVIDER: str = ""
    SMS_API_KEY: str = ""
    SMS_TEMPLATE_ID: str = ""

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.CORS_ORIGINS.split(",") if o.strip()]


settings = Settings()
