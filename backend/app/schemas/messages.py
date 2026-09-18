from typing import Any
from pydantic import BaseModel, Field, field_validator
from app.utils.phone import sanitize_phone_number, validate_phone_number

class TestMessageRequest(BaseModel):
    recipient_number: str = Field(..., examples=["919876543210"], description="Recipient phone number without '+'")
    template_name: str = Field(default="hello_world", description="Meta template name")
    language_code: str = Field(default="en_US", description="Template language code")

    @field_validator("recipient_number")
    @classmethod
    def clean_phone(cls, v: str) -> str:
        sanitized = sanitize_phone_number(v)
        if not validate_phone_number(sanitized):
            raise ValueError(f"Invalid phone number: {v}. Must contain 10-15 digits including country code.")
        return sanitized

class TestMessageResponse(BaseModel):
    success: bool
    message_id: str | None = None
    recipient: str | None = None
    error: str | None = None
    meta_error: dict[str, Any] | None = None
