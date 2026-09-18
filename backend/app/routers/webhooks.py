from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.config import settings
from app.database import get_db
from app.models.message_log import MessageLog
from app.utils.logger import logger

router = APIRouter(prefix="/webhooks/whatsapp", tags=["Webhooks"])

@router.get("")
async def verify_webhook(
    request: Request,
    hub_mode: str | None = Query(None, alias="hub.mode"),
    hub_verify_token: str | None = Query(None, alias="hub.verify_token"),
    hub_challenge: str | None = Query(None, alias="hub.challenge"),
):
    """
    Meta Webhook Verification Endpoint.
    Meta makes a GET request to verify the webhook endpoint.
    """
    logger.info(f"[Webhook] Verification request received. Mode: {hub_mode}")

    if hub_mode == "subscribe" and hub_verify_token == settings.WHATSAPP_VERIFY_TOKEN:
        logger.info("[Webhook] Verification token verified successfully.")
        return Response(content=hub_challenge, media_type="text/plain")

    logger.warning("[Webhook] Verification failed. Invalid verify token or mode.")
    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Verification token mismatch")

@router.post("")
async def handle_whatsapp_events(request: Request, db: AsyncSession = Depends(get_db)):
    """
    Meta Webhook Event Handler.
    Receives message delivery status updates (sent, delivered, read, failed).
    """
    try:
        data = await request.json()
    except Exception as ex:
        logger.error(f"[Webhook] Failed to parse incoming JSON payload: {str(ex)}")
        return {"status": "ignored", "reason": "Invalid JSON"}

    entries = data.get("entry", [])
    for entry in entries:
        changes = entry.get("changes", [])
        for change in changes:
            value = change.get("value", {})
            statuses = value.get("statuses", [])

            for status_item in statuses:
                message_id = status_item.get("id")
                new_status = status_item.get("status", "").upper()  # SENT, DELIVERED, READ, FAILED
                timestamp_str = status_item.get("timestamp")
                event_time = (
                    datetime.utcfromtimestamp(int(timestamp_str))
                    if timestamp_str and timestamp_str.isdigit()
                    else datetime.utcnow()
                )

                if not message_id:
                    continue

                logger.info(f"[Webhook] Status update for Message ID '{message_id}': {new_status}")

                # Find corresponding message log
                stmt = select(MessageLog).where(MessageLog.whatsapp_message_id == message_id)
                result = await db.execute(stmt)
                log_entry = result.scalar_one_or_none()

                if log_entry:
                    # Update status and appropriate timestamp
                    if new_status == "SENT":
                        log_entry.status = "SENT"
                        if not log_entry.sent_at:
                            log_entry.sent_at = event_time
                    elif new_status == "DELIVERED":
                        log_entry.status = "DELIVERED"
                        log_entry.delivered_at = event_time
                    elif new_status == "READ":
                        log_entry.status = "READ"
                        log_entry.read_at = event_time
                    elif new_status == "FAILED":
                        log_entry.status = "FAILED"
                        log_entry.failed_at = event_time
                        errors = status_item.get("errors", [])
                        if errors:
                            first_err = errors[0]
                            log_entry.error_message = (
                                f"Meta error: {first_err.get('title', '')} - {first_err.get('message', '')}"
                            )

                    await db.commit()

    return {"status": "ok"}
