from django.contrib import admin
from .models import Class, Student, MessageTemplate, MessageCampaign, MessageLog

@admin.register(Class)
class ClassAdmin(admin.ModelAdmin):
    list_display = ("id", "name", "section", "created_at")
    search_fields = ("name", "section")

@admin.register(Student)
class StudentAdmin(admin.ModelAdmin):
    list_display = ("id", "student_name", "school_class", "whatsapp_number", "whatsapp_opt_in", "created_at")
    list_filter = ("school_class", "whatsapp_opt_in")
    search_fields = ("student_name", "parent_name", "whatsapp_number")

@admin.register(MessageTemplate)
class MessageTemplateAdmin(admin.ModelAdmin):
    list_display = ("id", "name", "category", "language", "status", "created_at")
    list_filter = ("status", "category", "language")
    search_fields = ("name", "description", "body_preview")

@admin.register(MessageCampaign)
class MessageCampaignAdmin(admin.ModelAdmin):
    list_display = ("id", "school_class", "template", "total_recipients", "successful_count", "failed_count", "status", "created_at")
    list_filter = ("status", "school_class")
    search_fields = ("school_class__name", "template__name")

@admin.register(MessageLog)
class MessageLogAdmin(admin.ModelAdmin):
    list_display = ("id", "campaign", "student", "recipient_number", "template_name", "status", "sent_at")
    list_filter = ("status", "template_name")
    search_fields = ("recipient_number", "whatsapp_message_id", "error_message")
