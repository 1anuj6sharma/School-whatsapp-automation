from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, ConfigDict, Field

class TemplateBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=100, examples=["hello_world"])
    category: str = Field(default="UTILITY", max_length=50)
    language: str = Field(default="en_US", max_length=20)
    description: Optional[str] = Field(default=None, max_length=255)
    body_preview: Optional[str] = Field(default=None)
    header_type: Optional[str] = Field(default="NONE", max_length=30, description="NONE, TEXT, IMAGE, DOCUMENT, VIDEO")
    header_text: Optional[str] = Field(default=None, max_length=255)
    sample_image_url: Optional[str] = Field(default=None, max_length=500)
    status: str = Field(default="PENDING", examples=["ACTIVE", "PENDING", "REJECTED"])

class TemplateCreate(TemplateBase):
    pass

class TemplateCreateMetaRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=100, description="Template name (lowercase letters, numbers, underscores)")
    category: str = Field(default="UTILITY", description="UTILITY or MARKETING")
    language: str = Field(default="en_US", description="Language code e.g. en_US, en, hi")
    body_text: str = Field(..., min_length=1, description="Body message text with optional {{1}}, {{2}} variables")
    header_type: Optional[str] = Field(default="NONE", description="NONE, TEXT, or IMAGE")
    header_text: Optional[str] = Field(default=None, description="Optional text for header if header_type is TEXT")
    sample_image_url: Optional[str] = Field(default=None, description="Sample image URL/handle for Meta review if header_type is IMAGE")
    sample_values: Optional[List[str]] = Field(default=None, description="Sample values for {{1}}, {{2}} placeholders")

class TemplateUpdate(BaseModel):
    category: Optional[str] = None
    language: Optional[str] = None
    description: Optional[str] = None
    body_preview: Optional[str] = None
    status: Optional[str] = None

class TemplateResponse(TemplateBase):
    id: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
