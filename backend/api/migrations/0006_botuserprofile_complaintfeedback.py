import django.db.models.deletion
import django.utils.timezone
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("api", "0005_add_variable_mappings_to_messagetemplate"),
    ]

    operations = [
        migrations.CreateModel(
            name="BotUserProfile",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name="ID",
                    ),
                ),
                ("phone_number", models.CharField(db_index=True, max_length=20, unique=True)),
                ("display_name", models.CharField(default="WhatsApp User", max_length=150)),
                (
                    "language",
                    models.CharField(
                        choices=[("en", "English"), ("hi", "Hindi")],
                        default="en",
                        max_length=5,
                    ),
                ),
                (
                    "conversation_state",
                    models.CharField(
                        choices=[
                            ("INIT", "Initial greeting"),
                            ("AWAIT_LANG", "Awaiting language selection"),
                            ("MENU", "Main menu shown"),
                            ("AWAIT_CATEGORY", "Awaiting complaint/feedback category"),
                            ("AWAIT_MESSAGE", "Awaiting free-text message"),
                            ("DONE", "Interaction complete"),
                        ],
                        default="INIT",
                        max_length=30,
                    ),
                ),
                ("pending_type", models.CharField(blank=True, max_length=20, null=True)),
                ("pending_category", models.CharField(blank=True, max_length=50, null=True)),
                ("created_at", models.DateTimeField(default=django.utils.timezone.now)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "student",
                    models.ForeignKey(
                        blank=True,
                        db_column="student_id",
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="bot_profiles",
                        to="api.student",
                    ),
                ),
            ],
            options={
                "verbose_name": "Bot User Profile",
                "verbose_name_plural": "Bot User Profiles",
                "db_table": "bot_user_profiles",
            },
        ),
        migrations.CreateModel(
            name="ComplaintFeedback",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name="ID",
                    ),
                ),
                ("phone_number", models.CharField(db_index=True, max_length=20)),
                ("student_name", models.CharField(blank=True, default="", max_length=150)),
                ("class_name", models.CharField(blank=True, default="", max_length=150)),
                ("language", models.CharField(default="en", max_length=5)),
                (
                    "submission_type",
                    models.CharField(
                        choices=[("COMPLAINT", "Complaint"), ("FEEDBACK", "Feedback")],
                        max_length=20,
                    ),
                ),
                (
                    "category",
                    models.CharField(
                        choices=[
                            ("STUDY", "Study Related"),
                            ("SCHOOL", "School Related"),
                            ("TEACHER", "Teacher Related"),
                            ("OTHER", "Other"),
                        ],
                        default="OTHER",
                        max_length=50,
                    ),
                ),
                ("message", models.TextField()),
                (
                    "status",
                    models.CharField(
                        choices=[
                            ("PENDING", "Pending"),
                            ("IN_REVIEW", "In Review"),
                            ("RESOLVED", "Resolved"),
                        ],
                        default="PENDING",
                        max_length=20,
                    ),
                ),
                ("admin_reply", models.TextField(blank=True, null=True)),
                ("resolved_at", models.DateTimeField(blank=True, null=True)),
                ("created_at", models.DateTimeField(default=django.utils.timezone.now)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "student",
                    models.ForeignKey(
                        blank=True,
                        db_column="student_id",
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="complaints_feedback",
                        to="api.student",
                    ),
                ),
            ],
            options={
                "verbose_name": "Complaint / Feedback",
                "verbose_name_plural": "Complaints & Feedback",
                "db_table": "complaints_feedback",
                "ordering": ["-created_at"],
            },
        ),
    ]
