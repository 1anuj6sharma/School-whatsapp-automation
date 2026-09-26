import os
import io
import uuid
from pathlib import Path
import asyncio
import pandas as pd
from datetime import datetime
from django.conf import settings
from django.db.models import Count, Q
from django.http import HttpResponse, JsonResponse
from django.utils import timezone
from rest_framework import status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser

from .models import Class, Student, MessageTemplate, MessageCampaign, MessageLog
from .serializers import (
    ClassSerializer,
    ClassCreateSerializer,
    ClassUpdateSerializer,
    StudentSerializer,
    StudentCreateSerializer,
    StudentUpdateSerializer,
    TemplateSerializer,
    TemplateCreateMetaSerializer,
    CampaignSerializer,
    CampaignDetailSerializer,
    CampaignCreateSerializer,
    MessageLogSerializer,
    TestMessageSerializer,
)
from .services.whatsapp_service import whatsapp_service
from .services.campaign_service import campaign_service
from .utils.logger import logger
from .utils.phone import sanitize_phone_number, validate_phone_number


class HealthCheckView(APIView):
    authentication_classes = []
    permission_classes = []

    def get(self, request):
        token = (whatsapp_service.get_access_token() or "").strip()
        masked_token = f"{token[:12]}...{token[-6:]}" if len(token) > 18 else ("••••••••" if token else "Not Configured")

        return Response({
            "status": "ok",
            "service": "school-whatsapp-automation",
            "timestamp": timezone.now().isoformat(),
            "database": "connected",
            "whatsapp": {
                "phone_number_id": whatsapp_service.get_phone_number_id(),
                "business_account_id": whatsapp_service.get_waba_id(),
                "api_version": getattr(settings, "WHATSAPP_API_VERSION", "v26.0"),
                "verify_token": getattr(settings, "WHATSAPP_VERIFY_TOKEN", "school"),
                "access_token": token,
                "access_token_masked": masked_token,
                "max_concurrency": getattr(settings, "WHATSAPP_MAX_CONCURRENCY", 5),
                "webhook_endpoint": "/webhooks/whatsapp",
            }
        })


class ClassListCreateView(APIView):
    def get(self, request):
        classes = Class.objects.annotate(student_count_annotated=Count("students")).order_by("name")
        serializer = ClassSerializer(classes, many=True)
        return Response(serializer.data)

    def post(self, request):
        serializer = ClassCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        instance = serializer.save()
        out_serializer = ClassSerializer(instance)
        return Response(out_serializer.data, status=status.HTTP_201_CREATED)


