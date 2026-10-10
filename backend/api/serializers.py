from rest_framework import serializers
from .models import Class, Student, MessageTemplate, MessageCampaign, MessageLog, ChatMessage, ComplaintFeedback, BotUserProfile
from .utils.phone import sanitize_phone_number, validate_phone_number

class ClassSerializer(serializers.ModelSerializer):
    student_count = serializers.SerializerMethodField()

    class Meta:
        model = Class
        fields = ["id", "name", "section", "created_at", "updated_at", "student_count"]

    def get_student_count(self, obj):
        if hasattr(obj, "student_count_annotated"):
            return obj.student_count_annotated
        return obj.students.count()


class ClassCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Class
        fields = ["name", "section"]

    def validate_name(self, value):
        val = value.strip()
        if not val:
            raise serializers.ValidationError("Class name cannot be empty.")
        return val


class ClassUpdateSerializer(serializers.ModelSerializer):
    name = serializers.CharField(required=False)
    section = serializers.CharField(required=False, allow_null=True, allow_blank=True)

    class Meta:
        model = Class
        fields = ["name", "section"]


class StudentSerializer(serializers.ModelSerializer):
    class_id = serializers.IntegerField(source="school_class_id")
    class_name = serializers.SerializerMethodField()
    class_section = serializers.CharField(source="school_class.section", read_only=True, allow_null=True)

    class Meta:
        model = Student
        fields = [
            "id",
            "class_id",
            "student_name",
            "parent_name",
            "whatsapp_number",
            "fees_due",
            "whatsapp_opt_in",
            "created_at",
            "updated_at",
            "class_name",
            "class_section",
        ]

    def get_class_name(self, obj):
        if not obj.school_class:
            return "General"
        if obj.school_class.section:
            return f"{obj.school_class.name} - {obj.school_class.section}"
        return obj.school_class.name


class StudentCreateSerializer(serializers.ModelSerializer):
    class_id = serializers.IntegerField()

    class Meta:
        model = Student
        fields = [
            "class_id",
            "student_name",
            "parent_name",
            "whatsapp_number",
            "fees_due",
            "whatsapp_opt_in",
        ]

    def validate_class_id(self, value):
        if not Class.objects.filter(id=value).exists():
            raise serializers.ValidationError("Selected class does not exist.")
        return value

    def validate_whatsapp_number(self, value):
        cleaned = sanitize_phone_number(value)
        if not validate_phone_number(cleaned):
            raise serializers.ValidationError(
                f"Invalid phone number: {value}. Must contain 10-15 digits including country code."
            )
        return cleaned


class StudentUpdateSerializer(serializers.ModelSerializer):
    class_id = serializers.IntegerField(required=False)
    student_name = serializers.CharField(required=False)
    parent_name = serializers.CharField(required=False, allow_null=True, allow_blank=True)
    whatsapp_number = serializers.CharField(required=False)
    fees_due = serializers.DecimalField(max_digits=10, decimal_places=2, required=False)
    whatsapp_opt_in = serializers.BooleanField(required=False)

    class Meta:
        model = Student
        fields = [
            "class_id",
            "student_name",
            "parent_name",
            "whatsapp_number",
            "fees_due",
            "whatsapp_opt_in",
        ]

    def validate_whatsapp_number(self, value):
        if value:
            cleaned = sanitize_phone_number(value)
            if not validate_phone_number(cleaned):
                raise serializers.ValidationError(
                    f"Invalid phone number: {value}. Must contain 10-15 digits."
                )
            return cleaned
        return value


