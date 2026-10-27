import os
import io
import json
import math
import uuid
from pathlib import Path
import asyncio
from asgiref.sync import async_to_sync
import pandas as pd
from datetime import datetime, timezone as dt_timezone
from django.conf import settings
from django.db.models import Count, Q
from django.http import HttpResponse, JsonResponse, FileResponse
from django.utils import timezone
from django.utils.dateparse import parse_date
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter
from rest_framework import status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser

from .models import Class, Student, MessageTemplate, MessageCampaign, MessageLog, ChatMessage, ComplaintFeedback, BotUserProfile
from .serializers import (
    ClassSerializer,
    ClassCreateSerializer,
    ClassUpdateSerializer,
    StudentSerializer,
    StudentCreateSerializer,
    StudentUpdateSerializer,
    TemplateSerializer,
    TemplateCreateMetaSerializer,
    TemplateUpdateMetaSerializer,
    CampaignSerializer,
    CampaignDetailSerializer,
    CampaignCreateSerializer,
    MessageLogSerializer,
    TestMessageSerializer,
    ChatMessageSerializer,
    SendConversationMessageSerializer,
    ComplaintFeedbackSerializer,
    BotUserProfileSerializer,
)
from .services.whatsapp_service import whatsapp_service
from .services.campaign_service import campaign_service
from .services.bot_service import handle_inbound_message  # WhatsApp chatbot
from .utils.logger import logger
from .utils.phone import sanitize_phone_number, validate_phone_number
from .utils.template_infer import infer_template_variable_mappings


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

        page = request.query_params.get("page")
        page_size = request.query_params.get("page_size")

        if page is not None and str(page).strip() != "":
            try:
                page_num = max(1, int(page))
            except (ValueError, TypeError):
                page_num = 1
            try:
                p_size = max(1, min(200, int(page_size))) if page_size else 10
            except (ValueError, TypeError):
                p_size = 10

            total_count = qs.count()
            total_pages = max(1, math.ceil(total_count / p_size)) if total_count > 0 else 1
            offset = (page_num - 1) * p_size
            paginated_qs = qs[offset : offset + p_size]
            serializer = StudentSerializer(paginated_qs, many=True)
            return Response({
                "count": total_count,
                "total_pages": total_pages,
                "current_page": page_num,
                "page_size": p_size,
                "results": serializer.data,
            })

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

        # fee_absent_action options:
        # 1. 'keep' (Default / Safe Mode): Students not in this sheet retain their existing fees.
        # 2. 'clear_imported_classes': Any student in the imported/touched classes who is NOT in this sheet has fees set to ₹0.00 (Paid / Cleared).
        # 3. 'clear_all_school': Any student in the ENTIRE school who is NOT in this sheet has fees set to ₹0.00 (School-wide defaulter sync).
        raw_action = request.data.get("fee_absent_action")
        if raw_action:
            fee_absent_action = str(raw_action).strip().lower()
        else:
            legacy_sync = str(request.data.get("reset_absent_fees", request.data.get("sync_fees_mode", "false"))).lower() in ("true", "1", "yes")
            fee_absent_action = "clear_imported_classes" if legacy_sync else "keep"

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

        # 1. Student Name (exclude parent/guardian/class)
        name_candidates = [
            c for c in df.columns
            if any(k in c for k in ["student", "name", "candidate"])
            and not any(ex in c for ex in ["parent", "father", "mother", "guardian", "class", "school"])
        ]
        if name_candidates:
            name_candidates.sort(key=lambda c: 0 if ("student" in c or c == "name") else 1)
            name_col = name_candidates[0]
        else:
            name_col = next((c for c in df.columns if "student" in c or "name" in c), None)

        # 2. Phone / WhatsApp (exclude roll, admission, sr, id)
        phone_candidates = [
            c for c in df.columns
            if any(k in c for k in ["phone", "whatsapp", "mobile", "contact", "cell", "number"])
            and not any(ex in c for ex in ["roll", "admission", "adm", "sr", "serial", "reg", "id", "index"])
        ]
        if phone_candidates:
            phone_candidates.sort(key=lambda c: 0 if any(k in c for k in ["whatsapp", "mobile", "phone"]) else 1)
            phone_col = phone_candidates[0]
        else:
            phone_col = next((c for c in df.columns if any(k in c for k in ["phone", "whatsapp", "mobile", "contact", "number"])), None)

        # 3. Parent / Guardian Name
        parent_col = next((c for c in df.columns if any(k in c for k in ["parent", "father", "mother", "guardian"])), None)

        # 4. Class & Section
        class_col = next((c for c in df.columns if any(k in c for k in ["class", "grade", "standard"])), None)
        section_col = next((c for c in df.columns if any(k in c for k in ["section", "sec"])), None)

        # 5. Fees Due column (prioritize explicit fee/due/balance/pending terms, exclude date/time)
        fee_candidates = [
            c for c in df.columns
            if any(k in c for k in ["fee", "dues", "amount", "due", "pending", "balance", "outstanding", "payable"])
            and not any(ex in c for ex in ["date", "time", "day", "month", "status", "mode", "receipt"])
        ]
        if fee_candidates:
            fee_candidates.sort(key=lambda c: 0 if ("fee" in c or "due" in c or "pending" in c or "balance" in c) else 1)
            fees_col = fee_candidates[0]
        else:
            fees_col = None

        if not name_col or not phone_col:
            return Response(
                {"detail": "Spreadsheet must contain columns for Student Name and WhatsApp Phone Number."},
                status=status.HTTP_400_BAD_REQUEST
            )

        created_count = 0
        updated_count = 0
        fees_updated_count = 0
        skipped_count = 0
        classes_created = 0
        classes_cache = {}
        touched_class_ids = set()
        imported_student_ids = set()
        students_to_create = []

        has_explicit_class_in_sheet = bool(class_col)

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

            # Parse Fees Due if fee column exists
            fees_val = 0.00
            fee_is_specified = False
            if fees_col:
                raw_cell = str(row.get(fees_col, "")).strip()
                raw_lower = raw_cell.lower()
                if raw_cell and raw_lower not in ("nan", "none", "null", ""):
                    if any(t in raw_lower for t in ["paid", "nil", "clear", "cleared", "no due", "none", "zero"]):
                        fees_val = 0.00
                        fee_is_specified = True
                    else:
                        clean_str = raw_cell.replace("₹", "").replace("$", "").replace(",", "").strip()
                        try:
                            fees_val = max(0.00, float(clean_str))
                            fee_is_specified = True
                        except ValueError:
                            fee_is_specified = False

            # Resolve Class from sheet if provided
            target_class = None
            if class_col and str(row.get(class_col, "")).strip() and str(row.get(class_col, "")).strip().lower() != "nan":
                raw_class_name = str(row.get(class_col, "")).strip()
                sec_val = str(row.get(section_col, "")).strip() if section_col and str(row.get(section_col, "")).strip().lower() != "nan" else None

                cache_key = f"{raw_class_name.lower()}_{sec_val.lower() if sec_val else ''}"
                if cache_key in classes_cache:
                    target_class = classes_cache[cache_key]
                else:
                    if sec_val:
                        target_class = Class.objects.filter(name__iexact=raw_class_name, section__iexact=sec_val).first()
                    if not target_class:
                        target_class = Class.objects.filter(name__iexact=raw_class_name).first()
                    if not target_class:
                        target_class = Class.objects.create(name=raw_class_name, section=sec_val)
                        classes_created += 1
                        logger.info(f"[Import] Auto-created new class '{raw_class_name}' from spreadsheet.")
                    classes_cache[cache_key] = target_class

            elif default_class:
                target_class = default_class

            # Student matching: Check phone variants across Indian/global number lengths
            phone_10 = cleaned_phone[-10:] if len(cleaned_phone) >= 10 else cleaned_phone
            phone_91 = f"91{phone_10}" if len(phone_10) == 10 else cleaned_phone
            phone_variants = list({cleaned_phone, phone_10, phone_91, f"+{phone_91}"})

            matching_students = list(Student.objects.filter(whatsapp_number__in=phone_variants))

            existing_student = None
            norm_name = name_val.strip().lower() if name_val else ""

            if matching_students:
                # 1. Match if BOTH target_class (if known) and student_name match
                if target_class and norm_name:
                    existing_student = next(
                        (s for s in matching_students if s.school_class_id == target_class.id and s.student_name.strip().lower() == norm_name),
                        None
                    )

                # 2. Match by exact student name among students with this phone number
                if not existing_student and norm_name:
                    existing_student = next(
                        (s for s in matching_students if s.student_name.strip().lower() == norm_name),
                        None
                    )

                # 3. Match by partial/contained name (e.g., "Rahul" vs "Rahul Sharma")
                if not existing_student and norm_name:
                    existing_student = next(
                        (s for s in matching_students if norm_name in s.student_name.strip().lower() or s.student_name.strip().lower() in norm_name),
                        None
                    )

                # 4. Match by class if name is not specified in sheet row
                if not existing_student and not norm_name and target_class:
                    existing_student = next((s for s in matching_students if s.school_class_id == target_class.id), None)

                # 5. If only 1 student has this phone AND sheet row has NO name, match them
                if not existing_student and not norm_name and len(matching_students) == 1:
                    existing_student = matching_students[0]

            # 6. Fallback: match by student name + target_class if target_class known (e.g. phone updated)
            if not existing_student and target_class and norm_name:
                existing_student = Student.objects.filter(
                    school_class=target_class,
                    student_name__iexact=name_val.strip()
                ).first()

            if existing_student:
                imported_student_ids.add(existing_student.id)
                touched_class_ids.add(existing_student.school_class_id)
                changed = False

                if existing_student.student_name != name_val:
                    existing_student.student_name = name_val
                    changed = True

                if parent_val and parent_val.lower() != "nan" and existing_student.parent_name != parent_val:
                    existing_student.parent_name = parent_val
                    changed = True

                if existing_student.whatsapp_number != cleaned_phone:
                    existing_student.whatsapp_number = cleaned_phone
                    changed = True

                # Fees update logic:
                if fee_is_specified:
                    old_fees = float(existing_student.fees_due or 0.0)
                    new_fees = round(fees_val, 2)
                    if round(old_fees, 2) != new_fees:
                        existing_student.fees_due = new_fees
                        fees_updated_count += 1
                        changed = True

                # Class update: Only if explicit class provided in sheet or default_class selected
                if target_class and (has_explicit_class_in_sheet or default_class):
                    if existing_student.school_class_id != target_class.id:
                        existing_student.school_class = target_class
                        changed = True
                        touched_class_ids.add(target_class.id)

                if changed:
                    existing_student.save()
                    updated_count += 1
                else:
                    skipped_count += 1

            else:
                # Student does not exist in DB -> create new
                if not target_class:
                    if default_class:
                        target_class = default_class
                    else:
                        target_class, created_flag = Class.objects.get_or_create(name="General", defaults={"section": "A"})
                        if created_flag:
                            classes_created += 1

                touched_class_ids.add(target_class.id)
                students_to_create.append(
                    Student(
                        school_class=target_class,
                        student_name=name_val,
                        parent_name=parent_val if parent_val and parent_val.lower() != "nan" else None,
                        whatsapp_number=cleaned_phone,
                        fees_due=fees_val if fee_is_specified else 0.00,
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

        # Handle Absent Students' Fees according to selected action
        reset_count = 0
        if fees_col:
            if fee_absent_action == "clear_imported_classes" and touched_class_ids:
                reset_count = Student.objects.filter(
                    school_class_id__in=touched_class_ids
                ).exclude(
                    id__in=imported_student_ids
                ).filter(
                    fees_due__gt=0
                ).update(fees_due=0.00)
                logger.info(f"[Import] Cleared dues to ₹0 for {reset_count} absent students in touched classes {touched_class_ids}.")

            elif fee_absent_action == "clear_all_school":
                reset_count = Student.objects.exclude(
                    id__in=imported_student_ids
                ).filter(
                    fees_due__gt=0
                ).update(fees_due=0.00)
                logger.info(f"[Import] Cleared dues to ₹0 for {reset_count} absent students school-wide.")

        msg_parts = [f"Import complete: {created_count} added, {updated_count} updated."]
        if fees_updated_count > 0:
            msg_parts.append(f"{fees_updated_count} student fee dues updated.")
        if reset_count > 0:
            msg_parts.append(f"{reset_count} absent students marked as cleared (₹0).")
        elif fees_col and fee_absent_action == "keep":
            msg_parts.append("Existing dues retained for students not in sheet.")
        if skipped_count > 0:
            msg_parts.append(f"({skipped_count} unchanged).")
        if classes_created > 0:
            msg_parts.append(f"Auto-created {classes_created} new class(es).")

        return Response({
            "message": " ".join(msg_parts),
            "imported_count": created_count,
            "updated_count": updated_count,
            "fees_updated_count": fees_updated_count,
            "reset_count": reset_count,
            "skipped_count": skipped_count,
            "classes_created_count": classes_created,
            "fee_absent_action": fee_absent_action,
        })


class TemplateListCreateView(APIView):
    def get(self, request):
        include_archived = request.query_params.get("include_archived", "false").lower() in ("true", "1")
        qs = MessageTemplate.objects.all().order_by("name")
        if not include_archived:
            qs = qs.exclude(status__in=["PENDING_DELETION", "ARCHIVED", "DELETED"]).exclude(name__iexact="hello_world")
        templates = list(qs)
        sync_requested = request.query_params.get("sync", "false").lower() in ("true", "1")
        if (not templates and not MessageTemplate.objects.exists()) or sync_requested:
            try:
                meta_templates = asyncio.run(whatsapp_service.fetch_templates_from_meta())
                for item in meta_templates:
                    name = item["name"]
                    existing = MessageTemplate.objects.filter(name=name).first()
                    var_map = existing.variable_mappings if existing and existing.variable_mappings else {}
                    if not var_map:
                        var_map = infer_template_variable_mappings(
                            body_text=item.get("body_preview", ""),
                            template_name=name,
                            category=item.get("category", "")
                        )

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
                            "variable_mappings": var_map,
                        }
                    )
                qs = MessageTemplate.objects.all().order_by("name")
                if not include_archived:
                    qs = qs.exclude(status__in=["PENDING_DELETION", "ARCHIVED", "DELETED"]).exclude(name__iexact="hello_world")
                templates = list(qs)
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

        var_mappings = data.get("variable_mappings", {})
        if not var_mappings:
            var_mappings = infer_template_variable_mappings(
                body_text=meta_result.get("body_preview", data["body_text"]),
                template_name=meta_result["name"],
                category=meta_result["category"]
            )

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
            variable_mappings=var_mappings,
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
            if not var_map:
                var_map = infer_template_variable_mappings(
                    body_text=item.get("body_preview", ""),
                    template_name=item["name"],
                    category=item.get("category", "")
                )

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

        all_templates = MessageTemplate.objects.exclude(
            status__in=["PENDING_DELETION", "ARCHIVED", "DELETED"]
        ).exclude(name__iexact="hello_world").order_by("name")
        return Response(TemplateSerializer(all_templates, many=True).data)