class ClassDetailView(APIView):
    def get(self, request, pk):
        try:
            cls = Class.objects.annotate(student_count_annotated=Count("students")).get(pk=pk)
        except Class.DoesNotExist:
            return Response({"detail": "Class not found"}, status=status.HTTP_404_NOT_FOUND)
        return Response(ClassSerializer(cls).data)

    def put(self, request, pk):
        try:
            cls = Class.objects.get(pk=pk)
        except Class.DoesNotExist:
            return Response({"detail": "Class not found"}, status=status.HTTP_404_NOT_FOUND)

        serializer = ClassUpdateSerializer(cls, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(ClassSerializer(cls).data)

    def delete(self, request, pk):
        try:
            cls = Class.objects.get(pk=pk)
        except Class.DoesNotExist:
            return Response({"detail": "Class not found"}, status=status.HTTP_404_NOT_FOUND)
        cls.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class StudentListCreateView(APIView):
    def get(self, request):
        class_id = request.query_params.get("class_id")
        search = request.query_params.get("search")
        opt_in = request.query_params.get("opt_in")

        qs = Student.objects.select_related("school_class").order_by("student_name")

        if class_id is not None and class_id != "":
            qs = qs.filter(school_class_id=class_id)
        if opt_in is not None and opt_in != "":
            qs = qs.filter(whatsapp_opt_in=(opt_in.lower() == "true"))
        if search:
            s_term = search.strip()
            qs = qs.filter(
                Q(student_name__icontains=s_term)
                | Q(parent_name__icontains=s_term)
                | Q(whatsapp_number__icontains=s_term)
            )

        serializer = StudentSerializer(qs, many=True)
        return Response(serializer.data)

    def post(self, request):
        serializer = StudentCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        school_class = Class.objects.get(id=data["class_id"])
        student = Student.objects.create(
            school_class=school_class,
            student_name=data["student_name"].strip(),
            parent_name=data.get("parent_name", "").strip() if data.get("parent_name") else None,
            whatsapp_number=data["whatsapp_number"],
            whatsapp_opt_in=data.get("whatsapp_opt_in", True),
        )
        return Response(StudentSerializer(student).data, status=status.HTTP_201_CREATED)


class StudentDetailView(APIView):
    def get(self, request, pk):
        try:
            student = Student.objects.select_related("school_class").get(pk=pk)
        except Student.DoesNotExist:
            return Response({"detail": "Student not found"}, status=status.HTTP_404_NOT_FOUND)
        return Response(StudentSerializer(student).data)

    def put(self, request, pk):
        try:
            student = Student.objects.select_related("school_class").get(pk=pk)
        except Student.DoesNotExist:
            return Response({"detail": "Student not found"}, status=status.HTTP_404_NOT_FOUND)

        serializer = StudentUpdateSerializer(data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        vdata = serializer.validated_data

        if "class_id" in vdata:
            cls = Class.objects.filter(id=vdata["class_id"]).first()
            if not cls:
                return Response({"detail": "Selected class does not exist."}, status=status.HTTP_400_BAD_REQUEST)
            student.school_class = cls

        if "student_name" in vdata:
            student.student_name = vdata["student_name"].strip()
        if "parent_name" in vdata:
            student.parent_name = vdata["parent_name"].strip() if vdata["parent_name"] else None
        if "whatsapp_number" in vdata:
            student.whatsapp_number = vdata["whatsapp_number"]
        if "whatsapp_opt_in" in vdata:
            student.whatsapp_opt_in = vdata["whatsapp_opt_in"]

        student.save()
        return Response(StudentSerializer(student).data)

    def delete(self, request, pk):
        try:
            student = Student.objects.get(pk=pk)
        except Student.DoesNotExist:
            return Response({"detail": "Student not found"}, status=status.HTTP_404_NOT_FOUND)
        student.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class StudentImportCSVView(APIView):
    def post(self, request):
        if "file" not in request.FILES:
            return Response({"detail": "No Excel or CSV file provided."}, status=status.HTTP_400_BAD_REQUEST)

        file = request.FILES["file"]
        default_class_id = request.data.get("class_id")
        default_class = Class.objects.filter(id=default_class_id).first() if default_class_id else None

        filename = file.name.lower()
        try:
            if filename.endswith(".xlsx") or filename.endswith(".xls"):
                df = pd.read_excel(file)
            else:
                df = pd.read_csv(file)
        except Exception as ex:
            return Response({"detail": f"Failed to parse spreadsheet file: {str(ex)}"}, status=status.HTTP_400_BAD_REQUEST)

        # Normalize column headers
        df.columns = [str(c).strip().lower().replace(" ", "_").replace("-", "_") for c in df.columns]

        # Look for relevant columns
        name_col = next((c for c in df.columns if "student" in c or "name" in c), None)
        phone_col = next((c for c in df.columns if "phone" in c or "whatsapp" in c or "mobile" in c or "contact" in c or "number" in c), None)
        parent_col = next((c for c in df.columns if "parent" in c or "father" in c or "guardian" in c), None)
        class_col = next((c for c in df.columns if "class" in c or "grade" in c or "standard" in c), None)
        section_col = next((c for c in df.columns if "section" in c or "sec" in c), None)

        if not name_col or not phone_col:
            return Response(
                {"detail": "Spreadsheet must contain columns for Student Name and WhatsApp Phone Number."},
                status=status.HTTP_400_BAD_REQUEST
            )

        created_count = 0
        skipped_count = 0
        classes_created = 0
        classes_cache = {}

        students_to_create = []
        for _, row in df.iterrows():
            name_val = str(row.get(name_col, "")).strip()
            phone_val = str(row.get(phone_col, "")).strip()
            parent_val = str(row.get(parent_col, "")).strip() if parent_col else ""

            if not name_val or name_val.lower() == "nan":
                skipped_count += 1
                continue

            cleaned_phone = sanitize_phone_number(phone_val)
            if not validate_phone_number(cleaned_phone):
                skipped_count += 1
                continue

            # Resolve Class
            target_class = None
            if class_col and str(row.get(class_col, "")).strip() and str(row.get(class_col, "")).strip().lower() != "nan":
                raw_class_name = str(row.get(class_col, "")).strip()
                sec_val = str(row.get(section_col, "")).strip() if section_col and str(row.get(section_col, "")).strip().lower() != "nan" else None

                cache_key = f"{raw_class_name.lower()}_{sec_val.lower() if sec_val else ''}"
                if cache_key in classes_cache:
                    target_class = classes_cache[cache_key]
                else:
                    target_class = Class.objects.filter(name__iexact=raw_class_name).first()
                    if not target_class:
                        target_class = Class.objects.create(name=raw_class_name, section=sec_val)
                        classes_created += 1
                        logger.info(f"[Import] Auto-created new class '{raw_class_name}' from spreadsheet.")
                    classes_cache[cache_key] = target_class

            elif default_class:
                target_class = default_class
            else:
                # Fallback to default class
                target_class, created_flag = Class.objects.get_or_create(name="General", defaults={"section": "A"})
                if created_flag:
                    classes_created += 1

            students_to_create.append(
                Student(
                    school_class=target_class,
                    student_name=name_val,
                    parent_name=parent_val if parent_val and parent_val.lower() != "nan" else None,
                    whatsapp_number=cleaned_phone,
                    whatsapp_opt_in=True,
                )
            )

        if students_to_create:
            Student.objects.bulk_create(students_to_create)
            created_count = len(students_to_create)

        msg = f"Successfully imported {created_count} students ({skipped_count} skipped)."
        if classes_created > 0:
            msg += f" Auto-created {classes_created} new class(es)."

        return Response({
            "message": msg,
            "imported_count": created_count,
            "skipped_count": skipped_count,
            "classes_created_count": classes_created
        })


class TemplateListCreateView(APIView):
    def get(self, request):
        templates = list(MessageTemplate.objects.all().order_by("name"))

        if not templates or len(templates) <= 2:
            try:
                meta_templates = asyncio.run(whatsapp_service.fetch_templates_from_meta())
                for item in meta_templates:
                    name = item["name"]
                    MessageTemplate.objects.update_or_create(
                        name=name,
                        defaults={
                            "category": item["category"],
                            "language": item["language"],
                            "status": item["status"],
                            "body_preview": item["body_preview"],
                            "description": item.get("description", f"Meta {item['category']} Template"),
                            "header_type": item.get("header_type", "NONE"),
                            "header_text": item.get("header_text"),
                        }
                    )
                templates = list(MessageTemplate.objects.all().order_by("name"))
            except Exception as ex:
                logger.warning(f"[Templates] Auto-sync from Meta skipped: {ex}")

        serializer = TemplateSerializer(templates, many=True)
        return Response(serializer.data)

    def post(self, request):
        serializer = TemplateCreateMetaSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        name = data["name"].lower().strip()
        if MessageTemplate.objects.filter(name=name).exists():
            return Response({"detail": f"Template '{name}' already exists."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            meta_result = asyncio.run(
                whatsapp_service.create_template_on_meta(
                    name=name,
                    category=data["category"],
                    language=data["language"],
                    body_text=data["body_text"],
                    sample_values=data.get("sample_values"),
                    header_type=data.get("header_type", "NONE"),
                    header_text=data.get("header_text"),
                    sample_image_url=data.get("sample_image_url"),
                )
            )
        except ValueError as val_err:
            return Response({"detail": str(val_err)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as ex:
            return Response({"detail": f"Failed to submit template to Meta: {str(ex)}"}, status=status.HTTP_502_BAD_GATEWAY)

        tpl_status = meta_result.get("status", "PENDING").upper()
        if tpl_status == "APPROVED":
            tpl_status = "ACTIVE"

        template = MessageTemplate.objects.create(
            name=meta_result["name"],
            category=meta_result["category"],
            language=meta_result["language"],
            body_preview=meta_result["body_preview"],
            status=tpl_status,
            description=f"Meta {meta_result['category']} Template ({meta_result['language']})",
            header_type=meta_result.get("header_type", data.get("header_type", "NONE")),
            header_text=meta_result.get("header_text", data.get("header_text")),
            sample_image_url=meta_result.get("sample_image_url", data.get("sample_image_url")),
        )
        return Response(TemplateSerializer(template).data, status=status.HTTP_201_CREATED)


class TemplateSyncView(APIView):
    def post(self, request):
        try:
            meta_templates = asyncio.run(whatsapp_service.fetch_templates_from_meta())
        except Exception as ex:
            return Response(
                {"detail": f"Failed to fetch templates from Meta WhatsApp API: {str(ex)}"},
                status=status.HTTP_502_BAD_GATEWAY
            )

        for item in meta_templates:
            MessageTemplate.objects.update_or_create(
                name=item["name"],
                defaults={
                    "category": item["category"],
                    "language": item["language"],
                    "status": item["status"],
                    "body_preview": item["body_preview"],
                    "description": item.get("description", f"Meta {item['category']} Template"),
                    "header_type": item.get("header_type", "NONE"),
                    "header_text": item.get("header_text"),
                }
            )

        all_templates = MessageTemplate.objects.all().order_by("name")
        return Response(TemplateSerializer(all_templates, many=True).data)


class TemplateDetailView(APIView):
    def delete(self, request, pk):
        try:
            template = MessageTemplate.objects.get(pk=pk)
        except MessageTemplate.DoesNotExist:
            return Response({"detail": "Template not found"}, status=status.HTTP_404_NOT_FOUND)

        try:
            asyncio.run(whatsapp_service.delete_template_on_meta(template.name))
        except Exception as ex:
            logger.warning(f"[Templates] Could not delete '{template.name}' on Meta: {ex}")

        template.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class CampaignListCreateView(APIView):
    def get(self, request):
        campaigns = list(
            MessageCampaign.objects.select_related("school_class", "template")
            .prefetch_related("message_logs")
            .order_by("-created_at")
        )

        for c in campaigns:
            if c.status == "PROCESSING":
                has_queued = c.message_logs.filter(status="QUEUED").exists()
                if not has_queued:
                    c.status = "COMPLETED"
                    c.completed_at = c.completed_at or timezone.now()
                    c.save()

        serializer = CampaignSerializer(campaigns, many=True)
        return Response(serializer.data)

    def post(self, request):
        serializer = CampaignCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        vdata = serializer.validated_data

        try:
            campaign = campaign_service.create_and_start_campaign(
                class_id=vdata["class_id"],
                template_id=vdata["template_id"],
                student_ids=vdata.get("student_ids"),
                dynamic_parameters=vdata.get("dynamic_parameters"),
                per_student_parameters=vdata.get("per_student_parameters"),
                header_image_url=vdata.get("header_image_url"),
            )
        except ValueError as val_err:
            return Response({"detail": str(val_err)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as ex:
            return Response({"detail": f"Failed to start campaign: {str(ex)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        return Response(CampaignSerializer(campaign).data, status=status.HTTP_201_CREATED)


class CampaignDetailView(APIView):
    def get(self, request, pk):
        try:
            campaign = (
                MessageCampaign.objects.select_related("school_class", "template")
                .prefetch_related("message_logs__student")
                .get(pk=pk)
            )
        except MessageCampaign.DoesNotExist:
            return Response({"detail": "Campaign not found"}, status=status.HTTP_404_NOT_FOUND)

        if campaign.status == "PROCESSING":
            has_queued = campaign.message_logs.filter(status="QUEUED").exists()
            if not has_queued:
                campaign.status = "COMPLETED"
                campaign.completed_at = campaign.completed_at or timezone.now()
                campaign.save()

        return Response(CampaignDetailSerializer(campaign).data)


class CampaignRetryView(APIView):
    def post(self, request, pk):
        try:
            campaign_service.retry_failed_logs(pk)
            return Response({"message": f"Retry dispatched for failed messages in Campaign #{pk}."})
        except ValueError as val_err:
            return Response({"detail": str(val_err)}, status=status.HTTP_400_BAD_REQUEST)


class MessageLogListView(APIView):
    def get(self, request):
        campaign_id = request.query_params.get("campaign_id")
        student_id = request.query_params.get("student_id")
        status_filter = request.query_params.get("status")
        limit = int(request.query_params.get("limit", 100))
        offset = int(request.query_params.get("offset", 0))

        qs = MessageLog.objects.select_related("student").order_by("-created_at")

        if campaign_id:
            qs = qs.filter(campaign_id=campaign_id)
        if student_id:
            qs = qs.filter(student_id=student_id)
        if status_filter:
            qs = qs.filter(status=status_filter.upper())

        logs = qs[offset : offset + limit]
        return Response(MessageLogSerializer(logs, many=True).data)


class MessageLogDetailView(APIView):
    def get(self, request, pk):
        try:
            log = MessageLog.objects.select_related("student").get(pk=pk)
        except MessageLog.DoesNotExist:
            return Response({"detail": "Message log not found"}, status=status.HTTP_404_NOT_FOUND)
        return Response(MessageLogSerializer(log).data)


class TestMessageView(APIView):
    def post(self, request):
        serializer = TestMessageSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        vdata = serializer.validated_data

        logger.info(
            f"[MessagesRouter] Test message request for recipient: {vdata['recipient_number']} using template: {vdata['template_name']}"
        )
        result = asyncio.run(
            whatsapp_service.send_template_message(
                recipient_number=vdata["recipient_number"],
                template_name=vdata["template_name"],
                language_code=vdata["language_code"],
            )
        )

        return Response({
            "success": result.get("success", False),
            "message_id": result.get("message_id"),
            "recipient": result.get("recipient"),
            "error": result.get("error"),
            "meta_error": result.get("meta_error"),
        })


class WhatsAppWebhookView(APIView):
    authentication_classes = []
    permission_classes = []

    def get(self, request):
        hub_mode = request.query_params.get("hub.mode")
        hub_verify_token = request.query_params.get("hub.verify_token")
        hub_challenge = request.query_params.get("hub.challenge")

        logger.info(f"[Webhook] Verification request received. Mode: {hub_mode}")

        if hub_mode == "subscribe" and hub_verify_token == settings.WHATSAPP_VERIFY_TOKEN:
            logger.info("[Webhook] Verification token verified successfully.")
            return HttpResponse(hub_challenge, content_type="text/plain")

        logger.warning("[Webhook] Verification failed. Invalid verify token or mode.")
        return HttpResponse("Verification token mismatch", status=403)

    def post(self, request):
        data = request.data
        entries = data.get("entry", [])
        for entry in entries:
            changes = entry.get("changes", [])
            for change in changes:
                value = change.get("value", {})
                statuses = value.get("statuses", [])

                for status_item in statuses:
                    message_id = status_item.get("id")
                    new_status = status_item.get("status", "").upper()
                    timestamp_str = status_item.get("timestamp")
                    event_time = (
                        datetime.utcfromtimestamp(int(timestamp_str))
                        if timestamp_str and timestamp_str.isdigit()
                        else timezone.now()
                    )

                    if not message_id:
                        continue

                    log_entry = MessageLog.objects.filter(whatsapp_message_id=message_id).first()
                    if log_entry:
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
                        log_entry.save()

                field = change.get("field")
                if field == "message_template_status_update":
                    template_name = value.get("message_template_name")
                    event = value.get("event", "").upper()
                    status_map = {
                        "APPROVED": "ACTIVE",
                        "REJECTED": "REJECTED",
                        "PENDING": "PENDING",
                        "PAUSED": "PAUSED",
                        "IN_APPEAL": "PENDING",
                    }
                    mapped_status = status_map.get(event, event)
                    tpl = MessageTemplate.objects.filter(name=template_name).first()
                    if tpl:
                        tpl.status = mapped_status
                        tpl.save()

        return Response({"status": "ok"})


class EmbeddedSignupConfigView(APIView):
    def get(self, request):
        return Response({
            "app_id": settings.META_APP_ID,
            "config_id": settings.META_CONFIG_ID,
            "phone_number_id": whatsapp_service.get_phone_number_id(),
            "waba_id": whatsapp_service.get_waba_id(),
            "configured": whatsapp_service.is_configured(),
        })


class EmbeddedSignupExchangeTokenView(APIView):
    def post(self, request):
        # Support token exchange
        code = request.data.get("code")
        access_token = request.data.get("access_token")
        phone_number_id = request.data.get("phone_number_id")
        waba_id = request.data.get("waba_id")

        if access_token or code:
            whatsapp_service.update_credentials(
                phone_number_id=phone_number_id,
                business_account_id=waba_id,
                access_token=access_token,
            )
            return Response({"success": True, "message": "WhatsApp credentials updated successfully."})

        return Response({"detail": "No code or access token provided."}, status=status.HTTP_400_BAD_REQUEST)


class MediaUploadView(APIView):
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request):
        if "file" not in request.FILES:
            return Response(
                {"detail": "No file uploaded. Please select an image file."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        uploaded_file = request.FILES["file"]
        ext = Path(uploaded_file.name).suffix.lower()

        allowed_extensions = {".jpg", ".jpeg", ".png", ".webp"}
        if ext not in allowed_extensions:
            return Response(
                {"detail": f"Unsupported file type '{ext}'. Allowed types: JPG, JPEG, PNG, WEBP."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        max_size = 5 * 1024 * 1024  # 5MB Meta WhatsApp limit
        if uploaded_file.size > max_size:
            return Response(
                {"detail": "File size exceeds 5MB limit. Please upload an image under 5MB."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        upload_dir = settings.MEDIA_ROOT
        os.makedirs(upload_dir, exist_ok=True)

        clean_original_name = Path(uploaded_file.name).name.replace(" ", "_")
        unique_filename = f"{uuid.uuid4().hex[:12]}_{clean_original_name}"
        file_path = os.path.join(upload_dir, unique_filename)

        with open(file_path, "wb+") as destination:
            for chunk in uploaded_file.chunks():
                destination.write(chunk)

        base_url = request.build_absolute_uri("/").rstrip("/")
        file_url = f"{base_url}/uploads/{unique_filename}"
        relative_url = f"/uploads/{unique_filename}"

        return Response(
            {
                "success": True,
                "filename": unique_filename,
                "url": file_url,
                "relative_url": relative_url,
            },
            status=status.HTTP_201_CREATED,
        )
