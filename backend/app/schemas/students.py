from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field, field_validator
from app.utils.phone import sanitize_phone_number, validate_phone_number

class StudentBase(BaseModel):
    class_id: int
    student_name: str = Field(..., min_length=1, max_length=150, examples=["Rahul Sharma"])
    parent_name: str | None = Field(default=None, max_length=150, examples=["Rahul's Parent"])
    whatsapp_number: str = Field(..., examples=["919876543210"])
    whatsapp_opt_in: bool = Field(default=True)

    @field_validator("whatsapp_number")
    @classmethod
    def clean_and_validate_phone(cls, v: str) -> str:
        sanitized = sanitize_phone_number(v)
        if not validate_phone_number(sanitized):
            raise ValueError(f"Invalid phone number: {v}. Must contain 10-15 digits including country code.")
        return sanitized

class StudentCreate(StudentBase):
    pass

class StudentUpdate(BaseModel):
    class_id: int | None = None
    student_name: str | None = Field(default=None, min_length=1, max_length=150)
    parent_name: str | None = Field(default=None, max_length=150)
    whatsapp_number: str | None = None
    whatsapp_opt_in: bool | None = None

    @field_validator("whatsapp_number")
    @classmethod
    def clean_and_validate_phone(cls, v: str | None) -> str | None:
        if v is None:
            return None
        sanitized = sanitize_phone_number(v)
        if not validate_phone_number(sanitized):
            raise ValueError(f"Invalid phone number: {v}. Must contain 10-15 digits including country code.")
        return sanitized

class StudentResponse(StudentBase):
    id: int
    created_at: datetime
    updated_at: datetime
    class_name: str | None = None

    model_config = ConfigDict(from_attributes=True)