class TemplateDetailView(APIView):
    def patch(self, request, pk):
        try:
            template = MessageTemplate.objects.get(pk=pk)
        except MessageTemplate.DoesNotExist:
            return Response({"detail": "Template not found"}, status=status.HTTP_404_NOT_FOUND)

        # Check if request has Meta component updates (body_text, header_type, header_text, sample_image_url, category, sample_values)
        meta_keys = {"body_text", "header_type", "header_text", "sample_image_url", "category", "sample_values"}
        has_meta_changes = bool(meta_keys.intersection(request.data.keys()))

        if has_meta_changes:
            serializer = TemplateUpdateMetaSerializer(data=request.data, partial=True)
            serializer.is_valid(raise_exception=True)
            data = serializer.validated_data

            body_text = data.get("body_text", template.body_preview or "")
            category = data.get("category", template.category)
            header_type = data.get("header_type", template.header_type or "NONE")
            header_text = data.get("header_text", template.header_text)
            sample_image_url = data.get("sample_image_url", template.sample_image_url)
            sample_values = data.get("sample_values", [])

            try:
                meta_result = asyncio.run(
                    whatsapp_service.edit_template_on_meta(
                        template_name=template.name,
                        body_text=body_text,
                        category=category,
                        header_type=header_type,
                        header_text=header_text,
                        sample_image_url=sample_image_url,
                        sample_values=sample_values,
                    )
                )
            except ValueError as val_err:
                return Response({"detail": str(val_err)}, status=status.HTTP_400_BAD_REQUEST)
            except Exception as ex:
                return Response(
                    {"detail": f"Failed to update template on Meta: {str(ex)}"},
                    status=status.HTTP_502_BAD_GATEWAY
                )

            template.body_preview = meta_result.get("body_preview", body_text)
            template.header_type = meta_result.get("header_type", header_type)
            template.header_text = meta_result.get("header_text", header_text)
            template.sample_image_url = meta_result.get("sample_image_url", sample_image_url)
            if meta_result.get("category"):
                template.category = meta_result["category"]
            template.status = meta_result.get("status", "PENDING")

        # Local variable mappings or description updates
        if "variable_mappings" in request.data:
            template.variable_mappings = request.data["variable_mappings"]
        if "description" in request.data:
            template.description = request.data["description"]

        template.save()
        return Response(TemplateSerializer(template).data)

    def put(self, request, pk):
        return self.patch(request, pk)

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
        search = request.query_params.get("search")
        page = request.query_params.get("page")
        page_size = request.query_params.get("page_size")

        qs = (
            MessageCampaign.objects.select_related("school_class", "template")
            .prefetch_related("message_logs")
            .order_by("-created_at")
        )

        if search and search.strip():
            s = search.strip()
            search_q = (
                Q(template__name__icontains=s)
                | Q(school_class__name__icontains=s)
                | Q(status__icontains=s)
            )
            if s.isdigit():
                search_q |= Q(id=int(s))
            qs = qs.filter(search_q)

        is_paginated = page is not None and str(page).strip() != ""
        if is_paginated:
            try:
                page_num = max(1, int(page))
            except (ValueError, TypeError):
                page_num = 1
            try:
                p_size = max(1, min(200, int(page_size))) if page_size else 10
            except (ValueError, TypeError):
                p_size = 10

            total_count = qs.count()
            total_pages = max(1, math.ceil(total_count / p_size)) if total_count > 0 else 1
            offset = (page_num - 1) * p_size
            campaigns = list(qs[offset : offset + p_size])
        else:
            campaigns = list(qs)

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
        if is_paginated:
            return Response({
                "count": total_count,
                "total_pages": total_pages,
                "current_page": page_num,
                "page_size": p_size,
                "results": serializer.data,
            })
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

    def delete(self, request, pk):
        try:
            campaign = MessageCampaign.objects.get(pk=pk)
        except MessageCampaign.DoesNotExist:
            return Response({"detail": "Campaign not found"}, status=status.HTTP_404_NOT_FOUND)

        campaign.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class CampaignBulkDeleteView(APIView):
    def post(self, request):
        ids = request.data.get("ids", [])
        from_date = request.data.get("from_date")
        to_date = request.data.get("to_date")
        before_date = request.data.get("before_date")

        qs = MessageCampaign.objects.all()
        matched = False

        if ids and isinstance(ids, list) and len(ids) > 0:
            qs = qs.filter(id__in=ids)
            matched = True

        if from_date:
            parsed_from = parse_date(str(from_date).strip())
            if parsed_from:
                qs = qs.filter(created_at__date__gte=parsed_from)
                matched = True

        if to_date:
            parsed_to = parse_date(str(to_date).strip())
            if parsed_to:
                qs = qs.filter(created_at__date__lte=parsed_to)
                matched = True

        if before_date:
            parsed_before = parse_date(str(before_date).strip())
            if parsed_before:
                qs = qs.filter(created_at__date__lt=parsed_before)
                matched = True

        if not matched:
            return Response(
                {"detail": "Please provide campaign 'ids', a date range ('from_date' and 'to_date'), or 'before_date'."},
                status=status.HTTP_400_BAD_REQUEST
            )

        count = qs.count()
        qs.delete()
        return Response({"deleted_count": count, "message": f"Successfully deleted {count} campaign(s)."}, status=status.HTTP_200_OK)


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
        search = request.query_params.get("search")
        date_param = request.query_params.get("date")
        from_date = request.query_params.get("from_date")
        to_date = request.query_params.get("to_date")
        before_date = request.query_params.get("before_date")
        response_date = request.query_params.get("response_date")
        page = request.query_params.get("page")
        page_size = request.query_params.get("page_size")

        qs = MessageLog.objects.select_related("student__school_class", "campaign__school_class").order_by("-created_at")

        # Identify inbound chat criteria for responses
        inbound_phones = list(
            ChatMessage.objects.filter(direction="INBOUND")
            .exclude(phone_number__isnull=True)
            .exclude(phone_number="")
            .values_list("phone_number", flat=True)
            .distinct()
        )
        inbound_student_ids = list(
            ChatMessage.objects.filter(direction="INBOUND", student_id__isnull=False)
            .values_list("student_id", flat=True)
            .distinct()
        )
        resp_q = Q()
        if inbound_student_ids:
            resp_q |= Q(student_id__in=inbound_student_ids)
        phone_tails = {p[-10:] for p in inbound_phones if len(p) >= 10}
        for tail in phone_tails:
            resp_q |= Q(recipient_number__endswith=tail)

        unread_only = request.query_params.get("unread_only", "").lower() in ("true", "1")

        if campaign_id and str(campaign_id).strip().upper() not in ("ALL", "", "NONE"):
            qs = qs.filter(campaign_id=campaign_id)
        if student_id:
            qs = qs.filter(student_id=student_id)
        if status_filter and str(status_filter).strip().upper() not in ("ALL", "", "NONE", "RESPONSES", "RESPONDED"):
            qs = qs.filter(status__iexact=str(status_filter).strip())
        elif status_filter and str(status_filter).strip().upper() in ("RESPONSES", "RESPONDED"):
            if resp_q:
                qs = qs.filter(resp_q)
            else:
                qs = qs.none()

        if unread_only:
            unread_msgs = ChatMessage.objects.filter(direction="INBOUND", status__in=["RECEIVED", "UNREAD"])
            unread_phones = list(unread_msgs.exclude(phone_number__isnull=True).exclude(phone_number="").values_list("phone_number", flat=True).distinct())
            unread_student_ids = list(unread_msgs.filter(student_id__isnull=False).values_list("student_id", flat=True).distinct())
            unread_q = Q()
            if unread_student_ids:
                unread_q |= Q(student_id__in=unread_student_ids)
            for tail in {p[-10:] for p in unread_phones if len(p) >= 10}:
                unread_q |= Q(recipient_number__endswith=tail)
            if unread_q:
                qs = qs.filter(unread_q)
            else:
                qs = qs.none()

        if search and search.strip():
            s = search.strip()
            search_q = (
                Q(student_name__icontains=s)
                | Q(recipient_number__icontains=s)
                | Q(template_name__icontains=s)
                | Q(whatsapp_message_id__icontains=s)
                | Q(student__student_name__icontains=s)
                | Q(student__parent_name__icontains=s)
                | Q(class_name__icontains=s)
            )
            if s.isdigit():
                search_q |= Q(id=int(s)) | Q(campaign_id=int(s))
            qs = qs.filter(search_q)

        # Exact date filter (applied to sent_at or created_at)
        if date_param and str(date_param).strip():
            parsed_d = parse_date(str(date_param).strip())
            if parsed_d:
                if status_filter and str(status_filter).strip().upper() in ("RESPONSES", "RESPONDED"):
                    pass # Handled below
                else:
                    qs = qs.filter(Q(sent_at__date=parsed_d) | (Q(sent_at__isnull=True) & Q(created_at__date=parsed_d)))

        if from_date:
            parsed_from = parse_date(str(from_date).strip())
            if parsed_from:
                qs = qs.filter(created_at__date__gte=parsed_from)
        if to_date:
            parsed_to = parse_date(str(to_date).strip())
            if parsed_to:
                qs = qs.filter(created_at__date__lte=parsed_to)
        if before_date:
            parsed_before = parse_date(str(before_date).strip())
            if parsed_before:
                qs = qs.filter(created_at__date__lt=parsed_before)

        is_paginated = page is not None and str(page).strip() != ""
        if is_paginated:
            try:
                page_num = max(1, int(page))
            except (ValueError, TypeError):
                page_num = 1
            try:
                p_size = max(1, min(200, int(page_size))) if page_size else 10
            except (ValueError, TypeError):
                p_size = 10

            total_count = qs.count()
            total_pages = max(1, math.ceil(total_count / p_size)) if total_count > 0 else 1
            offset = (page_num - 1) * p_size
            logs = list(qs[offset : offset + p_size])
        else:
            limit = int(request.query_params.get("limit", 2000))
            offset = int(request.query_params.get("offset", 0))
            logs = list(qs[offset : offset + limit])

        # Optimize: Batch query inbound ChatMessages for these logs
        student_ids = {l.student_id for l in logs if l.student_id}
        phone_tails = set()
        clean_phones = set()
        for l in logs:
            if l.recipient_number:
                p = sanitize_phone_number(l.recipient_number)
                clean_phones.add(p)
                if len(p) >= 10:
                    phone_tails.add(p[-10:])

        inbound_q = Q()
        if student_ids:
            inbound_q |= Q(student_id__in=student_ids)
        if clean_phones:
            inbound_q |= Q(phone_number__in=clean_phones)
        for tail in phone_tails:
            inbound_q |= Q(phone_number__endswith=tail)

        inbound_by_student = {}
        inbound_by_phone = {}
        if inbound_q:
            inbound_msgs = (
                ChatMessage.objects.filter(direction="INBOUND")
                .filter(inbound_q)
                .order_by("-created_at")
            )
            for m in inbound_msgs:
                if m.student_id:
                    inbound_by_student.setdefault(m.student_id, []).append(m)
                if m.phone_number:
                    cp = sanitize_phone_number(m.phone_number)
                    inbound_by_phone.setdefault(cp, []).append(m)
                    if len(cp) >= 10:
                        inbound_by_phone.setdefault(cp[-10:], []).append(m)

        for l in logs:
            cp = sanitize_phone_number(l.recipient_number) if l.recipient_number else ""
            matched = (
                inbound_by_student.get(l.student_id)
                or inbound_by_phone.get(cp)
                or (inbound_by_phone.get(cp[-10:]) if len(cp) >= 10 else None)
                or []
            )
            l.has_response = len(matched) > 0
            l.response_count = len(matched)
            l.unread_count = sum(1 for m in matched if (m.status or "").upper() in ("RECEIVED", "UNREAD"))
            l.latest_response_at = matched[0].created_at if matched else None
            l.latest_response_text = (matched[0].text_content or f"[{matched[0].message_type}]") if matched else None

        if response_date and str(response_date).strip():
            parsed_resp_date = parse_date(str(response_date).strip())
            if parsed_resp_date:
                logs = [l for l in logs if l.latest_response_at and l.latest_response_at.date() == parsed_resp_date]

        serializer_data = MessageLogSerializer(logs, many=True).data
        if is_paginated:
            base_count_qs = MessageLog.objects.all()
            if campaign_id and str(campaign_id).strip().upper() not in ("ALL", "", "NONE"):
                base_count_qs = base_count_qs.filter(campaign_id=campaign_id)
            if student_id:
                base_count_qs = base_count_qs.filter(student_id=student_id)
            if search and search.strip():
                base_count_qs = base_count_qs.filter(search_q)
            if date_param and str(date_param).strip():
                parsed_d = parse_date(str(date_param).strip())
                if parsed_d:
                    base_count_qs = base_count_qs.filter(Q(sent_at__date=parsed_d) | (Q(sent_at__isnull=True) & Q(created_at__date=parsed_d)))

            st_map = {row["status"].upper(): row["count"] for row in base_count_qs.values("status").annotate(count=Count("id")) if row.get("status")}
            total_items = sum(st_map.values())

            # Accurate response metrics for cards and badges
            responses_count = base_count_qs.filter(resp_q).count() if (inbound_student_ids or phone_tails) else 0

            unread_msgs = ChatMessage.objects.filter(direction="INBOUND", status__in=["RECEIVED", "UNREAD"])
            unread_phones = list(unread_msgs.exclude(phone_number__isnull=True).exclude(phone_number="").values_list("phone_number", flat=True).distinct())
            unread_student_ids = list(unread_msgs.filter(student_id__isnull=False).values_list("student_id", flat=True).distinct())
            unread_q = Q()
            if unread_student_ids:
                unread_q |= Q(student_id__in=unread_student_ids)
            for tail in {p[-10:] for p in unread_phones if len(p) >= 10}:
                unread_q |= Q(recipient_number__endswith=tail)

            if unread_q:
                matching_unread_logs = base_count_qs.filter(unread_q)
                unread_chats_count = matching_unread_logs.count()
                if unread_chats_count > 0:
                    matched_student_ids = set(matching_unread_logs.exclude(student_id__isnull=True).values_list("student_id", flat=True))
                    matched_phones = set(matching_unread_logs.exclude(recipient_number__isnull=True).exclude(recipient_number="").values_list("recipient_number", flat=True))
                    matched_tails = {p[-10:] for p in matched_phones if len(p) >= 10}

                    scoped_unread_q = Q()
                    if matched_student_ids:
                        scoped_unread_q |= Q(student_id__in=matched_student_ids)
                    for tail in matched_tails:
                        scoped_unread_q |= Q(phone_number__endswith=tail)

                    unread_responses_count = unread_msgs.filter(scoped_unread_q).count() if scoped_unread_q else 0
                else:
                    unread_responses_count = 0
            else:
                unread_chats_count = 0
                unread_responses_count = 0

            summary_counts = {
                "total": total_items,
                "sent": st_map.get("SENT", 0),
                "delivered": st_map.get("DELIVERED", 0),
                "read": st_map.get("READ", 0),
                "failed": st_map.get("FAILED", 0),
                "queued": st_map.get("QUEUED", 0),
                "responses": responses_count,
                "unread_responses": unread_responses_count,
                "unread_chats": unread_chats_count,
            }

            return Response({
                "count": total_count,
                "total_pages": total_pages,
                "current_page": page_num,
                "page_size": p_size,
                "results": serializer_data,
                "counts": summary_counts,
            })

        return Response(serializer_data)


