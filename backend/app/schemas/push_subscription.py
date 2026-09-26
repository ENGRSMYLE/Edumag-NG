from pydantic import BaseModel, Field, field_validator


class PushSubscriptionKeys(BaseModel):
    p256dh: str = Field(min_length=20, max_length=255)
    auth: str = Field(min_length=8, max_length=255)

    model_config = {"extra": "forbid"}


class PushSubscriptionRequest(BaseModel):
    endpoint: str = Field(min_length=12, max_length=2048)
    keys: PushSubscriptionKeys
    device_name: str | None = Field(default=None, max_length=255)

    model_config = {"extra": "forbid"}

    @field_validator("endpoint")
    @classmethod
    def validate_endpoint(cls, value: str) -> str:
        if not value.startswith("https://"):
            raise ValueError("Push subscription endpoint must use HTTPS")
        return value


class PushUnsubscribeRequest(BaseModel):
    endpoint: str = Field(min_length=12, max_length=2048)

    model_config = {"extra": "forbid"}

    @field_validator("endpoint")
    @classmethod
    def validate_endpoint(cls, value: str) -> str:
        if not value.startswith("https://"):
            raise ValueError("Push subscription endpoint must use HTTPS")
        return value


class PushSubscriptionStatus(BaseModel):
    supported: bool = True
    configured: bool
    subscribed: bool
    device_count: int


class PushTestResponse(BaseModel):
    message: str
    notification_id: str
