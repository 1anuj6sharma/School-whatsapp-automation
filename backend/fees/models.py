from django.db import models
from django.utils import timezone
import uuid

# ─── 1. ISOLATED FEE CLASSES ──────────────────────────────────────────────────

class FeeClass(models.Model):
    """
    Dedicated Class model for Fee & Accounting system.
    Completely isolated from marketing/campaign Class model.
    """
    name = models.CharField(max_length=50, help_text="e.g. 1, 2, 10, LKG, Nursery")
    section = models.CharField(max_length=20, default="A", blank=True, help_text="e.g. A, B")
    description = models.TextField(blank=True, default="")
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        db_table = "fee_classes"
        verbose_name = "Fee Class"
        verbose_name_plural = "Fee Classes"
        ordering = ["name", "section"]
        unique_together = ("name", "section")

    def __str__(self):
        return f"{self.name} - {self.section}" if self.section else self.name


# ─── 2. ISOLATED FEE STUDENTS ─────────────────────────────────────────────────

class FeeStudent(models.Model):
    """
    Dedicated Student model for Double-Entry Fees & Accounting.
    Completely isolated from marketing Student model and does NOT touch marketing fees_due.
    """
    student_name = models.CharField(max_length=200, db_index=True)
    parent_name = models.CharField(max_length=200, blank=True, default="")
    whatsapp_number = models.CharField(max_length=30, db_index=True)
    fee_class = models.ForeignKey(
        FeeClass, on_delete=models.SET_NULL, null=True, blank=True,
        related_name="students", db_column="class_id"
    )
    fees_due = models.DecimalField(
        max_digits=10, decimal_places=2, default=0.00,
        help_text="Double-entry ledger calculated balance for this student"
    )
    admission_number = models.CharField(max_length=50, blank=True, default="")
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "fee_students"
        verbose_name = "Fee Student"
        verbose_name_plural = "Fee Students"
        ordering = ["student_name"]

    @property
    def school_class(self):
        return self.fee_class

    @property
    def school_class_id(self):
        return self.fee_class_id

    def __str__(self):
        cls_name = self.fee_class.name if self.fee_class else "No Class"
        return f"{self.student_name} ({cls_name})"


# ─── 3. MANAGEMENT: Fee Slabs (Classes grouping & Yearly Fees) ────────────────

class FeeSlab(models.Model):
    """
    Defines fee structure for groups of fee classes.
    Example:
      - Slab 1: Playway to 5th
      - Slab 2: 6th to 8th
      - Slab 3: 9th & 10th
      - Slab 4: 11th & 12th
    """
    name = models.CharField(max_length=150, help_text="e.g. Primary Slab (Play to 5th)")
    description = models.TextField(blank=True, default="")
    academic_year = models.CharField(max_length=20, default="2026-2027", db_index=True)
    quarterly_fee = models.DecimalField(
        max_digits=10, decimal_places=2, default=0.00,
        help_text="Standard fee charged per quarter"
    )
    # Linked strictly to isolated FeeClass
    classes = models.ManyToManyField(
        FeeClass, related_name='fee_slabs', blank=True,
        help_text="Fee classes that fall under this fee slab"
    )
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "fee_slabs"
        verbose_name = "Fee Slab"
        verbose_name_plural = "Fee Slabs"
        ordering = ["name"]

    def __str__(self):
        return f"{self.name} ({self.academic_year}) - ₹{self.quarterly_fee}/qtr"


# ─── 4. DOUBLE-ENTRY: Chart of Accounts (COA) ──────────────────────────────────

class Account(models.Model):
    """
    General Ledger Account.
    Standard Codes:
      1010: Cash at Counter (Fee Desk) [Asset]
      1020: Bank Account / Online Gateway [Asset]
      1100: Student Fees Receivable (Master & Sub-Ledger) [Asset]
      4010: Tuition Fee Revenue [Income]
      4020: Activity & Event Fee Revenue [Income]
      4030: Late Fee / Penalty Income [Income]
      4090: Fee Concession / Annual Discount [Contra-Income / Expense]
    """
    ACCOUNT_TYPES = [
        ("ASSET", "Asset"),
        ("LIABILITY", "Liability"),
        ("EQUITY", "Equity"),
        ("INCOME", "Income"),
        ("EXPENSE", "Expense"),
    ]

    code = models.CharField(max_length=30, unique=True, db_index=True)
    name = models.CharField(max_length=150)
    account_type = models.CharField(max_length=20, choices=ACCOUNT_TYPES)
    # Sub-ledger pointer to dedicated FeeStudent
    student = models.ForeignKey(
        FeeStudent, on_delete=models.CASCADE,
        null=True, blank=True, related_name='fee_ledger_account',
        db_column="student_id"
    )
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        db_table = "fee_accounts"
        verbose_name = "Fee Account"
        verbose_name_plural = "Fee Accounts"
        ordering = ["code"]

    def __str__(self):
        return f"[{self.code}] {self.name}"