class MessageLogDetailView(APIView):
    def get(self, request, pk):
        try:
            log = MessageLog.objects.select_related("student").get(pk=pk)
        except MessageLog.DoesNotExist:
            return Response({"detail": "Message log not found"}, status=status.HTTP_404_NOT_FOUND)
        return Response(MessageLogSerializer(log).data)

    def delete(self, request, pk):
        try:
            log = MessageLog.objects.get(pk=pk)
        except MessageLog.DoesNotExist:
            return Response({"detail": "Message log not found"}, status=status.HTTP_404_NOT_FOUND)

        log.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class MessageLogBulkDeleteView(APIView):
    def post(self, request):
        ids = request.data.get("ids", [])
        from_date = request.data.get("from_date")
        to_date = request.data.get("to_date")
        before_date = request.data.get("before_date")
        campaign_id = request.data.get("campaign_id")
        status_filter = request.data.get("status")

        qs = MessageLog.objects.all()
        matched = False

        if ids and isinstance(ids, list) and len(ids) > 0:
            qs = qs.filter(id__in=ids)
            matched = True

        if from_date:
            parsed_from = parse_date(str(from_date).strip())
            if parsed_from:
                qs = qs.filter(created_at__date__gte=parsed_from)
                matched = True

        if to_date:
            parsed_to = parse_date(str(to_date).strip())
            if parsed_to:
                qs = qs.filter(created_at__date__lte=parsed_to)
                matched = True

        if before_date:
            parsed_before = parse_date(str(before_date).strip())
            if parsed_before:
                qs = qs.filter(created_at__date__lt=parsed_before)
                matched = True

        if campaign_id:
            qs = qs.filter(campaign_id=campaign_id)
            matched = True

        if status_filter and status_filter.upper() != "ALL":
            qs = qs.filter(status=status_filter.upper())
            matched = True

        if not matched:
            return Response(
                {"detail": "Please provide message log 'ids', date filters ('from_date', 'to_date', 'before_date'), or 'campaign_id'."},
                status=status.HTTP_400_BAD_REQUEST
            )

        count = qs.count()
        qs.delete()
        return Response({"deleted_count": count, "message": f"Successfully deleted {count} message log(s)."}, status=status.HTTP_200_OK)


