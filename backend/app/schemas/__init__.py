from app.schemas.classes import ClassCreate, ClassUpdate, ClassResponse
from app.schemas.students import StudentCreate, StudentUpdate, StudentResponse
from app.schemas.templates import TemplateCreate, TemplateUpdate, TemplateResponse
from app.schemas.campaigns import CampaignCreateRequest, CampaignResponse, CampaignDetailResponse
from app.schemas.message_logs import MessageLogResponse
from app.schemas.messages import TestMessageRequest, TestMessageResponse
from app.schemas.webhooks import WhatsAppWebhookPayload

__all__ = [
    "ClassCreate",
    "ClassUpdate",
    "ClassResponse",
    "StudentCreate",
    "StudentUpdate",
    "StudentResponse",
    "TemplateCreate",
    "TemplateUpdate",
    "TemplateResponse",
    "CampaignCreateRequest",
    "CampaignResponse",
    "CampaignDetailResponse",
    "MessageLogResponse",
    "TestMessageRequest",
    "TestMessageResponse",
    "WhatsAppWebhookPayload"
]
