from django.db import models
from django.utils import timezone

class Class(models.Model):
    name = models.CharField(max_length=100)
    section = models.CharField(max_length=50, null=True, blank=True)
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "classes"
        verbose_name = "Class"
        verbose_name_plural = "Classes"
        ordering = ["name"]

    def __str__(self):
        return f"{self.name} - {self.section}" if self.section else self.name


class Student(models.Model):
    school_class = models.ForeignKey(
        Class,
        on_delete=models.CASCADE,
        related_name="students",
        db_column="class_id"
    )
    student_name = models.CharField(max_length=150)
    parent_name = models.CharField(max_length=150, null=True, blank=True)
    whatsapp_number = models.CharField(max_length=20, db_index=True)
    fees_due = models.DecimalField(max_digits=10, decimal_places=2, default=0.00, help_text="Pending fees dues for student")
    whatsapp_opt_in = models.BooleanField(default=True)
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "students"
        verbose_name = "Student"
        verbose_name_plural = "Students"
        ordering = ["student_name"]

    def __str__(self):
        return f"{self.student_name} ({self.whatsapp_number})"


class MessageTemplate(models.Model):
    name = models.CharField(max_length=100, unique=True, db_index=True)
    category = models.CharField(max_length=50, default="UTILITY")
    language = models.CharField(max_length=20, default="en_US")
    description = models.CharField(max_length=255, null=True, blank=True)
    body_preview = models.TextField(null=True, blank=True)
    header_type = models.CharField(max_length=30, default="NONE", null=True, blank=True) # NONE, TEXT, IMAGE, DOCUMENT, VIDEO
    header_text = models.CharField(max_length=255, null=True, blank=True)
    sample_image_url = models.CharField(max_length=500, null=True, blank=True)
    variable_mappings = models.JSONField(default=dict, blank=True, null=True, help_text="Explicit default mappings for {{1}}, {{2}}, etc.")
    status = models.CharField(max_length=30, default="PENDING")  # ACTIVE, PENDING, REJECTED
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "message_templates"
        verbose_name = "Message Template"
        verbose_name_plural = "Message Templates"
        ordering = ["name"]

    def __str__(self):
        return f"{self.name} ({self.status})"


class MessageCampaign(models.Model):
    school_class = models.ForeignKey(
        Class,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="campaigns",
        db_column="class_id"
    )
    template = models.ForeignKey(
        MessageTemplate,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="campaigns",
        db_column="template_id"
    )
    total_recipients = models.IntegerField(default=0)
    successful_count = models.IntegerField(default=0)
    failed_count = models.IntegerField(default=0)
    skipped_count = models.IntegerField(default=0)
    header_image_url = models.CharField(max_length=500, null=True, blank=True)
    status = models.CharField(max_length=50, default="PENDING")  # PENDING, PROCESSING, COMPLETED, FAILED

    created_at = models.DateTimeField(default=timezone.now)
    started_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "message_campaigns"
        verbose_name = "Message Campaign"
        verbose_name_plural = "Message Campaigns"
        ordering = ["-created_at"]

    def __str__(self):
        return f"Campaign #{self.id} ({self.status})"


class MessageLog(models.Model):
    campaign = models.ForeignKey(
        MessageCampaign,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="message_logs",
        db_column="campaign_id"
    )
    student = models.ForeignKey(
        Student,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="message_logs",
        db_column="student_id"
    )
    recipient_number = models.CharField(max_length=20)
    template_name = models.CharField(max_length=100)
    status = models.CharField(max_length=50, default="QUEUED")  # QUEUED, SENT, DELIVERED, READ, FAILED, SKIPPED
    whatsapp_message_id = models.CharField(max_length=255, null=True, blank=True, db_index=True)
    error_message = models.TextField(null=True, blank=True)

    sent_at = models.DateTimeField(null=True, blank=True)
    delivered_at = models.DateTimeField(null=True, blank=True)
    read_at = models.DateTimeField(null=True, blank=True)
    failed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        db_table = "message_logs"
        verbose_name = "Message Log"
        verbose_name_plural = "Message Logs"
        ordering = ["-created_at"]

    def __str__(self):
        return f"Log #{self.id} -> {self.recipient_number} ({self.status})"


class ChatMessage(models.Model):
    DIRECTION_CHOICES = [
        ("INBOUND", "Inbound (User -> School)"),
        ("OUTBOUND", "Outbound (School -> User)"),
    ]

    student = models.ForeignKey(
        Student,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="chat_messages",
        db_column="student_id"
    )
    phone_number = models.CharField(max_length=20, db_index=True)
    sender_name = models.CharField(max_length=150, null=True, blank=True)
    direction = models.CharField(max_length=10, choices=DIRECTION_CHOICES, db_index=True, default="INBOUND")
    message_type = models.CharField(max_length=30, default="text")
    text_content = models.TextField(null=True, blank=True)
    media_url = models.CharField(max_length=500, null=True, blank=True)
    template_name = models.CharField(max_length=100, null=True, blank=True)
    status = models.CharField(max_length=50, default="RECEIVED")  # QUEUED, SENT, DELIVERED, READ, RECEIVED, FAILED
    whatsapp_message_id = models.CharField(max_length=255, null=True, blank=True, db_index=True)
    message_log = models.ForeignKey(
        MessageLog,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="chat_messages",
        db_column="message_log_id"
    )
    raw_payload = models.JSONField(null=True, blank=True)
    created_at = models.DateTimeField(default=timezone.now, db_index=True)

    class Meta:
        db_table = "chat_messages"
        verbose_name = "Chat Message"
        verbose_name_plural = "Chat Messages"
        ordering = ["created_at"]

    def __str__(self):
        return f"[{self.direction}] {self.phone_number}: {self.text_content or self.template_name or self.message_type}"


