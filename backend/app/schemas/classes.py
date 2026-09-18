from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field

class ClassBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=100, examples=["Class 10-A"])
    section: str | None = Field(default=None, max_length=50, examples=["A"])

class ClassCreate(ClassBase):
    pass

class ClassUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=100)
    section: str | None = Field(default=None, max_length=50)

class ClassResponse(ClassBase):
    id: int
    created_at: datetime
    updated_at: datetime
    student_count: int = 0

    model_config = ConfigDict(from_attributes=True)
