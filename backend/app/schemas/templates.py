from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field

class TemplateBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=100, examples=["hello_world"])
    category: str = Field(default="UTILITY", max_length=50)
    language: str = Field(default="en_US", max_length=20)
    description: str | None = Field(default=None, max_length=255)
    body_preview: str | None = Field(default=None)
    status: str = Field(default="PENDING", examples=["ACTIVE", "PENDING", "REJECTED"])

class TemplateCreate(TemplateBase):
    pass

class TemplateUpdate(BaseModel):
    category: str | None = None
    language: str | None = None
    description: str | None = None
    body_preview: str | None = None
    status: str | None = None

class TemplateResponse(TemplateBase):
    id: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
