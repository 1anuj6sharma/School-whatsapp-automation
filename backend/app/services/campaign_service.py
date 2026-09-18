import asyncio
from datetime import datetime
from typing import List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.config import settings
from app.database import AsyncSessionLocal
from app.models.class_model import Class
from app.models.student import Student
from app.models.template import MessageTemplate
from app.models.campaign import MessageCampaign
from app.models.message_log import MessageLog
from app.services.whatsapp_service import whatsapp_service
from app.utils.logger import logger
from app.utils.phone import mask_phone_number

class CampaignService:
    @staticmethod
    async def create_and_start_campaign(
        db: AsyncSession,
        class_id: int,
        template_id: int,
        student_ids: Optional[List[int]] = None,
        dynamic_parameters: Optional[List[str]] = None
    ) -> MessageCampaign:
        # 1. Validate class
        school_class = await db.get(Class, class_id)
        if not school_class:
            raise ValueError(f"Class with ID {class_id} not found.")

        # 2. Validate template
        template = await db.get(MessageTemplate, template_id)
        if not template:
            raise ValueError(f"Template with ID {template_id} not found.")

        if template.status.upper() != "ACTIVE":
            raise ValueError(
                f"Template '{template.name}' has status '{template.status}'. "
                "Only ACTIVE (approved by Meta) templates can be used to send messages."
            )

        # 3. Query target students in class
        stmt = select(Student).where(Student.class_id == class_id)
        if student_ids and len(student_ids) > 0:
            stmt = stmt.where(Student.id.in_(student_ids))
        
        result = await db.execute(stmt)
        all_students = list(result.scalars().all())

        if not all_students:
            raise ValueError(f"No students found in {school_class.name} to send messages to.")

        # 4. Filter opted-in students vs skipped
        opted_in_students = [s for s in all_students if s.whatsapp_opt_in]
        skipped_students = [s for s in all_students if not s.whatsapp_opt_in]

        total_recipients = len(opted_in_students)
        skipped_count = len(skipped_students)

        # 5. Create MessageCampaign record
        campaign = MessageCampaign(
            class_id=class_id,
            template_id=template_id,
            total_recipients=total_recipients,
            successful_count=0,
            failed_count=0,
            skipped_count=skipped_count,
            status="PROCESSING" if total_recipients > 0 else "COMPLETED",
            started_at=datetime.utcnow() if total_recipients > 0 else None,
            completed_at=datetime.utcnow() if total_recipients == 0 else None
        )
        db.add(campaign)
        await db.flush()  # populate campaign.id

        # 6. Create MessageLog records for opted-in students
        created_logs: List[MessageLog] = []
        for s in opted_in_students:
            log_record = MessageLog(
                campaign_id=campaign.id,
                student_id=s.id,
                recipient_number=s.whatsapp_number,
                template_name=template.name,
                status="QUEUED"
            )
            db.add(log_record)
            created_logs.append(log_record)

        # Record skipped logs for audit visibility
        for s in skipped_students:
            skipped_log = MessageLog(
                campaign_id=campaign.id,
                student_id=s.id,
                recipient_number=s.whatsapp_number,
                template_name=template.name,
                status="SKIPPED",
                error_message="Student has opted out of WhatsApp notifications (whatsapp_opt_in=False)."
            )
            db.add(skipped_log)

        await db.commit()
        await db.refresh(campaign)

        # If there are active recipients, trigger background processing
        if total_recipients > 0:
            asyncio.create_task(
                CampaignService._execute_campaign_batch(
                    campaign_id=campaign.id,
                    template_name=template.name,
                    language_code=template.language,
                    dynamic_parameters=dynamic_parameters
                )
            )

        return campaign

    @staticmethod
    async def _execute_campaign_batch(
        campaign_id: int,
        template_name: str,
        language_code: str,
        dynamic_parameters: Optional[List[str]] = None
    ):
        """
        Executes WhatsApp dispatches concurrently with asyncio.Semaphore.
        Runs in background task with dedicated DB session.
        """
        logger.info(f"[CampaignService] Starting execution of Campaign #{campaign_id}")
        concurrency_limit = max(1, settings.WHATSAPP_MAX_CONCURRENCY)
        semaphore = asyncio.Semaphore(concurrency_limit)

        async with AsyncSessionLocal() as session:
            # Fetch queued message logs for this campaign
            stmt = select(MessageLog).where(
                MessageLog.campaign_id == campaign_id,
                MessageLog.status == "QUEUED"
            )
            result = await session.execute(stmt)
            logs = list(result.scalars().all())

            if not logs:
                return

            async def send_single(log: MessageLog):
                async with semaphore:
                    masked = mask_phone_number(log.recipient_number)
                    try:
                        resp = await whatsapp_service.send_template_message(
                            recipient_number=log.recipient_number,
                            template_name=template_name,
                            language_code=language_code,
                            parameters=dynamic_parameters
                        )

                        if resp.get("success"):
                            log.status = "SENT"
                            log.whatsapp_message_id = resp.get("message_id")
                            log.sent_at = datetime.utcnow()
                            log.error_message = None
                            logger.info(f"[Campaign #{campaign_id}] Log #{log.id} -> SENT to {masked}")
                        else:
                            log.status = "FAILED"
                            log.failed_at = datetime.utcnow()
                            log.error_message = resp.get("error", "Unknown delivery failure")
                            logger.error(f"[Campaign #{campaign_id}] Log #{log.id} -> FAILED for {masked}: {log.error_message}")
                    except Exception as exc:
                        log.status = "FAILED"
                        log.failed_at = datetime.utcnow()
                        log.error_message = str(exc)
                        logger.error(f"[Campaign #{campaign_id}] Log #{log.id} exception: {str(exc)}")

            # Run all message sends concurrently within semaphore limit
            await asyncio.gather(*(send_single(log) for log in logs))

            # Compute totals and update campaign
            success_count = sum(1 for log in logs if log.status == "SENT")
            fail_count = sum(1 for log in logs if log.status == "FAILED")

            campaign = await session.get(MessageCampaign, campaign_id)
            if campaign:
                campaign.successful_count = success_count
                campaign.failed_count = fail_count
                campaign.status = "COMPLETED"
                campaign.completed_at = datetime.utcnow()

            await session.commit()
            logger.info(
                f"[CampaignService] Campaign #{campaign_id} finished! "
                f"Total: {len(logs)}, Success: {success_count}, Failed: {fail_count}"
            )

campaign_service = CampaignService()
