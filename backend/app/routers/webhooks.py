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

            # Handle Coexistence Webhook Fields
            field = change.get("field")
            
            # 1. Echoes of messages sent from WhatsApp Business App on phone
            if field == "smb_message_echoes":
                echo_messages = value.get("messages", [])
                for echo in echo_messages:
                    echo_id = echo.get("id")
                    recipient = echo.get("to") or echo.get("recipient_id")
                    logger.info(f"[Webhook Coexistence] Phone App Echo message sent to '{recipient}' (ID: {echo_id})")

            # 2. WhatsApp Business App History Sync events
            elif field == "history":
                history_data = value.get("history", {}) or value
                phase = history_data.get("phase") or "sync"
                logger.info(f"[Webhook Coexistence] History sync event received: phase={phase}")

            # 3. WhatsApp Business App State Sync (Labels, Profile, State)
            elif field == "smb_app_state_sync":
                state_data = value.get("sync_state") or value
                logger.info(f"[Webhook Coexistence] App state sync event received: {state_data}")

            # 4. Handle template review status updates
            elif field == "message_template_status_update":
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

