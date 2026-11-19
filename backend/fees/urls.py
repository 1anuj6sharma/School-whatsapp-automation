from django.urls import path
from .views import (
    # Management Section
    ManagementFeeClassesView,
    ManagementFeeStudentsView,
    ManagementFeeStudentImportView,
    ManagementFeeStudentDetailView,
    ManagementFeeStudentBulkDeleteView,
    ManagementAccountsListView,
    ManagementAccountDetailsView,
    ManagementFeeSlabListCreateView,
    ManagementFeeSlabDetailView,
    ManagementPostQuarterlyFeesView,
    ManagementJournalEntriesListView,
    ManagementJournalEntryDetailView,
    # Operator Section
    OperatorStudentFeeSummaryView,
    OperatorSendCashPaymentOTPView,
    OperatorVerifyPaymentOTPView,
    OperatorDefaultersListView,
    OperatorStudentPassbookView,
    OperatorRecordOfflinePaymentView,
)

urlpatterns = [
    # ── Management Section URLs ──
    path("management/classes", ManagementFeeClassesView.as_view(), name="fee-classes-list-create"),
    path("management/classes/", ManagementFeeClassesView.as_view(), name="fee-classes-list-create-slash"),

    path("management/students", ManagementFeeStudentsView.as_view(), name="fee-students-list-create"),
    path("management/students/", ManagementFeeStudentsView.as_view(), name="fee-students-list-create-slash"),
    path("management/students/import", ManagementFeeStudentImportView.as_view(), name="fee-students-import"),
    path("management/students/import/", ManagementFeeStudentImportView.as_view(), name="fee-students-import-slash"),
    path("management/students/bulk-delete", ManagementFeeStudentBulkDeleteView.as_view(), name="fee-students-bulk-delete"),
    path("management/students/bulk-delete/", ManagementFeeStudentBulkDeleteView.as_view(), name="fee-students-bulk-delete-slash"),
    path("management/students/<int:pk>", ManagementFeeStudentDetailView.as_view(), name="fee-student-detail"),
    path("management/students/<int:pk>/", ManagementFeeStudentDetailView.as_view(), name="fee-student-detail-slash"),

    path("management/accounts", ManagementAccountsListView.as_view(), name="fee-accounts-list"),
    path("management/accounts/", ManagementAccountsListView.as_view(), name="fee-accounts-list-slash"),
    path("management/accounts/<int:pk>", ManagementAccountDetailsView.as_view(), name="fee-account-detail"),
    path("management/accounts/<int:pk>/", ManagementAccountDetailsView.as_view(), name="fee-account-detail-slash"),

    path("management/slabs", ManagementFeeSlabListCreateView.as_view(), name="fee-slab-list-create"),
    path("management/slabs/", ManagementFeeSlabListCreateView.as_view(), name="fee-slab-list-create-slash"),
    path("management/slabs/<int:pk>", ManagementFeeSlabDetailView.as_view(), name="fee-slab-detail"),
    path("management/slabs/<int:pk>/", ManagementFeeSlabDetailView.as_view(), name="fee-slab-detail-slash"),
    path("management/post-quarterly-fees", ManagementPostQuarterlyFeesView.as_view(), name="post-quarterly-fees"),
    path("management/post-quarterly-fees/", ManagementPostQuarterlyFeesView.as_view(), name="post-quarterly-fees-slash"),
    path("management/journal-entries", ManagementJournalEntriesListView.as_view(), name="journal-entries-list"),
    path("management/journal-entries/", ManagementJournalEntriesListView.as_view(), name="journal-entries-list-slash"),
    path("management/journal-entries/<int:pk>", ManagementJournalEntryDetailView.as_view(), name="journal-entry-detail"),
    path("management/journal-entries/<int:pk>/", ManagementJournalEntryDetailView.as_view(), name="journal-entry-detail-slash"),

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
    path("operator/record-offline-payment", OperatorRecordOfflinePaymentView.as_view(), name="operator-record-offline-payment"),
    path("operator/record-offline-payment/", OperatorRecordOfflinePaymentView.as_view(), name="operator-record-offline-payment-slash"),
]
