import asyncio
import threading
from datetime import datetime
from typing import Dict, List, Optional, Any
from django.utils import timezone
from api.models import Class, Student, MessageTemplate, MessageCampaign, MessageLog
from api.services.whatsapp_service import whatsapp_service
from api.utils.logger import logger
from api.utils.phone import mask_phone_number

class CampaignService:
    @staticmethod
    def create_and_start_campaign(
        class_id: int,
        template_id: int,
        student_ids: Optional[List[int]] = None,
        dynamic_parameters: Optional[List[str]] = None,
        per_student_parameters: Optional[Dict[Any, List[str]]] = None,
        header_image_url: Optional[str] = None,
    ) -> MessageCampaign:
        school_class = Class.objects.filter(id=class_id).first()
        if not school_class:
            raise ValueError(f"Class with ID {class_id} not found.")

        template = MessageTemplate.objects.filter(id=template_id).first()
        if not template:
            raise ValueError(f"Template with ID {template_id} not found.")

        if template.status.upper() != "ACTIVE":
            raise ValueError(
                f"Template '{template.name}' has status '{template.status}'. "
                "Only ACTIVE (approved by Meta) templates can be used to send messages."
            )

        students_qs = Student.objects.filter(school_class_id=class_id)
        if student_ids and len(student_ids) > 0:
            students_qs = students_qs.filter(id__in=student_ids)

        all_students = list(students_qs)
        if not all_students:
            raise ValueError(f"No students found in {school_class.name} to send messages to.")

        opted_in_students = [s for s in all_students if s.whatsapp_opt_in]
        skipped_students = [s for s in all_students if not s.whatsapp_opt_in]

        total_recipients = len(opted_in_students)
        skipped_count = len(skipped_students)

        effective_image_url = header_image_url or template.sample_image_url or None

        now = timezone.now()
        campaign = MessageCampaign.objects.create(
            school_class=school_class,
            template=template,
            header_image_url=effective_image_url,
            total_recipients=total_recipients,
            successful_count=0,
            failed_count=0,
            skipped_count=skipped_count,
            status="PROCESSING" if total_recipients > 0 else "COMPLETED",
            started_at=now if total_recipients > 0 else None,
            completed_at=now if total_recipients == 0 else None,
        )

        logs_to_create = []
        for s in opted_in_students:
            logs_to_create.append(
                MessageLog(
                    campaign=campaign,
                    student=s,
                    recipient_number=s.whatsapp_number,
                    template_name=template.name,
                    status="QUEUED",
                )
            )

        for s in skipped_students:
            logs_to_create.append(
                MessageLog(
                    campaign=campaign,
                    student=s,
                    recipient_number=s.whatsapp_number,
                    template_name=template.name,
                    status="SKIPPED",
                    error_message="Student has opted out of WhatsApp messages.",
                )
            )

        MessageLog.objects.bulk_create(logs_to_create)

        if total_recipients > 0:
            def run_dispatch():
                asyncio.run(
                    CampaignService._dispatch_campaign(
                        campaign_id=campaign.id,
                        template_name=template.name,
                        language_code=template.language,
                        dynamic_parameters=dynamic_parameters,
                        per_student_parameters=per_student_parameters,
                        header_image_url=effective_image_url,
                    )
                )

            thread = threading.Thread(target=run_dispatch, daemon=True)
            thread.start()

        return campaign

    @staticmethod
    async def _dispatch_campaign(
        campaign_id: int,
        template_name: str,
        language_code: str,
        dynamic_parameters: Optional[List[str]] = None,
        per_student_parameters: Optional[Dict[Any, List[str]]] = None,
        header_image_url: Optional[str] = None,
    ):
        from asgiref.sync import sync_to_async
        from django.conf import settings

        logger.info(f"[CampaignService] Starting async background dispatch for Campaign #{campaign_id}...")

        @sync_to_async
        def get_queued_logs():
            return list(
                MessageLog.objects.filter(campaign_id=campaign_id, status="QUEUED").select_related("student")
            )

        queued_logs = await get_queued_logs()
        if not queued_logs:
            logger.info(f"[CampaignService] No queued logs found for Campaign #{campaign_id}.")
            return

        concurrency = getattr(settings, "WHATSAPP_MAX_CONCURRENCY", 5)
        semaphore = asyncio.Semaphore(concurrency)

        async def send_single_log(log_item: MessageLog):
            async with semaphore:
                student_id = log_item.student_id
                masked_num = mask_phone_number(log_item.recipient_number)

                params = None
                if per_student_parameters and (
                    str(student_id) in per_student_parameters or student_id in per_student_parameters
                ):
                    params = per_student_parameters.get(str(student_id)) or per_student_parameters.get(student_id)
                elif dynamic_parameters:
                    params = dynamic_parameters

                result = await whatsapp_service.send_template_message(
                    recipient_number=log_item.recipient_number,
                    template_name=template_name,
                    language_code=language_code,
                    parameters=params,
                    header_image_url=header_image_url,
                )

                @sync_to_async
                def update_log():
                    log_rec = MessageLog.objects.get(id=log_item.id)
                    now_time = timezone.now()
                    if result.get("success"):
                        log_rec.status = "SENT"
                        log_rec.whatsapp_message_id = result.get("message_id")
                        log_rec.sent_at = now_time
                        log_rec.error_message = None
                    else:
                        log_rec.status = "FAILED"
                        log_rec.failed_at = now_time
                        log_rec.error_message = result.get("error")
                    log_rec.save()

                    campaign = MessageCampaign.objects.get(id=campaign_id)
                    if result.get("success"):
                        campaign.successful_count += 1
                    else:
                        campaign.failed_count += 1
                    campaign.save()

                await update_log()

        tasks = [send_single_log(log_item) for log_item in queued_logs]
        await asyncio.gather(*tasks, return_exceptions=True)

        @sync_to_async
        def finalize_campaign():
            campaign = MessageCampaign.objects.get(id=campaign_id)
            campaign.status = "COMPLETED"
            campaign.completed_at = timezone.now()
            campaign.save()
            logger.info(
                f"[CampaignService] Campaign #{campaign_id} fully COMPLETED! Success: {campaign.successful_count}, Failed: {campaign.failed_count}"
            )

        await finalize_campaign()

    @staticmethod
    def retry_failed_logs(campaign_id: int):
        campaign = MessageCampaign.objects.filter(id=campaign_id).select_related("template").first()
        if not campaign:
            raise ValueError(f"Campaign #{campaign_id} not found.")

        failed_logs = list(MessageLog.objects.filter(campaign_id=campaign_id, status="FAILED"))
        if not failed_logs:
            raise ValueError(f"No failed messages found to retry in Campaign #{campaign_id}.")

        MessageLog.objects.filter(campaign_id=campaign_id, status="FAILED").update(status="QUEUED", error_message=None)
        campaign.status = "PROCESSING"
        campaign.failed_count = 0
        campaign.save()

        def run_dispatch():
            asyncio.run(
                CampaignService._dispatch_campaign(
                    campaign_id=campaign.id,
                    template_name=campaign.template.name,
                    language_code=campaign.template.language,
                    header_image_url=campaign.header_image_url,
                )
            )

        thread = threading.Thread(target=run_dispatch, daemon=True)
        thread.start()

campaign_service = CampaignService()
