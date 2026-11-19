from rest_framework import serializers
from .models import FeeClass, FeeStudent, FeeSlab, Account, JournalEntry, JournalItem, FeePaymentSession


class FeeClassSerializer(serializers.ModelSerializer):
    student_count = serializers.SerializerMethodField()

    class Meta:
        model = FeeClass
        fields = ["id", "name", "section", "description", "student_count", "is_active", "created_at"]

    def get_student_count(self, obj):
        if hasattr(obj, "student_count_annotated"):
            return obj.student_count_annotated
        return obj.students.count()


class FeeStudentSerializer(serializers.ModelSerializer):
    class_name = serializers.SerializerMethodField()
    class_id = serializers.IntegerField(source="fee_class_id", allow_null=True, required=False)

    class Meta:
        model = FeeStudent
        fields = [
            "id", "student_name", "parent_name", "whatsapp_number",
            "class_id", "class_name", "fees_due", "admission_number",
            "is_active", "created_at", "updated_at"
        ]

    def get_class_name(self, obj):
        if not obj.fee_class:
            return "General Class"
        return f"{obj.fee_class.name} ({obj.fee_class.section})" if obj.fee_class.section else obj.fee_class.name


class FeeSlabSerializer(serializers.ModelSerializer):
    classes = FeeClassSerializer(many=True, read_only=True)
    class_ids = serializers.PrimaryKeyRelatedField(
        many=True, queryset=FeeClass.objects.all(), write_only=True, source="classes", required=False
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
        return FeeStudent.objects.filter(fee_class_id__in=class_ids).count()

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
    student_name = serializers.CharField(source="student.student_name", read_only=True, default="")
    entry_number = serializers.CharField(source="journal_entry.entry_number", read_only=True)
    entry_date = serializers.DateField(source="journal_entry.date", read_only=True)
    narration = serializers.CharField(source="journal_entry.narration", read_only=True)
    reference_type = serializers.CharField(source="journal_entry.reference_type", read_only=True)
    receipt_number = serializers.CharField(source="journal_entry.receipt_number", read_only=True, default="")

    class Meta:
        model = JournalItem
        fields = [
            "id", "journal_entry_id", "entry_number", "entry_date", "narration",
            "reference_type", "receipt_number", "account_code", "account_name",
            "student_id", "student_name", "debit", "credit", "created_at"
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
        if not obj.student or not obj.student.fee_class:
            return "General Class"
        return f"{obj.student.fee_class.name} ({obj.student.fee_class.section})" if obj.student.fee_class.section else obj.student.fee_class.name
