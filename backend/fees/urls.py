from django.urls import path
from .views import (
    # Management Section
    ManagementFeeSlabListCreateView,
    ManagementFeeSlabDetailView,
    ManagementPostQuarterlyFeesView,
    ManagementJournalEntriesListView,
    # Operator Section
    OperatorStudentFeeSummaryView,
    OperatorSendCashPaymentOTPView,
    OperatorVerifyPaymentOTPView,
    OperatorDefaultersListView,
    OperatorStudentPassbookView,
)

urlpatterns = [
    # ── Management Section URLs ──
    path("management/slabs", ManagementFeeSlabListCreateView.as_view(), name="fee-slab-list-create"),
    path("management/slabs/", ManagementFeeSlabListCreateView.as_view(), name="fee-slab-list-create-slash"),
    path("management/slabs/<int:pk>", ManagementFeeSlabDetailView.as_view(), name="fee-slab-detail"),
    path("management/slabs/<int:pk>/", ManagementFeeSlabDetailView.as_view(), name="fee-slab-detail-slash"),
    path("management/post-quarterly-fees", ManagementPostQuarterlyFeesView.as_view(), name="post-quarterly-fees"),
    path("management/post-quarterly-fees/", ManagementPostQuarterlyFeesView.as_view(), name="post-quarterly-fees-slash"),
    path("management/journal-entries", ManagementJournalEntriesListView.as_view(), name="journal-entries-list"),
    path("management/journal-entries/", ManagementJournalEntriesListView.as_view(), name="journal-entries-list-slash"),

    # ── Operator Section URLs ──
    path("operator/student-summary/<int:student_id>", OperatorStudentFeeSummaryView.as_view(), name="operator-student-summary"),
    path("operator/student-summary/<int:student_id>/", OperatorStudentFeeSummaryView.as_view(), name="operator-student-summary-slash"),
    path("operator/student-passbook/<int:student_id>", OperatorStudentPassbookView.as_view(), name="operator-student-passbook"),
    path("operator/student-passbook/<int:student_id>/", OperatorStudentPassbookView.as_view(), name="operator-student-passbook-slash"),
    path("operator/send-otp", OperatorSendCashPaymentOTPView.as_view(), name="operator-send-otp"),
    path("operator/send-otp/", OperatorSendCashPaymentOTPView.as_view(), name="operator-send-otp-slash"),
    path("operator/verify-otp", OperatorVerifyPaymentOTPView.as_view(), name="operator-verify-otp"),
    path("operator/verify-otp/", OperatorVerifyPaymentOTPView.as_view(), name="operator-verify-otp-slash"),
    path("operator/defaulters", OperatorDefaultersListView.as_view(), name="operator-defaulters"),
    path("operator/defaulters/", OperatorDefaultersListView.as_view(), name="operator-defaulters-slash"),
]
