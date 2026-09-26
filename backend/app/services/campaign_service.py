import asyncio
from datetime import datetime
from typing import Dict, List, Optional, Any
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
        dynamic_parameters: Optional[List[str]] = None,
        per_student_parameters: Optional[Dict[Any, List[str]]] = None,
        header_image_url: Optional[str] = None
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
            header_image_url=header_image_url,
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

        # Convert keys in per_student_parameters to ints if needed
        clean_per_student = {}
        if per_student_parameters:
            for k, v in per_student_parameters.items():
                try:
                    clean_per_student[int(k)] = v
                except (ValueError, TypeError):
                    clean_per_student[k] = v

        # If there are active recipients, trigger background processing
        if total_recipients > 0:
            asyncio.create_task(
                CampaignService._execute_campaign_batch(
                    campaign_id=campaign.id,
                    template_name=template.name,
                    language_code=template.language,
                    class_name=school_class.name,
                    dynamic_parameters=dynamic_parameters,
                    per_student_parameters=clean_per_student,
                    header_image_url=header_image_url
                )
            )

        return campaign

    @staticmethod
    async def cleanup_stale_campaigns():
        """
        Runs on startup to recover any campaigns that were left in 'PROCESSING'
        due to a container restart, server crash, or network abort.
        """
        try:
            async with AsyncSessionLocal() as session:
                # Find campaigns that are still in PROCESSING state
                stmt = select(MessageCampaign).where(MessageCampaign.status == "PROCESSING")
                result = await session.execute(stmt)
                stale_campaigns = list(result.scalars().all())

                for camp in stale_campaigns:
                    # Update all orphaned QUEUED message logs to FAILED
                    stmt_logs = select(MessageLog).where(
                        MessageLog.campaign_id == camp.id,
                        MessageLog.status == "QUEUED"
                    )
                    res_logs = await session.execute(stmt_logs)
                    queued_logs = list(res_logs.scalars().all())

                    for log in queued_logs:
                        log.status = "FAILED"
                        log.failed_at = datetime.utcnow()
                        log.error_message = "Broadcast interrupted by server restart or network timeout."

                    # Recalculate campaign totals
                    stmt_all = select(MessageLog).where(MessageLog.campaign_id == camp.id)
                    all_logs = list((await session.execute(stmt_all)).scalars().all())

                    success_cnt = sum(1 for l in all_logs if l.status in ("SENT", "DELIVERED", "READ"))
                    failed_cnt = sum(1 for l in all_logs if l.status in ("FAILED", "SKIPPED"))

                    camp.successful_count = success_cnt
                    camp.failed_count = failed_cnt
                    camp.status = "COMPLETED"
                    camp.completed_at = datetime.utcnow()

                await session.commit()
                if stale_campaigns:
                    logger.info(f"[CampaignService] Cleaned up {len(stale_campaigns)} stale/interrupted campaigns from previous session.")
        except Exception as ex:
            logger.warning(f"[CampaignService] Stale campaign cleanup encountered error: {ex}")

    @staticmethod
    async def _execute_campaign_batch(
        campaign_id: int,
        template_name: str,
        language_code: str,
        class_name: str,
        dynamic_parameters: Optional[List[str]] = None,
        per_student_parameters: Optional[Dict[Any, List[str]]] = None,
        header_image_url: Optional[str] = None
    ):
        """
        Executes WhatsApp dispatches concurrently with immediate per-message database commits.
        Ensures real-time UI progress updates and guarantees no hanging in QUEUED state.
        """
        logger.info(f"[CampaignService] Starting execution of Campaign #{campaign_id} (Template: {template_name})")
        concurrency_limit = max(1, settings.WHATSAPP_MAX_CONCURRENCY)
        semaphore = asyncio.Semaphore(concurrency_limit)
        lang = language_code or "en_US"

        try:
            # 1. Fetch all queued log IDs and student info
            log_items = []
            async with AsyncSessionLocal() as session:
                stmt = select(MessageLog).where(
                    MessageLog.campaign_id == campaign_id,
                    MessageLog.status == "QUEUED"
                )
                result = await session.execute(stmt)
                logs = list(result.scalars().all())

                if not logs:
                    logger.info(f"[CampaignService] No QUEUED logs found for Campaign #{campaign_id}.")
                    return

                student_ids = [log.student_id for log in logs if log.student_id]
                stmt_students = select(Student).where(Student.id.in_(student_ids))
                res_students = await session.execute(stmt_students)
                students_map = {s.id: s for s in res_students.scalars().all()}

                for log in logs:
                    st = students_map.get(log.student_id)
                    log_items.append({
                        "log_id": log.id,
                        "recipient_number": log.recipient_number,
                        "student_id": log.student_id,
                        "student_name": st.student_name if st else "Student",
                        "parent_name": (st.parent_name if st else None) or "Parent"
                    })

            today_str = datetime.now().strftime("%d %b %Y")

            async def process_recipient(item: dict):
                async with semaphore:
                    log_id = item["log_id"]
                    recipient = item["recipient_number"]
                    student_id = item["student_id"]
                    st_name = item["student_name"]
                    pr_name = item["parent_name"]
                    masked = mask_phone_number(recipient)

                    # Determine parameters for this recipient
                    final_params: Optional[List[str]] = None
                    if per_student_parameters and (student_id in per_student_parameters):
                        final_params = per_student_parameters[student_id]
                    elif dynamic_parameters and len(dynamic_parameters) > 0:
                        resolved = []
                        for param in dynamic_parameters:
                            p_str = str(param)
                            p_str = p_str.replace("{student_name}", st_name).replace("{{student_name}}", st_name)
                            p_str = p_str.replace("{Student Name}", st_name).replace("{{Student Name}}", st_name)
                            p_str = p_str.replace("{parent_name}", pr_name).replace("{{parent_name}}", pr_name)
                            p_str = p_str.replace("{Parent Name}", pr_name).replace("{{Parent Name}}", pr_name)
                            p_str = p_str.replace("{phone}", recipient).replace("{{phone}}", recipient)
                            p_str = p_str.replace("{class_name}", class_name).replace("{{class_name}}", class_name)
                            p_str = p_str.replace("{Class Name}", class_name).replace("{{Class Name}}", class_name)
                            p_str = p_str.replace("{date}", today_str).replace("{{date}}", today_str)
                            p_str = p_str.replace("{Today's Date}", today_str).replace("{{Today's Date}}", today_str)
                            resolved.append(p_str)
                        final_params = resolved

                    # Dispatch message via WhatsApp Service
                    is_success = False
                    msg_id = None
                    err_text = None
                    try:
                        resp = await whatsapp_service.send_template_message(
                            recipient_number=recipient,
                            template_name=template_name,
                            language_code=lang,
                            parameters=final_params,
                            header_image_url=header_image_url
                        )
                        if resp.get("success"):
                            is_success = True
                            msg_id = resp.get("message_id")
                            logger.info(f"[Campaign #{campaign_id}] Log #{log_id} -> SENT to {masked} (Msg ID: {msg_id})")
                        else:
                            is_success = False
                            err_text = resp.get("error", "Delivery failed")
                            logger.error(f"[Campaign #{campaign_id}] Log #{log_id} -> FAILED for {masked}: {err_text}")
                    except Exception as ex:
                        is_success = False
                        err_text = str(ex)
                        logger.error(f"[Campaign #{campaign_id}] Log #{log_id} exception: {err_text}")

                    # Immediately commit individual log status into database
                    try:
                        async with AsyncSessionLocal() as update_session:
                            db_log = await update_session.get(MessageLog, log_id)
                            if db_log:
                                if is_success:
                                    db_log.status = "SENT"
                                    db_log.whatsapp_message_id = msg_id
                                    db_log.sent_at = datetime.utcnow()
                                    db_log.error_message = None
                                else:
                                    db_log.status = "FAILED"
                                    db_log.failed_at = datetime.utcnow()
                                    db_log.error_message = err_text
                                await update_session.commit()
                    except Exception as db_ex:
                        logger.error(f"[Campaign #{campaign_id}] Failed updating log #{log_id} in DB: {db_ex}")

            # Run all message sends concurrently
            await asyncio.gather(*(process_recipient(item) for item in log_items))

            # Finalize campaign counts and completion status
            async with AsyncSessionLocal() as final_session:
                stmt = select(MessageLog).where(MessageLog.campaign_id == campaign_id)
                res = await final_session.execute(stmt)
                all_logs = list(res.scalars().all())

                success_count = sum(1 for l in all_logs if l.status in ("SENT", "DELIVERED", "READ"))
                fail_count = sum(1 for l in all_logs if l.status == "FAILED")

                camp = await final_session.get(MessageCampaign, campaign_id)
                if camp:
                    camp.successful_count = success_count
                    camp.failed_count = fail_count
                    camp.status = "COMPLETED"
                    camp.completed_at = datetime.utcnow()
                    await final_session.commit()

            logger.info(
                f"[CampaignService] Campaign #{campaign_id} fully COMPLETED! "
                f"Success: {success_count}, Failed: {fail_count}"
            )
        except Exception as fatal_ex:
            logger.error(f"[CampaignService] Fatal error in Campaign #{campaign_id}: {fatal_ex}")
            # Ensure campaign is never stuck in PROCESSING
            try:
                async with AsyncSessionLocal() as err_session:
                    camp = await err_session.get(MessageCampaign, campaign_id)
                    if camp:
                        camp.status = "COMPLETED"
                        camp.completed_at = datetime.utcnow()
                    # Mark any remaining QUEUED logs as FAILED
                    stmt_rem = select(MessageLog).where(
                        MessageLog.campaign_id == campaign_id,
                        MessageLog.status == "QUEUED"
                    )
                    rem_logs = list((await err_session.execute(stmt_rem)).scalars().all())
                    for l in rem_logs:
                        l.status = "FAILED"
                        l.failed_at = datetime.utcnow()
                        l.error_message = f"Batch processing failed: {str(fatal_ex)}"
                    await err_session.commit()
            except Exception as final_err:
                logger.error(f"[CampaignService] Could not finalize failed campaign: {final_err}")

campaign_service = CampaignService()
