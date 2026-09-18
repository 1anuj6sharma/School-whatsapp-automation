from datetime import datetime
from pydantic import BaseModel, ConfigDict
from app.utils.phone import mask_phone_number

class MessageLogResponse(BaseModel):
    id: int
    campaign_id: int | None = None
    student_id: int | None = None
    student_name: str | None = None
    recipient_number: str
    masked_number: str | None = None
    template_name: str
    status: str
    whatsapp_message_id: str | None = None
    error_message: str | None = None
    sent_at: datetime | None = None
    delivered_at: datetime | None = None
    read_at: datetime | None = None
    failed_at: datetime | None = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

    @classmethod
    def from_model(cls, log) -> "MessageLogResponse":
        return cls(
            id=log.id,
            campaign_id=log.campaign_id,
            student_id=log.student_id,
            student_name=log.student.student_name if log.student else None,
            recipient_number=log.recipient_number,
            masked_number=mask_phone_number(log.recipient_number),
            template_name=log.template_name,
            status=log.status,
            whatsapp_message_id=log.whatsapp_message_id,
            error_message=log.error_message,
            sent_at=log.sent_at,
            delivered_at=log.delivered_at,
            read_at=log.read_at,
            failed_at=log.failed_at,
            created_at=log.created_at,
        )
