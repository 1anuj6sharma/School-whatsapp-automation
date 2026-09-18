from fastapi import APIRouter, status
from app.schemas.messages import TestMessageRequest, TestMessageResponse
from app.services.whatsapp_service import whatsapp_service
from app.utils.logger import logger

router = APIRouter(prefix="/api/messages", tags=["Messages"])

@router.post("/test", response_model=TestMessageResponse, status_code=status.HTTP_200_OK)
async def send_test_message(payload: TestMessageRequest):
    """
    Sends a test WhatsApp template message directly through Meta WhatsApp Cloud API.
    Use this endpoint to verify Meta credentials and phone number routing.
    """
    logger.info(f"[MessagesRouter] Test message request for recipient: {payload.recipient_number} using template: {payload.template_name}")
    result = await whatsapp_service.send_template_message(
        recipient_number=payload.recipient_number,
        template_name=payload.template_name,
        language_code=payload.language_code
    )

    return TestMessageResponse(
        success=result.get("success", False),
        message_id=result.get("message_id"),
        recipient=result.get("recipient"),
        error=result.get("error"),
        meta_error=result.get("meta_error")
    )