class MessageLogExportView(APIView):
    """
    Exports message delivery audit logs to a professionally styled Excel spreadsheet (.xlsx).
    Supports granular filtering:
    - Status: ALL, SENT, DELIVERED, READ, DELIVERED_AND_READ, RESPONSES, FAILED
    - Date: exact date YYYY-MM-DD or date range
    - Campaign ID: single campaign or all campaigns
    - Selected log IDs: comma-separated list or array
    - Search query: matches student, phone, template, or wamid
    Includes student name, student's class with section, dispatch timestamp,
    delivered & read timestamps, and parent responses in all cases.
    """
    def get(self, request):
        return self._handle_export(request, request.query_params)

    def post(self, request):
        params = request.data if isinstance(request.data, dict) else request.query_params
        return self._handle_export(request, params)

    def _handle_export(self, request, params):
        campaign_id = params.get("campaign_id")
        status_filter = str(params.get("status", "ALL")).strip()
        date_param = params.get("date")
        from_date = params.get("from_date")
        to_date = params.get("to_date")
        search_query = params.get("search", "")
        ids_param = params.get("ids")

        qs = MessageLog.objects.select_related("student__school_class", "campaign__school_class").order_by("-created_at")

        # Specific IDs (if user selected checkboxes on UI)
        if ids_param:
            if isinstance(ids_param, str):
                id_list = [int(x.strip()) for x in ids_param.split(",") if x.strip().isdigit()]
            elif isinstance(ids_param, list):
                id_list = [int(x) for x in ids_param if str(x).isdigit()]
            else:
                id_list = []
            if id_list:
                qs = qs.filter(id__in=id_list)

        # Campaign filter
        if campaign_id and str(campaign_id).strip().upper() not in ("ALL", "", "NONE"):
            qs = qs.filter(campaign_id=campaign_id)

        # Status filter
        st_upper = status_filter.upper()
        if st_upper in ("DELIVERED_AND_READ", "DELIVERED_READ", "DELIVERED,READ"):
            qs = qs.filter(status__in=["DELIVERED", "READ"])
        elif st_upper not in ("ALL", "", "NONE", "RESPONSES", "RESPONDED"):
            qs = qs.filter(status__iexact=status_filter)

        # Date filter
        if date_param and str(date_param).strip():
            parsed_d = parse_date(str(date_param).strip())
            if parsed_d:
                if st_upper not in ("RESPONSES", "RESPONDED"):
                    qs = qs.filter(Q(sent_at__date=parsed_d) | (Q(sent_at__isnull=True) & Q(created_at__date=parsed_d)))

        if from_date:
            pf = parse_date(str(from_date).strip())
            if pf:
                qs = qs.filter(created_at__date__gte=pf)
        if to_date:
            pt = parse_date(str(to_date).strip())
            if pt:
                qs = qs.filter(created_at__date__lte=pt)

        # Search query
        if search_query and str(search_query).strip():
            sq = str(search_query).strip()
            qs = qs.filter(
                Q(student__student_name__icontains=sq) |
                Q(recipient_number__icontains=sq) |
                Q(template_name__icontains=sq) |
                Q(whatsapp_message_id__icontains=sq)
            )

        logs = list(qs[:5000])

        # Attach parent responses
        student_ids = {l.student_id for l in logs if l.student_id}
        phone_tails = set()
        clean_phones = set()
        for l in logs:
            if l.recipient_number:
                p = sanitize_phone_number(l.recipient_number)
                clean_phones.add(p)
                if len(p) >= 10:
                    phone_tails.add(p[-10:])

        inbound_q = Q()
        if student_ids:
            inbound_q |= Q(student_id__in=student_ids)
        if clean_phones:
            inbound_q |= Q(phone_number__in=clean_phones)
        for tail in phone_tails:
            inbound_q |= Q(phone_number__endswith=tail)

        inbound_by_student = {}
        inbound_by_phone = {}
        if inbound_q:
            inbound_msgs = (
                ChatMessage.objects.filter(direction="INBOUND")
                .filter(inbound_q)
                .order_by("-created_at")
            )
            for m in inbound_msgs:
                if m.student_id:
                    inbound_by_student.setdefault(m.student_id, []).append(m)
                if m.phone_number:
                    cp = sanitize_phone_number(m.phone_number)
                    inbound_by_phone.setdefault(cp, []).append(m)
                    if len(cp) >= 10:
                        inbound_by_phone.setdefault(cp[-10:], []).append(m)

        for l in logs:
            cp = sanitize_phone_number(l.recipient_number) if l.recipient_number else ""
            matched = (
                inbound_by_student.get(l.student_id)
                or inbound_by_phone.get(cp)
                or (inbound_by_phone.get(cp[-10:]) if len(cp) >= 10 else None)
                or []
            )
            l.has_response = len(matched) > 0
            l.response_count = len(matched)
            l.latest_response_at = matched[0].created_at if matched else None
            l.latest_response_text = (matched[0].text_content or f"[{matched[0].message_type}]") if matched else None

        if st_upper in ("RESPONSES", "RESPONDED"):
            logs = [l for l in logs if l.has_response]
            if date_param and str(date_param).strip():
                parsed_d = parse_date(str(date_param).strip())
                if parsed_d:
                    logs = [
                        l for l in logs
                        if (l.latest_response_at and l.latest_response_at.date() == parsed_d)
                        or (l.sent_at and l.sent_at.date() == parsed_d)
                        or (l.created_at and l.created_at.date() == parsed_d)
                    ]

        # Generate styled Excel workbook using openpyxl
        wb = openpyxl.Workbook()
        ws = wb.active
        ws.title = "Delivery Audit Logs"

        headers = [
            "Log ID",
            "Campaign ID",
            "Student Name",
            "Class & Section",
            "WhatsApp Number",
            "Template Name",
            "Status",
            "Dispatched Date & Time",
            "Delivered Date & Time",
            "Read Date & Time",
            "Parent Responded",
            "Replies Count",
            "Parent Response Message",
            "Response Date & Time",
            "WhatsApp Message ID",
            "Error Message",
        ]
        ws.append(headers)

        header_font = Font(name="Calibri", size=11, bold=True, color="FFFFFF")
        header_fill = PatternFill(start_color="059669", end_color="059669", fill_type="solid")
        header_align = Alignment(horizontal="center", vertical="center", wrap_text=True)

        for col_num in range(1, len(headers) + 1):
            cell = ws.cell(row=1, column=col_num)
            cell.font = header_font
            cell.fill = header_fill
            cell.alignment = header_align
        ws.row_dimensions[1].height = 28

        thin_side = Side(border_style="thin", color="E2E8F0")
        thin_border = Border(left=thin_side, right=thin_side, top=thin_side, bottom=thin_side)
        row_align_left = Alignment(vertical="center")
        row_align_center = Alignment(horizontal="center", vertical="center")

        def format_dt(dt):
            if not dt:
                return "-"
            try:
                local_dt = timezone.localtime(dt)
                return local_dt.strftime("%d/%m/%Y %I:%M %p")
            except Exception:
                return dt.strftime("%d/%m/%Y %I:%M %p") if hasattr(dt, 'strftime') else str(dt)

        for row_idx, l in enumerate(logs, start=2):
            cls_name = None
            sec = None
            if l.student and l.student.school_class:
                cls_name = l.student.school_class.name
                sec = l.student.school_class.section
            elif l.campaign and l.campaign.school_class:
                cls_name = l.campaign.school_class.name
                sec = l.campaign.school_class.section

            if cls_name and sec:
                class_section = f"{cls_name} - {sec}"
            else:
                class_section = cls_name or sec or "-"

            disp_dt = format_dt(l.sent_at or l.created_at)
            deliv_dt = format_dt(l.delivered_at)
            read_dt = format_dt(l.read_at)
            resp_dt = format_dt(l.latest_response_at) if l.has_response else "-"
            resp_msg = l.latest_response_text if l.has_response else "-"

            row_data = [
                f"#{l.id}",
                f"#{l.campaign_id}" if l.campaign_id else "Direct",
                l.student.student_name if l.student else f"Student #{l.student_id or '-'}",
                class_section,
                l.recipient_number,
                l.template_name,
                l.status,
                disp_dt,
                deliv_dt,
                read_dt,
                "YES" if l.has_response else "NO",
                l.response_count if l.has_response else 0,
                resp_msg,
                resp_dt,
                l.whatsapp_message_id or "-",
                l.error_message or "-",
            ]
            ws.append(row_data)

            for col_num in range(1, len(row_data) + 1):
                c = ws.cell(row=row_idx, column=col_num)
                c.border = thin_border
                c.font = Font(name="Calibri", size=10)
                if col_num in (1, 2, 7, 11, 12):
                    c.alignment = row_align_center
                elif col_num in (8, 9, 10, 14):
                    c.alignment = row_align_center
                else:
                    c.alignment = row_align_left

            ws.row_dimensions[row_idx].height = 22

        # Auto-fit column widths
        for col in ws.columns:
            max_len = 0
            col_letter = get_column_letter(col[0].column)
            for cell in col:
                val = str(cell.value or "")
                if len(val) > max_len:
                    max_len = len(val)
            ws.column_dimensions[col_letter].width = min(max(max_len + 3, 12), 42)

        response = HttpResponse(
            content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        )
        safe_date = str(date_param).replace("-", "") if date_param else "All_Dates"
        safe_status = st_upper.replace(" ", "_").replace(",", "_")
        filename = f"Message_Logs_{safe_status}_{safe_date}.xlsx"
        response["Content-Disposition"] = f'attachment; filename="{filename}"'
        wb.save(response)
        return response



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
        cls = student.school_class if student else None
        log_entry = MessageLog.objects.create(
            student=student,
            student_name=student.student_name if student else None,
            class_name=cls.name if cls else None,
            section=cls.section if cls else None,
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


def humanize_meta_error(err_code=None, err_title="", err_msg="", err_details=""):
    code_str = str(err_code).strip() if err_code else ""
    friendly_map = {
        "131026": "Number not on WhatsApp (or recipient opted out)",
        "131047": "24-Hour window expired (requires approved template)",
        "131051": "Unsupported message type",
        "131052": "Media download failed",
        "131053": "Media upload failed",
        "130429": "Rate limit reached (Meta temporary speed limit)",
        "131048": "Rate limit reached (Meta temporary speed limit)",
        "80007": "Meta rate limit reached",
        "131009": "Invalid template variable or parameter value",
        "132000": "Template not found or language mismatch in Meta account",
        "132001": "Template paused or rejected by Meta",
        "132005": "Template parameter count mismatch",
        "132015": "Template parameter count mismatch",
        "133004": "WhatsApp Business account suspended or restricted",
        "133010": "Phone number not registered with WhatsApp Business",
        "131031": "Meta Business payment method issue or credit limit reached",
        "190": "Meta Access Token expired",
        "100": "Invalid parameter sent to Meta API",
        "130472": "Recipient number in restricted region",
    }
    simple_reason = friendly_map.get(code_str)
    if not simple_reason:
        low = f"{err_title} {err_msg} {err_details}".lower()
        if "undeliverable" in low or "not a whatsapp" in low:
            simple_reason = "Number not on WhatsApp (or recipient opted out)"
        elif "24 hour" in low or "re-engagement" in low:
            simple_reason = "24-Hour window expired (requires approved template)"
        elif "rate limit" in low:
            simple_reason = "Rate limit reached (Meta temporary speed limit)"
        else:
            simple_reason = err_title or err_msg or "Delivery failed"

    tech_part = f"Meta error [{code_str}]: {err_title} - {err_msg}" if code_str else f"Meta error: {err_title} - {err_msg}"
    if err_details:
        tech_part += f" ({err_details})"

    return f"{simple_reason} • {tech_part}"


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
        try:
            data = request.data
            try:
                logger.info(f"[Webhook] Raw payload received: {json.dumps(data, default=str)}")
            except Exception as log_ex:
                logger.info(f"[Webhook] Raw payload received (fallback): {data}")
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
                            datetime.fromtimestamp(int(timestamp_str), tz=dt_timezone.utc)
                            if timestamp_str and timestamp_str.isdigit()
                            else timezone.now()
                        )

                        if not message_id:
                            continue

                        log_entry = MessageLog.objects.filter(whatsapp_message_id=message_id).first()
                        recipient_info = log_entry.recipient_number if log_entry else "Unknown"

                        if new_status == "FAILED":
                            errors = status_item.get("errors", [])
                            err_str = "Delivery failed"
                            if errors:
                                first_err = errors[0]
                                err_code = first_err.get("code", "")
                                err_title = first_err.get("title", "")
                                err_msg = first_err.get("message", "")
                                err_details = first_err.get("error_data", {}).get("details", "")
                                err_str = humanize_meta_error(err_code, err_title, err_msg, err_details)
                            logger.error(
                                f"[Webhook] DELIVERY FAILED for message ID '{message_id}' (Recipient: {recipient_info}): {err_str}"
                            )
                            if log_entry:
                                log_entry.status = "FAILED"
                                log_entry.failed_at = event_time
                                log_entry.error_message = err_str
                                log_entry.save()
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
                            log_entry.save()
                        else:
                            logger.info(
                                f"[Webhook] Status update for unknown message ID '{message_id}': {new_status}"
                            )

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
                            datetime.fromtimestamp(int(timestamp_str), tz=dt_timezone.utc)
                            if timestamp_str and timestamp_str.isdigit()
                            else timezone.now()
                        )

                        if not msg_from:
                            continue

                        clean_phone = sanitize_phone_number(msg_from)
                        sender_name = contacts_map.get(msg_from) or contacts_map.get(clean_phone)

                        # ANTI-LOOP GUARD 1: Prevent bot from replying to business's own phone number
                        own_phone = getattr(settings, "WHATSAPP_PHONE_NUMBER", "") or os.getenv("WHATSAPP_PHONE_NUMBER", "")
                        if own_phone and clean_phone.endswith(own_phone.strip()[-10:]):
                            logger.info(f"[Webhook] Message originated from business's own number {clean_phone}. Skipping.")
                            continue

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
                            img_id = msg_item.get("image", {}).get("id")
                            if img_id:
                                media_url = f"/api/media/whatsapp/{img_id}"
                        elif msg_type == "document":
                            filename = msg_item.get("document", {}).get("filename", "")
                            extracted_text = f"📄 Document: {filename}" if filename else "📄 Document"
                            doc_id = msg_item.get("document", {}).get("id")
                            if doc_id:
                                media_url = f"/api/media/whatsapp/{doc_id}"
                        elif msg_type in ("audio", "voice"):
                            extracted_text = "🎵 Voice Note / Audio"
                            aud_id = msg_item.get(msg_type, {}).get("id") or msg_item.get("audio", {}).get("id") or msg_item.get("voice", {}).get("id")
                            if aud_id:
                                media_url = f"/api/media/whatsapp/{aud_id}"
                        elif msg_type == "video":
                            caption = msg_item.get("video", {}).get("caption", "")
                            extracted_text = f"🎥 Video: {caption}" if caption else "🎥 Video"
                            vid_id = msg_item.get("video", {}).get("id")
                            if vid_id:
                                media_url = f"/api/media/whatsapp/{vid_id}"
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

                        # ANTI-LOOP GUARD 2: Idempotent deduplication by wamid
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
                            if not created:
                                logger.info(f"[Webhook] Duplicate message ID '{wamid}' already processed. Skipping duplicate loop.")
                                continue
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

                        # ── Bot chatbot handler (text messages only) ──────────
                        # Only processes plain text when WHATSAPP_BOT_ENABLED is True
                        bot_enabled = getattr(settings, "WHATSAPP_BOT_ENABLED", False)
                        if bot_enabled and msg_type in ("text", "interactive", "button"):
                            try:
                                handle_inbound_message(
                                    phone=clean_phone,
                                    text=extracted_text,
                                    sender_name=sender_name or (student.student_name if student else None),
                                )
                            except Exception as bot_exc:
                                logger.error(f"[Webhook] Bot handler error for {clean_phone}: {bot_exc}")
                        elif not bot_enabled:
                            logger.info(f"[Webhook] Bot is DISABLED. Message from {clean_phone} recorded in chat, no bot reply sent.")

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
        except Exception as webhook_err:
            logger.error(f"[Webhook] Unexpected error in webhook handler: {webhook_err}", exc_info=True)
            # CRITICAL: Always return HTTP 200 OK to Meta so Meta never retries in a loop
            return Response({"status": "error_handled"}, status=200)


