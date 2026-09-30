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

from .models import Class, Student, MessageTemplate, MessageCampaign, MessageLog, ChatMessage
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
    ChatMessageSerializer,
    SendConversationMessageSerializer,
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
        class_ids = request.query_params.get("class_ids")
        search = request.query_params.get("search")
        opt_in = request.query_params.get("opt_in")
        fees_filter = request.query_params.get("fees_filter")

        qs = Student.objects.select_related("school_class").order_by("student_name")

        if class_ids:
            c_list = [int(x) for x in class_ids.split(",") if x.strip().isdigit()]
            if c_list:
                qs = qs.filter(school_class_id__in=c_list)
        elif class_id is not None and class_id != "":
            qs = qs.filter(school_class_id=class_id)
        if opt_in is not None and opt_in != "":
            qs = qs.filter(whatsapp_opt_in=(opt_in.lower() == "true"))
        if fees_filter == "PENDING":
            qs = qs.filter(fees_due__gt=0)
        elif fees_filter == "PAID":
            qs = qs.filter(Q(fees_due=0) | Q(fees_due__isnull=True))
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
            fees_due=data.get("fees_due", 0.0),
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
        if "fees_due" in vdata:
            student.fees_due = vdata["fees_due"]
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
        sync_fees_mode = str(request.data.get("reset_absent_fees", request.data.get("sync_fees_mode", "false"))).lower() in ("true", "1", "yes")

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
        fees_col = next((c for c in df.columns if any(k in c for k in ["fee", "dues", "amount", "due", "pending", "balance"])), None)

        if not name_col or not phone_col:
            return Response(
                {"detail": "Spreadsheet must contain columns for Student Name and WhatsApp Phone Number."},
                status=status.HTTP_400_BAD_REQUEST
            )

        created_count = 0
        updated_count = 0
        skipped_count = 0
        classes_created = 0
        classes_cache = {}
        touched_class_ids = set()
        imported_student_ids = set()

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

            # Parse Fees Due if provided in spreadsheet
            fees_val = 0.00
            if fees_col and str(row.get(fees_col, "")).strip() and str(row.get(fees_col, "")).strip().lower() != "nan":
                raw_fees = str(row.get(fees_col, "")).replace("₹", "").replace("$", "").replace(",", "").strip()
                try:
                    fees_val = float(raw_fees)
                except ValueError:
                    fees_val = 0.00

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
                target_class, created_flag = Class.objects.get_or_create(name="General", defaults={"section": "A"})
                if created_flag:
                    classes_created += 1

            touched_class_ids.add(target_class.id)

            # Check if student already exists (upsert / update detail)
            existing_student = Student.objects.filter(
                school_class=target_class,
                whatsapp_number=cleaned_phone
            ).first() or Student.objects.filter(
                whatsapp_number=cleaned_phone,
                student_name__iexact=name_val
            ).first()

            if existing_student:
                imported_student_ids.add(existing_student.id)
                changed = False
                if existing_student.student_name != name_val:
                    existing_student.student_name = name_val
                    changed = True
                if parent_val and parent_val.lower() != "nan" and existing_student.parent_name != parent_val:
                    existing_student.parent_name = parent_val
                    changed = True
                if fees_col and float(existing_student.fees_due or 0.0) != float(fees_val):
                    existing_student.fees_due = fees_val
                    changed = True
                if existing_student.school_class_id != target_class.id:
                    existing_student.school_class = target_class
                    changed = True

                if changed:
                    existing_student.save()
                    updated_count += 1
                else:
                    skipped_count += 1
            else:
                students_to_create.append(
                    Student(
                        school_class=target_class,
                        student_name=name_val,
                        parent_name=parent_val if parent_val and parent_val.lower() != "nan" else None,
                        whatsapp_number=cleaned_phone,
                        fees_due=fees_val,
                        whatsapp_opt_in=True,
                    )
                )

        if students_to_create:
            created_instances = Student.objects.bulk_create(students_to_create)
            created_count = len(students_to_create)
            # Re-fetch newly created IDs to exclude from reset
            new_ids = Student.objects.filter(
                school_class_id__in=touched_class_ids,
                whatsapp_number__in=[s.whatsapp_number for s in students_to_create]
            ).values_list("id", flat=True)
            imported_student_ids.update(new_ids)

        # Handle Fee Defaulters Sync Mode: Auto-clear fees to ₹0 for other students in touched classes
        reset_count = 0
        if sync_fees_mode and fees_col and touched_class_ids:
            reset_count = Student.objects.filter(
                school_class_id__in=touched_class_ids
            ).exclude(
                id__in=imported_student_ids
            ).filter(
                fees_due__gt=0
            ).update(fees_due=0.00)
            logger.info(f"[Import] Fee Defaulters Sync: Auto-cleared dues for {reset_count} paid students in touched classes.")

        msg = f"Import complete: {created_count} added, {updated_count} updated."
        if reset_count > 0:
            msg += f" {reset_count} paid students in imported classes auto-cleared to ₹0."
        if skipped_count > 0:
            msg += f" ({skipped_count} unchanged)."
        if classes_created > 0:
            msg += f" Auto-created {classes_created} new class(es)."

        return Response({
            "message": msg,
            "imported_count": created_count,
            "updated_count": updated_count,
            "reset_count": reset_count,
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
            variable_mappings=data.get("variable_mappings", {}),
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
            existing = MessageTemplate.objects.filter(name=item["name"]).first()
            var_map = existing.variable_mappings if existing and existing.variable_mappings else {}

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
                    "variable_mappings": var_map,
                }
            )

        all_templates = MessageTemplate.objects.all().order_by("name")
        return Response(TemplateSerializer(all_templates, many=True).data)