# ─── Bot / Chatbot Feature Models ─────────────────────────────────────────────

class BotUserProfile(models.Model):
    """
    Stores per-phone-number language preference and conversation state
    for the interactive WhatsApp chatbot.  One row per unique phone number.
    """
    LANGUAGE_CHOICES = [
        ("en", "English"),
        ("hi", "Hindi"),
    ]
    CONVERSATION_STATE_CHOICES = [
        ("INIT", "Initial greeting"),
        ("AWAIT_LANG", "Awaiting language selection"),
        ("MENU", "Main menu shown"),
        ("AWAIT_CATEGORY", "Awaiting complaint/feedback category"),
        ("AWAIT_MESSAGE", "Awaiting free-text message"),
        ("DONE", "Interaction complete"),
    ]

    phone_number = models.CharField(max_length=20, unique=True, db_index=True)
    # FK to Student — set automatically when a matching student is found or created later
    student = models.ForeignKey(
        Student,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="bot_profiles",
        db_column="student_id",
    )
    # Display name used when no student is linked yet
    display_name = models.CharField(max_length=150, default="WhatsApp User")
    language = models.CharField(max_length=5, choices=LANGUAGE_CHOICES, default="en")
    conversation_state = models.CharField(
        max_length=30, choices=CONVERSATION_STATE_CHOICES, default="INIT"
    )
    # Temporarily stores the submission type ("COMPLAINT" / "FEEDBACK") while
    # the user is picking a category or typing their message
    pending_type = models.CharField(max_length=20, null=True, blank=True)
    pending_category = models.CharField(max_length=50, null=True, blank=True)

    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "bot_user_profiles"
        verbose_name = "Bot User Profile"
        verbose_name_plural = "Bot User Profiles"

    def __str__(self):
        return f"Bot Profile: {self.phone_number} ({self.language})"


class ComplaintFeedback(models.Model):
    """
    Stores every complaint or feedback submitted through the WhatsApp chatbot.
    """
    TYPE_CHOICES = [
        ("COMPLAINT", "Complaint"),
        ("FEEDBACK", "Feedback"),
    ]
    CATEGORY_CHOICES = [
        ("STUDY", "Study Related"),
        ("SCHOOL", "School Related"),
        ("TEACHER", "Teacher Related"),
        ("OTHER", "Other"),
    ]

    phone_number = models.CharField(max_length=20, db_index=True)
    student = models.ForeignKey(
        Student,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="complaints_feedback",
        db_column="student_id",
    )
    # Denormalised snapshot — preserved even if student record changes
    student_name = models.CharField(max_length=150, blank=True, default="")
    class_name = models.CharField(max_length=150, blank=True, default="")
    language = models.CharField(max_length=5, default="en")
    submission_type = models.CharField(max_length=20, choices=TYPE_CHOICES)
    category = models.CharField(max_length=50, choices=CATEGORY_CHOICES, default="OTHER")
    message = models.TextField()
    status = models.CharField(
        max_length=20,
        default="PENDING",
        choices=[("PENDING", "Pending"), ("IN_REVIEW", "In Review"), ("RESOLVED", "Resolved")],
    )
    admin_reply = models.TextField(null=True, blank=True)
    resolved_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "complaints_feedback"
        verbose_name = "Complaint / Feedback"
        verbose_name_plural = "Complaints & Feedback"
        ordering = ["-created_at"]

    def __str__(self):
        return f"[{self.submission_type}] {self.phone_number}: {self.message[:60]}"


# ─── Signals for Auto-Sync ───────────────────────────────────────────────────
from django.db.models.signals import post_save
from django.dispatch import receiver
from .utils.phone import sanitize_phone_number

@receiver(post_save, sender=Student)
def auto_sync_student_to_bot_profiles_and_feedback(sender, instance, created, **kwargs):
    """
    When a student is added or updated, automatically link any matching
    BotUserProfile and ComplaintFeedback records to this student.
    """
    try:
        phone = instance.whatsapp_number
        if not phone:
            return
        clean_phone = sanitize_phone_number(phone)
        cls_name = ""
        if instance.school_class:
            cls = instance.school_class
            cls_name = f"{cls.name} - {cls.section}" if cls.section else cls.name

        filter_q = models.Q(phone_number=clean_phone)
        if len(clean_phone) >= 10:
            filter_q |= models.Q(phone_number__endswith=clean_phone[-10:])

        BotUserProfile.objects.filter(filter_q).update(
            student=instance,
            display_name=instance.student_name,
        )

        ComplaintFeedback.objects.filter(filter_q, student__isnull=True).update(
            student=instance,
            student_name=instance.student_name,
            class_name=cls_name,
        )
    except Exception:
        pass

