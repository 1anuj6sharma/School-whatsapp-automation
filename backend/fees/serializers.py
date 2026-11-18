from rest_framework import serializers
from .models import FeeSlab, Account, JournalEntry, JournalItem, FeePaymentSession
from api.models import Class, Student


class ClassSimpleSerializer(serializers.ModelSerializer):
    class Meta:
        model = Class
        fields = ["id", "name", "section"]


class FeeSlabSerializer(serializers.ModelSerializer):
    classes = ClassSimpleSerializer(many=True, read_only=True)
    class_ids = serializers.PrimaryKeyRelatedField(
        many=True, queryset=Class.objects.all(), write_only=True, source="classes", required=False
    )
    student_count = serializers.SerializerMethodField()

    class Meta:
        model = FeeSlab
        fields = [
            "id", "name", "description", "academic_year",
            "quarterly_fee", "classes", "class_ids", "student_count",
            "is_active", "created_at", "updated_at"
        ]

    def get_student_count(self, obj):
        class_ids = obj.classes.values_list("id", flat=True)
        return Student.objects.filter(school_class_id__in=class_ids).count()

    def to_representation(self, instance):
        data = super().to_representation(instance)
        if "classes" in data and isinstance(data["classes"], list):
            import re
            def dict_sort_key(c):
                raw = (c.get("name") or "").strip().upper()
                sec = (c.get("section") or "").strip().upper()
                pre_primary = {
                    "PLAY": 1, "PLAYWAY": 1, "PLAY-WAY": 1, "PRE-NURSERY": 1, "PRE NURSERY": 1,
                    "NURSERY": 2, "NURSURY": 2, "KG": 3, "LKG": 3, "L.K.G": 3, "JR": 3,
                    "UKG": 4, "U.K.G": 4, "SR": 4, "PREP": 4
                }
                for k, rank in pre_primary.items():
                    if k in raw:
                        return (0, rank, sec, raw)
                m = re.search(r'\b(\d+)\b', raw) or re.search(r'(\d+)', raw)
                if m:
                    return (1, int(m.group(1)), sec, raw)
                return (2, 999, sec, raw)
            data["classes"].sort(key=dict_sort_key)
        return data


class AccountSerializer(serializers.ModelSerializer):
    class Meta:
        model = Account
        fields = ["id", "code", "name", "account_type", "is_active", "created_at"]


class JournalItemSerializer(serializers.ModelSerializer):
    account_code = serializers.CharField(source="account.code", read_only=True)
    account_name = serializers.CharField(source="account.name", read_only=True)
    student_name = serializers.CharField(source="student.student_name", read_only=True)

    class Meta:
        model = JournalItem
        fields = [
            "id", "account_code", "account_name", "student_id",
            "student_name", "debit", "credit"
        ]


class JournalEntrySerializer(serializers.ModelSerializer):
    items = JournalItemSerializer(many=True, read_only=True)

    class Meta:
        model = JournalEntry
        fields = [
            "id", "entry_number", "date", "narration", "reference_type",
            "quarter", "academic_year", "receipt_number", "created_by",
            "created_at", "items"
        ]


class FeePaymentSessionSerializer(serializers.ModelSerializer):
    student_name = serializers.CharField(source="student.student_name", read_only=True)
    class_name = serializers.SerializerMethodField()

    class Meta:
        model = FeePaymentSession
        fields = [
            "id", "session_id", "student_id", "student_name", "class_name",
            "amount", "parent_phone", "quarter", "academic_year", "status",
            "receipt_number", "otp_expires_at", "collected_by", "created_at"
        ]
        read_only_fields = [
            "session_id", "status", "receipt_number", "otp_expires_at", "created_at"
        ]

    def get_class_name(self, obj):
        if obj.student and obj.student.school_class:
            c = obj.student.school_class
            return f"{c.name} - {c.section}" if c.section else c.name
        return "N/A"
