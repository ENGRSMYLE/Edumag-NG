from pydantic_settings import BaseSettings, SettingsConfigDict
import base64

from pydantic import computed_field, field_validator, model_validator


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # Database
    DATABASE_URL: str

    @field_validator("DATABASE_URL", mode="before")
    @classmethod
    def fix_database_url(cls, v: str) -> str:
        # Render provides postgres:// — asyncpg requires postgresql+asyncpg://
        if v.startswith("postgres://"):
            v = v.replace("postgres://", "postgresql+asyncpg://", 1)
        elif v.startswith("postgresql://") and "+asyncpg" not in v:
            v = v.replace("postgresql://", "postgresql+asyncpg://", 1)
        return v

    # Redis
    REDIS_URL: str = "redis://localhost:6379/0"

    # Security
    SECRET_KEY: str
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    INVITE_TOKEN_EXPIRE_HOURS: int = 48
    PASSWORD_RESET_TOKEN_EXPIRE_MINUTES: int = 30

    # Optional in development; both values are required to enable Web Push.
    WEB_PUSH_VAPID_PUBLIC_KEY: str | None = None
    WEB_PUSH_VAPID_PRIVATE_KEY: str | None = None
    WEB_PUSH_SUBJECT: str = "mailto:support@example.com"

    # Email
    RESEND_API_KEY: str
    FROM_EMAIL: str = "noreply@edumag.ng"

    # Paystack
    PAYSTACK_SECRET_KEY: str
    PAYSTACK_PUBLIC_KEY: str

    # Cloudinary
    CLOUDINARY_CLOUD_NAME: str
    CLOUDINARY_API_KEY: str
    CLOUDINARY_API_SECRET: str

    # App
    FRONTEND_URL: str = "http://localhost:3000"
    ENVIRONMENT: str = "development"

    @computed_field
    @property
    def is_production(self) -> bool:
        return self.ENVIRONMENT.lower() == "production"

    @model_validator(mode="after")
    def validate_web_push_configuration(self):
        public_key = self.WEB_PUSH_VAPID_PUBLIC_KEY
        private_key = self.WEB_PUSH_VAPID_PRIVATE_KEY
        if bool(public_key) != bool(private_key):
            raise ValueError("WEB_PUSH_VAPID_PUBLIC_KEY and WEB_PUSH_VAPID_PRIVATE_KEY must be configured together")
        if not public_key:
            return self

        def decode(value: str, field_name: str) -> bytes:
            try:
                return base64.urlsafe_b64decode(value + "=" * (-len(value) % 4))
            except Exception as exc:
                raise ValueError(f"{field_name} must be URL-safe base64") from exc

        public_bytes = decode(public_key, "WEB_PUSH_VAPID_PUBLIC_KEY")
        private_bytes = decode(private_key, "WEB_PUSH_VAPID_PRIVATE_KEY")
        if len(public_bytes) != 65 or public_bytes[0] != 4:
            raise ValueError("WEB_PUSH_VAPID_PUBLIC_KEY must be an uncompressed P-256 public key")
        if len(private_bytes) != 32:
            raise ValueError("WEB_PUSH_VAPID_PRIVATE_KEY must be a 32-byte P-256 private key")
        if not (self.WEB_PUSH_SUBJECT.startswith("mailto:") or self.WEB_PUSH_SUBJECT.startswith("https://")):
            raise ValueError("WEB_PUSH_SUBJECT must use mailto: or https://")
        return self

    @computed_field
    @property
    def web_push_enabled(self) -> bool:
        return bool(self.WEB_PUSH_VAPID_PUBLIC_KEY and self.WEB_PUSH_VAPID_PRIVATE_KEY)


settings = Settings()