class ConversationListView(APIView):
    def get(self, request):
        search = (request.query_params.get("search") or "").strip().lower()
        unread_only = request.query_params.get("unread_only", "").lower() in ("true", "1")
        replies_only = request.query_params.get("replies_only", "").lower() in ("true", "1")
        class_id = request.query_params.get("class_id")

        from django.db import connection
        try:
            with connection.cursor() as cursor:
                cursor.execute("""
                    WITH ranked_messages AS (
                        SELECT 
                            cm.phone_number,
                            cm.direction,
                            cm.message_type,
                            cm.text_content,
                            cm.template_name,
                            cm.status,
                            cm.created_at,
                            ROW_NUMBER() OVER(PARTITION BY cm.phone_number ORDER BY cm.created_at DESC, cm.id DESC) as rn
                        FROM chat_messages cm
                        WHERE cm.phone_number IS NOT NULL AND cm.phone_number != ''
                    ),
                    phone_agg AS (
                        SELECT 
                            cm.phone_number,
                            COUNT(*) as total_msgs,
                            COUNT(*) FILTER (WHERE cm.direction = 'INBOUND' AND cm.status IN ('RECEIVED', 'UNREAD')) as unread_count,
                            COUNT(*) FILTER (WHERE cm.direction = 'INBOUND') as inbound_count
                        FROM chat_messages cm
                        WHERE cm.phone_number IS NOT NULL AND cm.phone_number != ''
                        GROUP BY cm.phone_number
                    ),
                    student_group AS (
                        SELECT 
                            RIGHT(st.whatsapp_number, 10) as phone_tail,
                            json_agg(json_build_object(
                                'id', st.id,
                                'student_name', st.student_name,
                                'parent_name', st.parent_name,
                                'fees_due', st.fees_due,
                                'class_id', st.class_id,
                                'class_name', CONCAT(cl.name, CASE WHEN cl.section IS NOT NULL AND cl.section != '' THEN CONCAT(' - ', cl.section) ELSE '' END)
                            )) as students_json
                        FROM students st
                        LEFT JOIN classes cl ON cl.id = st.class_id
                        WHERE st.whatsapp_number IS NOT NULL AND st.whatsapp_number != ''
                        GROUP BY RIGHT(st.whatsapp_number, 10)
                    )
                    SELECT 
                        rm.phone_number,
                        rm.direction,
                        rm.message_type,
                        rm.text_content,
                        rm.template_name,
                        rm.status,
                        rm.created_at,
                        pa.total_msgs,
                        pa.unread_count,
                        pa.inbound_count,
                        sg.students_json
                    FROM ranked_messages rm
                    JOIN phone_agg pa ON pa.phone_number = rm.phone_number
                    LEFT JOIN student_group sg ON sg.phone_tail = RIGHT(rm.phone_number, 10)
                    WHERE rm.rn = 1
                    ORDER BY rm.created_at DESC
                    LIMIT 1000
                """)
                raw_rows = cursor.fetchall()

            conversations = []
            for row in raw_rows:
                phone, direction, m_type, text, template, st_status, created_at, total_msgs, unread_cnt, inbound_cnt, students_json = row

                st_list = students_json if isinstance(students_json, list) else []
                primary_student = st_list[0] if st_list else None

                snippet = text or (f"Template: {template}" if template else f"[{m_type or 'Message'}]")
                if len(snippet) > 85:
                    snippet = snippet[:82] + "..."

                conv_item = {
                    "phone_number": phone,
                    "student_id": primary_student["id"] if primary_student else None,
                    "student_name": primary_student["student_name"] if primary_student else "WhatsApp Contact",
                    "parent_name": primary_student["parent_name"] if primary_student else "",
                    "class_name": primary_student["class_name"] if primary_student else "Direct Contact",
                    "class_id": primary_student["class_id"] if primary_student else None,
                    "fees_due": str(primary_student["fees_due"]) if (primary_student and primary_student.get("fees_due") is not None) else None,
                    "students": st_list,
                    "latest_message": snippet,
                    "latest_message_direction": direction,
                    "latest_message_time": created_at,
                    "latest_message_status": st_status,
                    "total_messages": total_msgs or 0,
                    "unread_count": unread_cnt or 0,
                    "has_inbound": (inbound_cnt or 0) > 0,
                }

                if unread_only and conv_item["unread_count"] <= 0:
                    continue
                if replies_only and not conv_item["has_inbound"]:
                    continue
                if class_id and str(conv_item.get("class_id")) != str(class_id):
                    continue
                if search:
                    match_phone = search in phone.lower()
                    match_sname = search in conv_item["student_name"].lower()
                    match_pname = search in (conv_item["parent_name"] or "").lower()
                    match_msg = search in (text or "").lower()
                    if not (match_phone or match_sname or match_pname or match_msg):
                        continue

                conversations.append(conv_item)

            total_unread = sum(1 for c in conversations if c["unread_count"] > 0)

            return Response({
                "count": len(conversations),
                "unread_conversations": total_unread,
                "conversations": conversations,
            })
        except Exception as ex:
            logger.error(f"[ConversationListView] Error: {ex}", exc_info=True)
            return Response({"count": 0, "unread_conversations": 0, "conversations": []})


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

        # Mark unread inbound messages as READ when viewed by admin (unless mark_read=false is specified)
        mark_read_param = request.query_params.get("mark_read")
        should_mark_read = mark_read_param is None or mark_read_param.lower() in ("true", "1")
        if should_mark_read:
            ChatMessage.objects.filter(filter_q, direction="INBOUND", status__in=["RECEIVED", "UNREAD"]).update(status="READ")

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

        # Attach image media_url if message template has an image header or if incoming message has media
        for m in chat_messages:
            if not m.media_url and m.template_name:
                tpl = MessageTemplate.objects.filter(name=m.template_name).first()
                if tpl and (tpl.header_type or "").upper() == "IMAGE" and tpl.sample_image_url:
                    m.media_url = tpl.sample_image_url
            if not m.media_url and m.message_log and m.message_log.campaign and m.message_log.campaign.header_image_url:
                m.media_url = m.message_log.campaign.header_image_url
            if not m.media_url and m.raw_payload:
                payload = m.raw_payload if isinstance(m.raw_payload, dict) else {}
                m_type = m.message_type or payload.get("type", "")
                media_obj = payload.get(m_type) if isinstance(payload.get(m_type), dict) else {}
                media_id = (
                    media_obj.get("id")
                    or (payload.get("image", {}).get("id") if isinstance(payload.get("image"), dict) else None)
                    or (payload.get("document", {}).get("id") if isinstance(payload.get("document"), dict) else None)
                    or (payload.get("video", {}).get("id") if isinstance(payload.get("video"), dict) else None)
                    or (payload.get("audio", {}).get("id") if isinstance(payload.get("audio"), dict) else None)
                )
                if media_id:
                    m.media_url = f"/api/media/whatsapp/{media_id}"
                    try:
                        ChatMessage.objects.filter(id=m.id).update(media_url=m.media_url)
                    except Exception:
                        pass

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

        all_students_data = []
        target_phone = phone or (student.whatsapp_number if student else "")
        if target_phone:
            clean_p = sanitize_phone_number(target_phone)
            p_filter = Q(whatsapp_number=clean_p)
            if len(clean_p) >= 10:
                p_filter |= Q(whatsapp_number__endswith=clean_p[-10:])
            all_s_qs = Student.objects.filter(p_filter).select_related("school_class").order_by("id")
            for s in all_s_qs:
                all_students_data.append({
                    "id": s.id,
                    "student_name": s.student_name,
                    "parent_name": s.parent_name,
                    "whatsapp_number": s.whatsapp_number,
                    "fees_due": str(s.fees_due),
                    "class_id": s.school_class_id,
                    "class_name": (
                        f"{s.school_class.name} - {s.school_class.section}"
                        if s.school_class and s.school_class.section
                        else (s.school_class.name if s.school_class else "General")
                    ),
                })

        first_sender_name = None
        for m in chat_messages:
            if m.sender_name:
                first_sender_name = m.sender_name
                break

        return Response({
            "student": student_data,
            "students": all_students_data,
            "phone_number": phone or (student.whatsapp_number if student else ""),
            "recipient_name": student.student_name if student else (first_sender_name or phone),
            "total_messages": len(chat_messages),
            "messages": ChatMessageSerializer(chat_messages, many=True).data,
        })