class TemplateSerializer(serializers.ModelSerializer):
    class Meta:
        model = MessageTemplate
        fields = [
            "id",
            "name",
            "category",
            "language",
            "description",
            "body_preview",
            "header_type",
            "header_text",
            "sample_image_url",
            "variable_mappings",
            "status",
            "created_at",
            "updated_at",
        ]

    def to_representation(self, instance):
        ret = super().to_representation(instance)
        mappings = ret.get("variable_mappings")
        if isinstance(mappings, dict):
            clean_mappings = {}
            for k, v in mappings.items():
                v_str = str(v).strip()
                if v_str in ("student_name", "Student Name", "{Student Name}"):
                    clean_mappings[k] = "{Student Name}"
                elif v_str in ("parent_name", "Parent Name", "{Parent Name}"):
                    clean_mappings[k] = "{Parent Name}"
                elif v_str in ("class_name", "Class Name", "Class", "{Class Name}"):
                    clean_mappings[k] = "{Class Name}"
                elif v_str in ("fees_due", "Fees Due", "fees", "{Fees Due}"):
                    clean_mappings[k] = "{Fees Due}"
                elif v_str.startswith("Value "):
                    clean_mappings[k] = v_str
                elif v_str.lower() in ("remarks", "remark", "due_date", "attendance", "school_name"):
                    clean_mappings[k] = f"Value {k}"
                elif v_str:
                    clean_mappings[k] = v_str
                else:
                    clean_mappings[k] = f"Value {k}"
            ret["variable_mappings"] = clean_mappings
        return ret


class TemplateCreateMetaSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=100)
    category = serializers.ChoiceField(choices=["UTILITY", "MARKETING", "AUTHENTICATION"], default="UTILITY")
    language = serializers.CharField(default="en_US")
    header_type = serializers.CharField(required=False, default="NONE")
    header_text = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    sample_image_url = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    body_text = serializers.CharField()
    sample_values = serializers.ListField(child=serializers.CharField(), required=False, default=list)
    variable_mappings = serializers.DictField(required=False, default=dict)
    description = serializers.CharField(required=False, allow_blank=True)


class TemplateUpdateMetaSerializer(serializers.Serializer):
    category = serializers.ChoiceField(choices=["UTILITY", "MARKETING", "AUTHENTICATION"], required=False)
    header_type = serializers.CharField(required=False, default="NONE")
    header_text = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    sample_image_url = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    body_text = serializers.CharField(required=False)
    sample_values = serializers.ListField(child=serializers.CharField(), required=False, default=list)
    variable_mappings = serializers.DictField(required=False)
    description = serializers.CharField(required=False, allow_blank=True)


class MessageLogSerializer(serializers.ModelSerializer):
    student_name = serializers.CharField(source="student.student_name", read_only=True, default=None)

    class Meta:
        model = MessageLog
        fields = [
            "id",
            "campaign_id",
            "student_id",
            "student_name",
            "recipient_number",
            "template_name",
            "status",
            "whatsapp_message_id",
            "error_message",
            "sent_at",
            "delivered_at",
            "read_at",
            "failed_at",
            "created_at",
        ]


class CampaignSerializer(serializers.ModelSerializer):
    class_id = serializers.IntegerField(source="school_class_id", read_only=True)
    class_name = serializers.CharField(source="school_class.name", read_only=True, default=None)
    template_id = serializers.IntegerField(read_only=True)
    template_name = serializers.CharField(source="template.name", read_only=True, default=None)

    class Meta:
        model = MessageCampaign
        fields = [
            "id",
            "class_id",
            "class_name",
            "template_id",
            "template_name",
            "total_recipients",
            "successful_count",
            "failed_count",
            "skipped_count",
            "header_image_url",
            "status",
            "created_at",
            "started_at",
            "completed_at",
        ]


class CampaignDetailSerializer(CampaignSerializer):
    message_logs = MessageLogSerializer(many=True, read_only=True)

    class Meta(CampaignSerializer.Meta):
        fields = CampaignSerializer.Meta.fields + ["message_logs"]


class CampaignCreateSerializer(serializers.Serializer):
    class_id = serializers.IntegerField(required=False, allow_null=True)
    class_ids = serializers.ListField(child=serializers.IntegerField(), required=False, allow_null=True)
    template_id = serializers.IntegerField()
    student_ids = serializers.ListField(child=serializers.IntegerField(), required=False, allow_null=True)
    dynamic_parameters = serializers.ListField(child=serializers.CharField(), required=False, allow_null=True)
    per_student_parameters = serializers.DictField(child=serializers.ListField(child=serializers.CharField()), required=False, allow_null=True)
    header_image_url = serializers.CharField(required=False, allow_null=True, allow_blank=True)


