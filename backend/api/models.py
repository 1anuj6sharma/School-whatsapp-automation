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