class ConversationMarkReadView(APIView):
    def post(self, request, identifier=None):
        phone = identifier
        student_id = None
        if identifier and str(identifier).isdigit() and len(str(identifier)) <= 8:
            student_id = identifier
            phone = None

        student = None
        if student_id:
            student = Student.objects.filter(id=student_id).first()
            if student:
                phone = student.whatsapp_number

        filter_q = Q()
        if student:
            filter_q |= Q(student=student)
        if phone:
            clean_p = sanitize_phone_number(phone)
            filter_q |= Q(phone_number=clean_p)
            if len(clean_p) >= 10:
                filter_q |= Q(phone_number__endswith=clean_p[-10:])

        updated_cnt = ChatMessage.objects.filter(
            filter_q, direction="INBOUND", status__in=["RECEIVED", "UNREAD"]
        ).update(status="READ")

        return Response({"status": "success", "marked_read": updated_cnt})


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
        media_url = vdata.get("media_url")
        media_type = vdata.get("media_type") or ("document" if (media_url and media_url.lower().endswith(".pdf")) else "image")
        filename = vdata.get("filename")

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
            try:
                result = async_to_sync(whatsapp_service.send_template_message)(
                    recipient_number=clean_phone,
                    template_name=template_name,
                    language_code=tpl.language if tpl else language_code,
                    parameters=parameters,
                )
            except Exception as exc:
                logger.error(f"[ConversationSendMessage] Template send exception: {exc}", exc_info=True)
                result = {"success": False, "error": str(exc)}

            wamid = result.get("message_id")
            succ = result.get("success", False)
            body_text = tpl.body_preview if tpl else f"Template: {template_name}"

            cls = student.school_class if student else None
            log_entry = MessageLog.objects.create(
                student=student,
                student_name=student.student_name if student else None,
                class_name=cls.name if cls else None,
                section=cls.section if cls else None,
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
        elif media_url:
            caption = text_message if text_message else None
            try:
                result = async_to_sync(whatsapp_service.send_media_message)(
                    recipient_number=clean_phone,
                    media_url=media_url,
                    media_type=media_type,
                    caption=caption,
                    filename=filename,
                )
            except Exception as exc:
                logger.error(f"[ConversationSendMessage] Media send exception: {exc}", exc_info=True)
                result = {"success": False, "error": str(exc)}

            wamid = result.get("message_id")
            succ = result.get("success", False)

            chat_msg = ChatMessage.objects.create(
                student=student,
                phone_number=clean_phone,
                direction="OUTBOUND",
                message_type=media_type,
                media_url=media_url,
                text_content=caption,
                status="SENT" if succ else "FAILED",
                whatsapp_message_id=wamid,
                created_at=timezone.now(),
            )
            return Response({
                "success": succ,
                "message": ChatMessageSerializer(chat_msg).data,
                "error": result.get("error"),
            })
        else:
            try:
                result = async_to_sync(whatsapp_service.send_text_message)(
                    recipient_number=clean_phone,
                    message_text=text_message,
                )
            except Exception as exc:
                logger.error(f"[ConversationSendMessage] Text send exception: {exc}", exc_info=True)
                result = {"success": False, "error": str(exc)}

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
                {"detail": "No file uploaded. Please select an image or PDF document."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        uploaded_file = request.FILES["file"]
        ext = Path(uploaded_file.name).suffix.lower()

        allowed_extensions = {".jpg", ".jpeg", ".png", ".webp", ".pdf"}
        if ext not in allowed_extensions:
            return Response(
                {"detail": f"Unsupported file type '{ext}'. Allowed types: JPG, JPEG, PNG, WEBP, PDF."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        max_size = 15 * 1024 * 1024 if ext == ".pdf" else 5 * 1024 * 1024
        if uploaded_file.size > max_size:
            limit_mb = 15 if ext == ".pdf" else 5
            return Response(
                {"detail": f"File size exceeds {limit_mb}MB limit."},
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
        file_type = "document" if ext == ".pdf" else "image"

        return Response(
            {
                "success": True,
                "filename": unique_filename,
                "original_filename": clean_original_name,
                "file_type": file_type,
                "url": file_url,
                "relative_url": relative_url,
            },
            status=status.HTTP_201_CREATED,
        )


class WhatsAppMediaProxyView(APIView):
    """
    Retrieves and serves WhatsApp incoming media attachments (images, photos, documents, videos).
    If the file has already been downloaded to disk, serves directly via FileResponse.
    Otherwise, contacts Meta's Graph API, downloads the file using the secure bot Bearer token,
    caches to settings.MEDIA_ROOT / 'incoming', and streams it to the client.
    """
    authentication_classes = []
    permission_classes = []

    def get(self, request, media_id):
        clean_id = str(media_id).strip()
        if not clean_id:
            return Response({"detail": "Media ID required."}, status=status.HTTP_400_BAD_REQUEST)

        target_dir = Path(settings.MEDIA_ROOT) / "incoming"
        target_dir.mkdir(parents=True, exist_ok=True)

        # 1. Check existing cached files on disk
        for existing in target_dir.glob(f"{clean_id}.*"):
            if existing.is_file() and existing.stat().st_size > 0:
                ext = existing.suffix.lower()
                mime_map = {
                    ".jpg": "image/jpeg",
                    ".jpeg": "image/jpeg",
                    ".png": "image/png",
                    ".webp": "image/webp",
                    ".pdf": "application/pdf",
                    ".mp4": "video/mp4",
                    ".ogg": "audio/ogg",
                    ".mp3": "audio/mpeg",
                }
                mime = mime_map.get(ext, "application/octet-stream")
                return FileResponse(open(existing, "rb"), content_type=mime)

        # 2. Download from Meta
        try:
            dl_res = async_to_sync(whatsapp_service.download_media)(clean_id)
            if dl_res and dl_res.get("file_path"):
                fp = dl_res["file_path"]
                mime = dl_res.get("mime_type", "image/jpeg")
                if os.path.isfile(fp):
                    return FileResponse(open(fp, "rb"), content_type=mime)
        except Exception as exc:
            logger.error(f"[WhatsAppMediaProxyView] Failed to download media {clean_id}: {exc}")

        return Response(
            {"detail": "Photo attachment not found or expired on WhatsApp servers."},
            status=status.HTTP_404_NOT_FOUND
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


# ─── Complaints & Feedback Views ──────────────────────────────────────────────

class ComplaintFeedbackListView(APIView):
    def get(self, request):
        queryset = ComplaintFeedback.objects.select_related("student", "student__school_class").all()

        # Filters
        submission_type = request.query_params.get("type") or request.query_params.get("submission_type")
        if submission_type:
            queryset = queryset.filter(submission_type__iexact=submission_type)

        category = request.query_params.get("category")
        if category:
            queryset = queryset.filter(category__iexact=category)

        status_param = request.query_params.get("status")
        if status_param:
            queryset = queryset.filter(status__iexact=status_param)

        class_id = request.query_params.get("class_id")
        if class_id:
            queryset = queryset.filter(
                Q(student__school_class_id=class_id) | Q(class_name__icontains=str(class_id))
            )

        search = request.query_params.get("search")
        if search:
            search_clean = search.strip()
            queryset = queryset.filter(
                Q(phone_number__icontains=search_clean)
                | Q(student_name__icontains=search_clean)
                | Q(student__student_name__icontains=search_clean)
                | Q(message__icontains=search_clean)
                | Q(class_name__icontains=search_clean)
            )

        date_from = request.query_params.get("date_from")
        if date_from:
            queryset = queryset.filter(created_at__date__gte=date_from)

        date_to = request.query_params.get("date_to")
        if date_to:
            queryset = queryset.filter(created_at__date__lte=date_to)

        # Overall summary stats (computed in a single SQL query across remote database)
        agg_counts = queryset.aggregate(
            total=Count("id"),
            complaints=Count("id", filter=Q(submission_type="COMPLAINT")),
            feedbacks=Count("id", filter=Q(submission_type="FEEDBACK")),
            pending=Count("id", filter=Q(status="PENDING")),
            resolved=Count("id", filter=Q(status="RESOLVED")),
        )
        total_count = agg_counts["total"] or 0
        complaints_count = agg_counts["complaints"] or 0
        feedbacks_count = agg_counts["feedbacks"] or 0
        pending_count = agg_counts["pending"] or 0
        resolved_count = agg_counts["resolved"] or 0

        # Pagination
        try:
            page = max(1, int(request.query_params.get("page", 1)))
        except (ValueError, TypeError):
            page = 1

        try:
            page_size = min(100, max(1, int(request.query_params.get("page_size", 10))))
        except (ValueError, TypeError):
            page_size = 10

        total_pages = max(1, (total_count + page_size - 1) // page_size) if total_count > 0 else 1
        offset = (page - 1) * page_size
        results = queryset[offset : offset + page_size]

        serializer = ComplaintFeedbackSerializer(results, many=True)

        return Response({
            "count": total_count,
            "total_pages": total_pages,
            "current_page": page,
            "page_size": page_size,
            "stats": {
                "total": total_count,
                "complaints": complaints_count,
                "feedbacks": feedbacks_count,
                "pending": pending_count,
                "resolved": resolved_count,
            },
            "results": serializer.data,
        })

    def post(self, request):
        serializer = ComplaintFeedbackSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        item = serializer.save()
        return Response(ComplaintFeedbackSerializer(item).data, status=status.HTTP_201_CREATED)


class ComplaintFeedbackDetailView(APIView):
    def get_object(self, pk):
        try:
            return ComplaintFeedback.objects.select_related("student", "student__school_class").get(pk=pk)
        except ComplaintFeedback.DoesNotExist:
            return None

    def get(self, request, pk):
        item = self.get_object(pk)
        if not item:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)
        return Response(ComplaintFeedbackSerializer(item).data)

    def patch(self, request, pk):
        item = self.get_object(pk)
        if not item:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)

        new_status = request.data.get("status")
        if new_status:
            item.status = new_status
            if new_status.upper() == "RESOLVED" and not item.resolved_at:
                item.resolved_at = timezone.now()
            elif new_status.upper() != "RESOLVED":
                item.resolved_at = None

        if "admin_reply" in request.data:
            item.admin_reply = request.data.get("admin_reply")

        if "category" in request.data:
            item.category = request.data.get("category")

        item.save()

        notify_parent = request.data.get("notify_parent", False)
        if new_status and new_status.upper() == "RESOLVED" and notify_parent and item.phone_number:
            try:
                cat_dict = dict(item.CATEGORY_CHOICES)
                category_label = cat_dict.get(item.category, item.category or "School Concern")
                sub_label = "complaint" if item.submission_type == "COMPLAINT" else "feedback"
                
                if item.admin_reply and item.admin_reply.strip():
                    notify_msg = f"Dear Parent, your {sub_label} regarding {category_label} has been addressed by school management.\n\nResolution Details: {item.admin_reply.strip()}"
                else:
                    notify_msg = f"Dear Parent, your {sub_label} regarding {category_label} has been addressed by school management."

                clean_phone = sanitize_phone_number(item.phone_number)
                res = async_to_sync(whatsapp_service.send_text_message)(
                    recipient_number=clean_phone,
                    message_text=notify_msg,
                )
                succ = res.get("success", False)
                wamid = res.get("message_id")

                ChatMessage.objects.create(
                    student=item.student,
                    phone_number=clean_phone,
                    direction="OUTBOUND",
                    message_type="text",
                    text_content=notify_msg,
                    status="SENT" if succ else "FAILED",
                    whatsapp_message_id=wamid,
                    created_at=timezone.now(),
                )
            except Exception as notify_err:
                logger.error(f"[ComplaintFeedbackDetailView] Failed to notify parent via WhatsApp: {notify_err}", exc_info=True)

        return Response(ComplaintFeedbackSerializer(item).data)

    def delete(self, request, pk):
        item = self.get_object(pk)
        if not item:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)
        item.delete()
        return Response({"success": True, "message": "Record deleted successfully."}, status=status.HTTP_200_OK)


class ComplaintFeedbackStatsView(APIView):
    def get(self, request):
        counts = ComplaintFeedback.objects.aggregate(
            total=Count("id"),
            complaints=Count("id", filter=Q(submission_type="COMPLAINT")),
            feedbacks=Count("id", filter=Q(submission_type="FEEDBACK")),
            pending=Count("id", filter=Q(status="PENDING")),
            in_review=Count("id", filter=Q(status="IN_REVIEW")),
            resolved=Count("id", filter=Q(status="RESOLVED")),
            study=Count("id", filter=Q(category="STUDY")),
            school=Count("id", filter=Q(category="SCHOOL")),
            teacher=Count("id", filter=Q(category="TEACHER")),
            other=Count("id", filter=Q(category="OTHER")),
        )
        return Response({
            "total": counts["total"] or 0,
            "complaints": counts["complaints"] or 0,
            "feedbacks": counts["feedbacks"] or 0,
            "pending": counts["pending"] or 0,
            "in_review": counts["in_review"] or 0,
            "resolved": counts["resolved"] or 0,
            "categories": {
                "study": counts["study"] or 0,
                "school": counts["school"] or 0,
                "teacher": counts["teacher"] or 0,
                "other": counts["other"] or 0,
            }
        })


class BotUserProfileListView(APIView):
    def get(self, request):
        queryset = BotUserProfile.objects.select_related("student", "student__school_class").all()
        search = request.query_params.get("search")
        if search:
            queryset = queryset.filter(
                Q(phone_number__icontains=search)
                | Q(display_name__icontains=search)
                | Q(student__student_name__icontains=search)
            )

        serializer = BotUserProfileSerializer(queryset, many=True)
        return Response(serializer.data)


class DashboardStatsView(APIView):
    def get(self, request):
        from django.db import connection
        try:
            with connection.cursor() as cursor:
                cursor.execute("""
                    SELECT 
                        (SELECT COUNT(*) FROM students),
                        (SELECT COUNT(*) FROM classes),
                        (SELECT COUNT(*) FROM message_logs WHERE status IN ('SENT', 'DELIVERED', 'READ')),
                        (SELECT COUNT(*) FROM message_logs WHERE status = 'FAILED')
                """)
                total_students, total_classes, messages_sent, messages_failed = cursor.fetchone()
        except Exception as ex:
            logger.warning(f"[Dashboard] Combined count query failed, falling back to ORM: {ex}")
            total_students = Student.objects.count()
            total_classes = Class.objects.count()
            messages_sent = MessageLog.objects.filter(status__in=["SENT", "DELIVERED", "READ"]).count()
            messages_failed = MessageLog.objects.filter(status="FAILED").count()

        recent_campaigns_qs = (
            MessageCampaign.objects.select_related("school_class", "template")
            .order_by("-created_at")[:5]
        )
        recent_campaigns_data = CampaignSerializer(recent_campaigns_qs, many=True).data

        return Response({
            "total_students": total_students or 0,
            "total_classes": total_classes or 0,
            "messages_sent": messages_sent or 0,
            "messages_failed": messages_failed or 0,
            "recent_campaigns": recent_campaigns_data,
        })

