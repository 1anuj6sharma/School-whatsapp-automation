import json
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.config import settings
from app.database import get_db
from app.models.message_log import MessageLog
from app.models.template import MessageTemplate
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
        try:
            logger.info(f"[Webhook] Raw payload received: {json.dumps(data, default=str)}")
        except Exception:
            logger.info(f"[Webhook] Raw payload received (fallback): {data}")
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
                recipient_info = log_entry.recipient_number if log_entry else "Unknown"

                if new_status == "FAILED":
                    errors = status_item.get("errors", [])
                    err_str = "Unknown Meta error"
                    if errors:
                        first_err = errors[0]
                        err_code = first_err.get("code", "")
                        err_title = first_err.get("title", "")
                        err_msg = first_err.get("message", "")
                        err_details = first_err.get("error_data", {}).get("details", "")
                        err_str = f"Meta error: {err_title} - {err_msg}"
                        if err_code:
                            err_str = f"Meta error [{err_code}]: {err_title} - {err_msg}"
                        if err_details:
                            err_str += f" ({err_details})"
                    logger.error(
                        f"[Webhook] DELIVERY FAILED for message ID '{message_id}' (Recipient: {recipient_info}): {err_str}"
                    )
                    if log_entry:
                        log_entry.status = "FAILED"
                        log_entry.failed_at = event_time
                        log_entry.error_message = err_str
                        await db.commit()
                elif log_entry:
                    logger.info(
                        f"[Webhook] Status update for message ID '{message_id}' (Recipient: {recipient_info}): {new_status}"
                    )
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
                    await db.commit()
                else:
                    logger.info(
                        f"[Webhook] Status update for unknown message ID '{message_id}': {new_status}"
                    )

            # Handle template review status updates
            field = change.get("field")
            if field == "message_template_status_update":
                template_id = value.get("message_template_id")
                template_name = value.get("message_template_name")
                event = value.get("event", "").upper()  # APPROVED, REJECTED, PAUSED, PENDING
                reason = value.get("reason")
                logger.info(f"[Webhook] Template update: name={template_name}, id={template_id}, event={event}, reason={reason}")

                status_map = {
                    "APPROVED": "ACTIVE",
                    "REJECTED": "REJECTED",
                    "PENDING": "PENDING",
                    "PAUSED": "PAUSED",
                    "IN_APPEAL": "PENDING",
                }
                mapped_status = status_map.get(event, event)

                stmt = select(MessageTemplate).where(MessageTemplate.name == template_name)
                res = await db.execute(stmt)
                tpl = res.scalar_one_or_none()
                if tpl:
                    tpl.status = mapped_status
                    await db.commit()
                    logger.info(f"[Webhook] Updated DB template '{template_name}' status to '{mapped_status}'")

    return {"status": "ok"}
