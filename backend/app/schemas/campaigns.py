from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field
from app.schemas.message_logs import MessageLogResponse

class CampaignCreateRequest(BaseModel):
    class_id: int = Field(..., description="Target Class ID")
    template_id: int = Field(..., description="Target Template ID")
    student_ids: list[int] | None = Field(default=None, description="Optional specific student IDs within class")
    dynamic_parameters: list[str] | None = Field(default=None, description="Optional template parameters")
    per_student_parameters: dict[int, list[str]] | None = Field(default=None, description="Optional per-student customized parameters map {student_id: [param1, param2, ...]}")

class CampaignResponse(BaseModel):
    id: int
    class_id: int | None = None
    class_name: str | None = None
    template_id: int | None = None
    template_name: str | None = None
    total_recipients: int
    successful_count: int
    failed_count: int
    skipped_count: int
    status: str
    created_at: datetime
    started_at: datetime | None = None
    completed_at: datetime | None = None

    model_config = ConfigDict(from_attributes=True)

class CampaignDetailResponse(CampaignResponse):
    message_logs: list[MessageLogResponse] = []
