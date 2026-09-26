from rest_framework import serializers
from .models import Class, Student, MessageTemplate, MessageCampaign, MessageLog
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
    class_name = serializers.CharField(source="school_class.name", read_only=True)

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
        ]


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
            "status",
            "created_at",
            "updated_at",
        ]


class TemplateCreateMetaSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=100)
    category = serializers.ChoiceField(choices=["UTILITY", "MARKETING", "AUTHENTICATION"], default="UTILITY")
    language = serializers.CharField(default="en_US")
    header_type = serializers.CharField(required=False, default="NONE")
    header_text = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    sample_image_url = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    body_text = serializers.CharField()
    sample_values = serializers.ListField(child=serializers.CharField(), required=False, default=list)
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
