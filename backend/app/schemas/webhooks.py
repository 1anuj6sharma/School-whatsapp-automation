from typing import Any, List, Optional
from pydantic import BaseModel

class WebhookStatus(BaseModel):
    id: str  # WhatsApp Message ID (wamid...)
    status: str  # sent, delivered, read, failed
    timestamp: str
    recipient_id: str
    errors: Optional[List[Any]] = None

class WebhookChangeValue(BaseModel):
    messaging_product: Optional[str] = None
    metadata: Optional[dict[str, Any]] = None
    statuses: Optional[List[WebhookStatus]] = None
    messages: Optional[List[dict[str, Any]]] = None

class WebhookChange(BaseModel):
    value: WebhookChangeValue
    field: str

class WebhookEntry(BaseModel):
    id: str
    changes: List[WebhookChange]

class WhatsAppWebhookPayload(BaseModel):
    object: Optional[str] = None
    entry: Optional[List[WebhookEntry]] = None