# ─── 5. DOUBLE-ENTRY: Journal Entries & Journal Items ─────────────────────────

class JournalEntry(models.Model):
    """
    Immutable transaction header for any financial event.
    Total Debits must equal Total Credits across all its JournalItems.
    """
    REFERENCE_TYPES = [
        ("FEE_BILLING", "Quarterly Fee Invoiced"),
        ("CASH_RECEIPT", "Cash Received at Counter"),
        ("BANK_RECEIPT", "Bank / Online Received"),
        ("LATE_PENALTY", "Late Fee Penalty Added"),
        ("ACTIVITY_FEE", "Extracurricular Activity Fee"),
        ("ANNUAL_DISCOUNT", "Annual Payment 10% Discount"),
        ("ADJUSTMENT", "Manual Reversal / Adjustment"),
    ]

    entry_number = models.CharField(max_length=50, unique=True, db_index=True) # e.g. JE-2026-0001
    date = models.DateField(default=timezone.now, db_index=True)
    narration = models.TextField(help_text="Detailed description of the transaction")
    reference_type = models.CharField(max_length=30, choices=REFERENCE_TYPES, default="CASH_RECEIPT")
    quarter = models.CharField(max_length=10, blank=True, null=True, help_text="Q1, Q2, Q3, or Q4")
    academic_year = models.CharField(max_length=20, default="2026-2027")
    receipt_number = models.CharField(max_length=50, blank=True, null=True, db_index=True)
    created_by = models.CharField(max_length=150, default="System")
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        db_table = "fee_journal_entries"
        verbose_name = "Journal Entry"
        verbose_name_plural = "Journal Entries"
        ordering = ["-date", "-id"]

    def __str__(self):
        return f"{self.entry_number} ({self.reference_type}) - {self.date}"


class JournalItem(models.Model):
    """
    Individual atomic Debit/Credit line item in a Journal Entry.
    """
    journal_entry = models.ForeignKey(
        JournalEntry, on_delete=models.CASCADE, related_name="items"
    )
    account = models.ForeignKey(
        Account, on_delete=models.PROTECT, related_name="journal_items"
    )
    # Sub-ledger mapping strictly to dedicated FeeStudent
    student = models.ForeignKey(
        FeeStudent, on_delete=models.SET_NULL,
        null=True, blank=True, related_name="fee_journal_items",
        db_column="student_id"
    )
    debit = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    credit = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        db_table = "fee_journal_items"
        verbose_name = "Journal Item"
        verbose_name_plural = "Journal Items"
        ordering = ["id"]

    def __str__(self):
        return f"JE#{self.journal_entry_id}: {self.account.name} Dr:{self.debit} Cr:{self.credit}"


# ─── 6. OPERATOR: Counter Cash OTP Payment Session ────────────────────────────

class FeePaymentSession(models.Model):
    """
    Controls OTP verification for counter cash collections.
    Prevents staff cash theft (ghaflebaazi).
    """
    STATUS_CHOICES = [
        ("PENDING", "Pending OTP Verification"),
        ("VERIFIED", "OTP Verified & Payment Committed"),
        ("EXPIRED", "Session Expired"),
        ("CANCELLED", "Cancelled by Operator"),
    ]

    session_id = models.UUIDField(default=uuid.uuid4, unique=True, db_index=True)
    student = models.ForeignKey(
        FeeStudent, on_delete=models.CASCADE, related_name="payment_sessions"
    )
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    otp_code = models.CharField(max_length=6)
    parent_phone = models.CharField(max_length=20)
    quarter = models.CharField(max_length=10, default="Q1")
    academic_year = models.CharField(max_length=20, default="2026-2027")
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="PENDING")
    receipt_number = models.CharField(max_length=50, blank=True, null=True)
    otp_expires_at = models.DateTimeField()
    collected_by = models.CharField(max_length=150, default="Operator")
    journal_entry = models.ForeignKey(
        JournalEntry, on_delete=models.SET_NULL, null=True, blank=True, related_name="payment_session"
    )
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        db_table = "fee_payment_sessions"
        verbose_name = "Fee Payment Session"
        verbose_name_plural = "Fee Payment Sessions"
        ordering = ["-created_at"]

    def is_expired(self):
        return timezone.now() > self.otp_expires_at

    def __str__(self):
        return f"Payment #{self.session_id} - ₹{self.amount} ({self.status})"