class TestMessageSerializer(serializers.Serializer):
    recipient_number = serializers.CharField()
    template_name = serializers.CharField(default="hello_world")
    language_code = serializers.CharField(default="en_US")

    def validate_recipient_number(self, value):
        cleaned = sanitize_phone_number(value)
        if not validate_phone_number(cleaned):
            raise serializers.ValidationError(
                f"Invalid phone number: {value}. Must contain 10-15 digits including country code."
            )
        return cleaned


class ChatMessageSerializer(serializers.ModelSerializer):
    student_name = serializers.CharField(source="student.student_name", read_only=True, default=None)
    class_name = serializers.SerializerMethodField()

    class Meta:
        model = ChatMessage
        fields = [
            "id",
            "student_id",
            "student_name",
            "class_name",
            "phone_number",
            "sender_name",
            "direction",
            "message_type",
            "text_content",
            "media_url",
            "template_name",
            "status",
            "whatsapp_message_id",
            "message_log_id",
            "created_at",
        ]

    def get_class_name(self, obj):
        if obj.student and obj.student.school_class:
            cls = obj.student.school_class
            return f"{cls.name} - {cls.section}" if cls.section else cls.name
        return None


class SendConversationMessageSerializer(serializers.Serializer):
    student_id = serializers.IntegerField(required=False, allow_null=True)
    phone_number = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    message = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    template_name = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    language_code = serializers.CharField(required=False, default="en_US")
    parameters = serializers.ListField(child=serializers.CharField(), required=False, allow_null=True)

    def validate(self, data):
        if not data.get("student_id") and not data.get("phone_number"):
            raise serializers.ValidationError("Either student_id or phone_number is required.")
        if not data.get("message") and not data.get("template_name"):
            raise serializers.ValidationError("Either message (text) or template_name is required.")
        return data


# ─── Bot / Chatbot Serializers ────────────────────────────────────────────────

class ComplaintFeedbackSerializer(serializers.ModelSerializer):
    student_name = serializers.SerializerMethodField()
    class_name = serializers.SerializerMethodField()
    admission_number = serializers.SerializerMethodField()

    class Meta:
        model = ComplaintFeedback
        fields = [
            "id",
            "phone_number",
            "student",
            "student_name",
            "class_name",
            "admission_number",
            "language",
            "submission_type",
            "category",
            "message",
            "status",
            "admin_reply",
            "resolved_at",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]

    def get_student_name(self, obj):
        if obj.student:
            return obj.student.student_name
        # Fallback to bot profile display name if available
        try:
            profile = BotUserProfile.objects.filter(phone_number=obj.phone_number).first()
            if profile and profile.student:
                return profile.student.student_name
            if profile and profile.display_name:
                return profile.display_name
        except Exception:
            pass
        return obj.student_name or "WhatsApp User"

    def get_class_name(self, obj):
        student = obj.student
        if not student:
            try:
                profile = BotUserProfile.objects.filter(phone_number=obj.phone_number).first()
                if profile and profile.student:
                    student = profile.student
            except Exception:
                pass
        if student and student.school_class:
            cls = student.school_class
            return f"{cls.name} - {cls.section}" if cls.section else cls.name
        return obj.class_name or "N/A"

    def get_admission_number(self, obj):
        student = obj.student
        if not student:
            try:
                profile = BotUserProfile.objects.filter(phone_number=obj.phone_number).first()
                if profile and profile.student:
                    student = profile.student
            except Exception:
                pass
        return student.parent_name if student else None


class BotUserProfileSerializer(serializers.ModelSerializer):
    student_name = serializers.SerializerMethodField()

    class Meta:
        model = BotUserProfile
        fields = [
            "id",
            "phone_number",
            "student",
            "student_name",
            "display_name",
            "language",
            "conversation_state",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]

    def get_student_name(self, obj):
        return obj.student.student_name if obj.student else obj.display_name