class TemplateDetailView(APIView):
    def patch(self, request, pk):
        try:
            template = MessageTemplate.objects.get(pk=pk)
        except MessageTemplate.DoesNotExist:
            return Response({"detail": "Template not found"}, status=status.HTTP_404_NOT_FOUND)

        if "variable_mappings" in request.data:
            template.variable_mappings = request.data["variable_mappings"]
            template.save(update_fields=["variable_mappings", "updated_at"])

        return Response(TemplateSerializer(template).data)

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
            sent_cnt = c.message_logs.filter(status__in=["SENT", "DELIVERED", "READ"]).count()
            fail_cnt = c.message_logs.filter(status="FAILED").count()
            has_queued = c.message_logs.filter(status="QUEUED").exists()

            needs_save = False
            if c.successful_count != sent_cnt:
                c.successful_count = sent_cnt
                needs_save = True
            if c.failed_count != fail_cnt:
                c.failed_count = fail_cnt
                needs_save = True
            if (c.status == "PROCESSING" and not has_queued) or (c.status != "COMPLETED" and not has_queued and (sent_cnt + fail_cnt) >= c.total_recipients):
                c.status = "COMPLETED"
                c.completed_at = c.completed_at or timezone.now()
                needs_save = True

            if needs_save:
                c.save(update_fields=["successful_count", "failed_count", "status", "completed_at"])

        serializer = CampaignSerializer(campaigns, many=True)
        return Response(serializer.data)

    def post(self, request):
        serializer = CampaignCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        vdata = serializer.validated_data

        try:
            campaign = campaign_service.create_and_start_campaign(
                class_id=vdata.get("class_id"),
                class_ids=vdata.get("class_ids"),
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

        sent_cnt = campaign.message_logs.filter(status__in=["SENT", "DELIVERED", "READ"]).count()
        fail_cnt = campaign.message_logs.filter(status="FAILED").count()
        has_queued = campaign.message_logs.filter(status="QUEUED").exists()

        needs_save = False
        if campaign.successful_count != sent_cnt:
            campaign.successful_count = sent_cnt
            needs_save = True
        if campaign.failed_count != fail_cnt:
            campaign.failed_count = fail_cnt
            needs_save = True
        if (campaign.status == "PROCESSING" and not has_queued) or (campaign.status != "COMPLETED" and not has_queued and (sent_cnt + fail_cnt) >= campaign.total_recipients):
            campaign.status = "COMPLETED"
            campaign.completed_at = campaign.completed_at or timezone.now()
            needs_save = True

        if needs_save:
            campaign.save(update_fields=["successful_count", "failed_count", "status", "completed_at"])

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

        recipient_number = vdata["recipient_number"]
        template_name = vdata["template_name"]
        language_code = vdata["language_code"]

        logger.info(
            f"[MessagesRouter] Test message request for recipient: {recipient_number} using template: {template_name}"
        )
        result = asyncio.run(
            whatsapp_service.send_template_message(
                recipient_number=recipient_number,
                template_name=template_name,
                language_code=language_code,
            )
        )

        clean_recipient = sanitize_phone_number(recipient_number)
        student = Student.objects.filter(whatsapp_number=clean_recipient).first()
        if not student and len(clean_recipient) >= 10:
            student = Student.objects.filter(whatsapp_number__endswith=clean_recipient[-10:]).first()

        wamid = result.get("message_id")
        succ = result.get("success", False)

        tpl = MessageTemplate.objects.filter(name=template_name).first()
        body_preview = tpl.body_preview if tpl else f"Template: {template_name}"

        # Create MessageLog
        log_entry = MessageLog.objects.create(
            student=student,
            recipient_number=clean_recipient,
            template_name=template_name,
            status="SENT" if succ else "FAILED",
            whatsapp_message_id=wamid,
            error_message=result.get("error") if not succ else None,
            sent_at=timezone.now() if succ else None,
            failed_at=timezone.now() if not succ else None,
        )

        # Mirror to ChatMessage
        try:
            ChatMessage.objects.create(
                student=student,
                phone_number=clean_recipient,
                direction="OUTBOUND",
                message_type="template",
                template_name=template_name,
                text_content=body_preview,
                status="SENT" if succ else "FAILED",
                whatsapp_message_id=wamid,
                message_log=log_entry,
                created_at=timezone.now(),
            )
        except Exception as ex:
            logger.warning(f"[TestMessageView] Failed to mirror to ChatMessage: {ex}")

        return Response({
            "success": succ,
            "message_id": wamid,
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

                # 1. Process Status Updates (SENT, DELIVERED, READ, FAILED)
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

                    # Update ChatMessage status if mirrored
                    ChatMessage.objects.filter(whatsapp_message_id=message_id).update(status=new_status)

                # 2. Process Incoming User Messages (Inbound replies)
                messages = value.get("messages", [])
                contacts = value.get("contacts", [])

                contacts_map = {}
                for c in contacts:
                    wa_id = c.get("wa_id")
                    name = c.get("profile", {}).get("name")
                    if wa_id and name:
                        contacts_map[wa_id] = name

                for msg_item in messages:
                    msg_from = msg_item.get("from", "")
                    wamid = msg_item.get("id")
                    msg_type = msg_item.get("type", "text")
                    timestamp_str = msg_item.get("timestamp")
                    event_time = (
                        datetime.utcfromtimestamp(int(timestamp_str))
                        if timestamp_str and timestamp_str.isdigit()
                        else timezone.now()
                    )

                    if not msg_from:
                        continue

                    clean_phone = sanitize_phone_number(msg_from)
                    sender_name = contacts_map.get(msg_from) or contacts_map.get(clean_phone)

                    extracted_text = ""
                    media_url = None
                    if msg_type == "text":
                        extracted_text = msg_item.get("text", {}).get("body", "")
                    elif msg_type == "interactive":
                        interactive = msg_item.get("interactive", {})
                        btn = interactive.get("button_reply", {})
                        lst = interactive.get("list_reply", {})
                        extracted_text = btn.get("title") or lst.get("title") or "[Interactive Reply]"
                    elif msg_type == "button":
                        extracted_text = msg_item.get("button", {}).get("text", "[Button Click]")
                    elif msg_type == "image":
                        caption = msg_item.get("image", {}).get("caption", "")
                        extracted_text = f"📷 Photo: {caption}" if caption else "📷 Photo"
                    elif msg_type == "document":
                        filename = msg_item.get("document", {}).get("filename", "")
                        extracted_text = f"📄 Document: {filename}" if filename else "📄 Document"
                    elif msg_type in ("audio", "voice"):
                        extracted_text = "🎵 Voice Note / Audio"
                    elif msg_type == "video":
                        caption = msg_item.get("video", {}).get("caption", "")
                        extracted_text = f"🎥 Video: {caption}" if caption else "🎥 Video"
                    elif msg_type == "location":
                        loc = msg_item.get("location", {})
                        loc_name = loc.get("name") or loc.get("address") or f"{loc.get('latitude')}, {loc.get('longitude')}"
                        extracted_text = f"📍 Location: {loc_name}"
                    elif msg_type == "reaction":
                        emoji = msg_item.get("reaction", {}).get("emoji", "")
                        extracted_text = f"Reacted: {emoji}"
                    else:
                        extracted_text = f"[{msg_type.capitalize()} message]"

                    # Match student
                    student = Student.objects.filter(whatsapp_number=clean_phone).first()
                    if not student and len(clean_phone) >= 10:
                        student = Student.objects.filter(whatsapp_number__endswith=clean_phone[-10:]).first()

                    if wamid:
                        chat_msg, created = ChatMessage.objects.get_or_create(
                            whatsapp_message_id=wamid,
                            defaults={
                                "student": student,
                                "phone_number": clean_phone,
                                "sender_name": sender_name or (student.student_name if student else None),
                                "direction": "INBOUND",
                                "message_type": msg_type,
                                "text_content": extracted_text,
                                "media_url": media_url,
                                "status": "RECEIVED",
                                "raw_payload": msg_item,
                                "created_at": event_time,
                            }
                        )
                        if created:
                            logger.info(f"[Webhook] Saved incoming WhatsApp message from {clean_phone}: '{extracted_text}'")
                    else:
                        ChatMessage.objects.create(
                            student=student,
                            phone_number=clean_phone,
                            sender_name=sender_name or (student.student_name if student else None),
                            direction="INBOUND",
                            message_type=msg_type,
                            text_content=extracted_text,
                            media_url=media_url,
                            status="RECEIVED",
                            raw_payload=msg_item,
                            created_at=event_time,
                        )
                        logger.info(f"[Webhook] Saved incoming WhatsApp message from {clean_phone}: '{extracted_text}'")

                # 3. Process Template Status Updates
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


class ConversationDetailView(APIView):
    def get(self, request, identifier=None):
        phone = request.query_params.get("phone")
        student_id = request.query_params.get("student_id")

        if identifier:
            if str(identifier).isdigit() and len(str(identifier)) <= 8:
                student_id = identifier
            else:
                phone = identifier

        student = None
        if student_id:
            student = Student.objects.select_related("school_class").filter(id=student_id).first()
            if student and not phone:
                phone = student.whatsapp_number

        if phone:
            phone = sanitize_phone_number(phone)
            if not student:
                student = Student.objects.select_related("school_class").filter(whatsapp_number=phone).first()
                if not student and len(phone) >= 10:
                    student = Student.objects.select_related("school_class").filter(whatsapp_number__endswith=phone[-10:]).first()

        if not phone and not student:
            return Response({"detail": "Student or phone number not found"}, status=status.HTTP_404_NOT_FOUND)

        filter_q = Q()
        if student:
            filter_q |= Q(student=student)
        if phone:
            filter_q |= Q(phone_number=phone)
            if len(phone) >= 10:
                filter_q |= Q(phone_number__endswith=phone[-10:])

        # Only include delivered, read, or inbound messages
        allowed_statuses = ["DELIVERED", "READ"]
        status_filter = Q(direction="INBOUND") | Q(status__in=allowed_statuses)

        raw_messages = list(
            ChatMessage.objects.filter(filter_q)
            .filter(status_filter)
            .select_related("student", "student__school_class")
            .order_by("created_at")
        )

        # Deduplicate any duplicate ChatMessage records in DB
        seen_keys = set()
        chat_messages = []
        for msg in raw_messages:
            key = (
                msg.whatsapp_message_id
                if (msg.whatsapp_message_id and msg.whatsapp_message_id.strip())
                else (f"log_{msg.message_log_id}" if msg.message_log_id else f"{msg.direction}_{msg.text_content}_{msg.created_at}")
            )
            if key in seen_keys:
                try:
                    msg.delete()
                except Exception:
                    pass
            else:
                seen_keys.add(key)
                chat_messages.append(msg)

        # Mirror historical MessageLogs only if they are DELIVERED or READ and have NO ChatMessage record
        if student or phone:
            existing_log_ids = {m.message_log_id for m in chat_messages if m.message_log_id}
            existing_wamids = {m.whatsapp_message_id for m in chat_messages if m.whatsapp_message_id}
            
            log_q = Q(status__in=allowed_statuses)
            if student:
                log_sub = Q(student=student)
                if student.whatsapp_number:
                    log_sub |= Q(recipient_number=student.whatsapp_number)
                log_q &= log_sub
            if phone:
                log_sub = Q(recipient_number=phone)
                if len(phone) >= 10:
                    log_sub |= Q(recipient_number__endswith=phone[-10:])
                log_q &= log_sub

            unmirrored_logs = MessageLog.objects.filter(log_q)
            if existing_log_ids:
                unmirrored_logs = unmirrored_logs.exclude(id__in=existing_log_ids)
            if existing_wamids:
                unmirrored_logs = unmirrored_logs.exclude(whatsapp_message_id__in=existing_wamids)

            for log_entry in unmirrored_logs:
                # Direct DB check to avoid any duplicate creation
                has_existing = ChatMessage.objects.filter(
                    Q(message_log=log_entry) | 
                    (Q(whatsapp_message_id=log_entry.whatsapp_message_id) & ~Q(whatsapp_message_id=None) & ~Q(whatsapp_message_id=""))
                ).exists()

                if has_existing:
                    continue

                tpl = MessageTemplate.objects.filter(name=log_entry.template_name).first()
                body_preview = tpl.body_preview if tpl else f"Template: {log_entry.template_name}"
                media_img = None
                if log_entry.campaign and log_entry.campaign.header_image_url:
                    media_img = log_entry.campaign.header_image_url
                elif tpl and (tpl.header_type or "").upper() == "IMAGE":
                    media_img = tpl.sample_image_url

                new_chat_msg = ChatMessage.objects.create(
                    student=log_entry.student or student,
                    phone_number=log_entry.recipient_number,
                    direction="OUTBOUND",
                    message_type="template",
                    template_name=log_entry.template_name,
                    text_content=body_preview,
                    media_url=media_img,
                    status=log_entry.status,
                    whatsapp_message_id=log_entry.whatsapp_message_id,
                    message_log=log_entry,
                    created_at=log_entry.sent_at or log_entry.created_at,
                )
                chat_messages.append(new_chat_msg)

        # Attach image media_url if message template has an image header
        for m in chat_messages:
            if not m.media_url and m.template_name:
                tpl = MessageTemplate.objects.filter(name=m.template_name).first()
                if tpl and (tpl.header_type or "").upper() == "IMAGE" and tpl.sample_image_url:
                    m.media_url = tpl.sample_image_url
            if not m.media_url and m.message_log and m.message_log.campaign and m.message_log.campaign.header_image_url:
                m.media_url = m.message_log.campaign.header_image_url

        chat_messages.sort(key=lambda m: m.created_at)

        student_data = None
        if student:
            student_data = {
                "id": student.id,
                "student_name": student.student_name,
                "parent_name": student.parent_name,
                "whatsapp_number": student.whatsapp_number,
                "fees_due": str(student.fees_due),
                "class_id": student.school_class_id,
                "class_name": (
                    f"{student.school_class.name} - {student.school_class.section}"
                    if student.school_class and student.school_class.section
                    else (student.school_class.name if student.school_class else "General")
                ),
            }

        first_sender_name = None
        for m in chat_messages:
            if m.sender_name:
                first_sender_name = m.sender_name
                break

        return Response({
            "student": student_data,
            "phone_number": phone or (student.whatsapp_number if student else ""),
            "recipient_name": student.student_name if student else (first_sender_name or phone),
            "total_messages": len(chat_messages),
            "messages": ChatMessageSerializer(chat_messages, many=True).data,
        })


class ConversationSendMessageView(APIView):
    def post(self, request):
        serializer = SendConversationMessageSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        vdata = serializer.validated_data

        student_id = vdata.get("student_id")
        phone_number = vdata.get("phone_number")
        text_message = vdata.get("message")
        template_name = vdata.get("template_name")
        language_code = vdata.get("language_code", "en_US")
        parameters = vdata.get("parameters")

        student = None
        if student_id:
            student = Student.objects.select_related("school_class").filter(id=student_id).first()
            if student and not phone_number:
                phone_number = student.whatsapp_number

        if not phone_number and student:
            phone_number = student.whatsapp_number

        if not phone_number:
            return Response(
                {"detail": "Recipient phone number could not be determined."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        clean_phone = sanitize_phone_number(phone_number)
        if not student:
            student = Student.objects.filter(whatsapp_number=clean_phone).first()
            if not student and len(clean_phone) >= 10:
                student = Student.objects.filter(whatsapp_number__endswith=clean_phone[-10:]).first()

        if template_name:
            tpl = MessageTemplate.objects.filter(name=template_name).first()
            result = asyncio.run(
                whatsapp_service.send_template_message(
                    recipient_number=clean_phone,
                    template_name=template_name,
                    language_code=tpl.language if tpl else language_code,
                    parameters=parameters,
                )
            )
            wamid = result.get("message_id")
            succ = result.get("success", False)
            body_text = tpl.body_preview if tpl else f"Template: {template_name}"

            log_entry = MessageLog.objects.create(
                student=student,
                recipient_number=clean_phone,
                template_name=template_name,
                status="SENT" if succ else "FAILED",
                whatsapp_message_id=wamid,
                error_message=result.get("error") if not succ else None,
                sent_at=timezone.now() if succ else None,
                failed_at=timezone.now() if not succ else None,
            )

            chat_msg = ChatMessage.objects.create(
                student=student,
                phone_number=clean_phone,
                direction="OUTBOUND",
                message_type="template",
                template_name=template_name,
                text_content=body_text,
                status="SENT" if succ else "FAILED",
                whatsapp_message_id=wamid,
                message_log=log_entry,
                created_at=timezone.now(),
            )
            return Response({
                "success": succ,
                "message": ChatMessageSerializer(chat_msg).data,
                "error": result.get("error"),
            })
        else:
            result = asyncio.run(
                whatsapp_service.send_text_message(
                    recipient_number=clean_phone,
                    message_text=text_message,
                )
            )
            wamid = result.get("message_id")
            succ = result.get("success", False)

            chat_msg = ChatMessage.objects.create(
                student=student,
                phone_number=clean_phone,
                direction="OUTBOUND",
                message_type="text",
                text_content=text_message,
                status="SENT" if succ else "FAILED",
                whatsapp_message_id=wamid,
                created_at=timezone.now(),
            )
            return Response({
                "success": succ,
                "message": ChatMessageSerializer(chat_msg).data,
                "error": result.get("error"),
            })



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


class AuthLoginView(APIView):
    authentication_classes = []
    permission_classes = []

    def post(self, request):
        import hashlib
        email = str(request.data.get("email", "")).strip()
        password = str(request.data.get("password", "")).strip()

        configured_email = getattr(settings, "ADMIN_EMAIL", "admin@school.com").strip()
        configured_password = getattr(settings, "ADMIN_PASSWORD", "admin123").strip()

        if not email or not password:
            return Response(
                {"detail": "Please enter both your email address and password."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if email.lower() == configured_email.lower() and password == configured_password:
            token_seed = f"{configured_email}:{configured_password}:{getattr(settings, 'SECRET_KEY', 'default_secret')}"
            token = f"auth_{hashlib.sha256(token_seed.encode()).hexdigest()[:32]}"

            return Response({
                "success": True,
                "token": token,
                "user": {
                    "email": configured_email,
                    "name": "School Administrator",
                    "role": "admin",
                },
                "message": "Login successful",
            })

        return Response(
            {"detail": "Invalid credentials. Please verify the email and password configured in your .env file."},
            status=status.HTTP_401_UNAUTHORIZED,
        )


class AuthMeView(APIView):
    authentication_classes = []
    permission_classes = []

    def get(self, request):
        import hashlib
        auth_header = request.headers.get("Authorization", "")
        token = auth_header.replace("Bearer ", "").strip() if "Bearer " in auth_header else auth_header.strip()

        configured_email = getattr(settings, "ADMIN_EMAIL", "admin@school.com").strip()
        configured_password = getattr(settings, "ADMIN_PASSWORD", "admin123").strip()
        token_seed = f"{configured_email}:{configured_password}:{getattr(settings, 'SECRET_KEY', 'default_secret')}"
        expected_token = f"auth_{hashlib.sha256(token_seed.encode()).hexdigest()[:32]}"

        if token and (token == expected_token or token.startswith("auth_")):
            return Response({
                "authenticated": True,
                "user": {
                    "email": configured_email,
                    "name": "School Administrator",
                    "role": "admin",
                },
            })

        return Response({"authenticated": False, "detail": "Session expired or invalid."}, status=status.HTTP_401_UNAUTHORIZED)


class AuthLogoutView(APIView):
    authentication_classes = []
    permission_classes = []

    def post(self, request):
        return Response({"success": True, "message": "Logged out successfully."})

