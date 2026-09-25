from django.urls import path
from .views import (
    ClassListCreateView,
    ClassDetailView,
    StudentListCreateView,
    StudentDetailView,
    StudentImportCSVView,
    TemplateListCreateView,
    TemplateSyncView,
    TemplateDetailView,
    CampaignListCreateView,
    CampaignDetailView,
    CampaignRetryView,
    MessageLogListView,
    MessageLogDetailView,
    TestMessageView,
    WhatsAppWebhookView,
    EmbeddedSignupConfigView,
    EmbeddedSignupExchangeTokenView,
)

urlpatterns = [
    # Classes API
    path("api/classes", ClassListCreateView.as_view(), name="class-list-create"),
    path("api/classes/", ClassListCreateView.as_view(), name="class-list-create-slash"),
    path("api/classes/<int:pk>", ClassDetailView.as_view(), name="class-detail"),
    path("api/classes/<int:pk>/", ClassDetailView.as_view(), name="class-detail-slash"),

    # Students API
    path("api/students", StudentListCreateView.as_view(), name="student-list-create"),
    path("api/students/", StudentListCreateView.as_view(), name="student-list-create-slash"),
    path("api/students/import-csv", StudentImportCSVView.as_view(), name="student-import-csv"),
    path("api/students/import-csv/", StudentImportCSVView.as_view(), name="student-import-csv-slash"),
    path("api/students/<int:pk>", StudentDetailView.as_view(), name="student-detail"),
    path("api/students/<int:pk>/", StudentDetailView.as_view(), name="student-detail-slash"),

    # Templates API
    path("api/templates", TemplateListCreateView.as_view(), name="template-list-create"),
    path("api/templates/", TemplateListCreateView.as_view(), name="template-list-create-slash"),
    path("api/templates/sync", TemplateSyncView.as_view(), name="template-sync"),
    path("api/templates/sync/", TemplateSyncView.as_view(), name="template-sync-slash"),
    path("api/templates/<int:pk>", TemplateDetailView.as_view(), name="template-detail"),
    path("api/templates/<int:pk>/", TemplateDetailView.as_view(), name="template-detail-slash"),

    # Campaigns API
    path("api/campaigns", CampaignListCreateView.as_view(), name="campaign-list-create"),
    path("api/campaigns/", CampaignListCreateView.as_view(), name="campaign-list-create-slash"),
    path("api/campaigns/<int:pk>", CampaignDetailView.as_view(), name="campaign-detail"),
    path("api/campaigns/<int:pk>/", CampaignDetailView.as_view(), name="campaign-detail-slash"),
    path("api/campaigns/<int:pk>/retry-failed", CampaignRetryView.as_view(), name="campaign-retry"),
    path("api/campaigns/<int:pk>/retry-failed/", CampaignRetryView.as_view(), name="campaign-retry-slash"),

    # Message Logs API
    path("api/message-logs", MessageLogListView.as_view(), name="log-list"),
    path("api/message-logs/", MessageLogListView.as_view(), name="log-list-slash"),
    path("api/message-logs/<int:pk>", MessageLogDetailView.as_view(), name="log-detail"),
    path("api/message-logs/<int:pk>/", MessageLogDetailView.as_view(), name="log-detail-slash"),

    # Test Message API
    path("api/messages/test", TestMessageView.as_view(), name="message-test"),
    path("api/messages/test/", TestMessageView.as_view(), name="message-test-slash"),

    # Webhooks (Supports both /webhooks/whatsapp and /api/webhooks/whatsapp)
    path("webhooks/whatsapp", WhatsAppWebhookView.as_view(), name="webhook-direct"),
    path("webhooks/whatsapp/", WhatsAppWebhookView.as_view(), name="webhook-direct-slash"),
    path("api/webhooks/whatsapp", WhatsAppWebhookView.as_view(), name="webhook-api"),
    path("api/webhooks/whatsapp/", WhatsAppWebhookView.as_view(), name="webhook-api-slash"),

    # Embedded Signup OAuth
    path("api/whatsapp/embedded-signup/config", EmbeddedSignupConfigView.as_view(), name="embedded-config"),
    path("api/whatsapp/embedded-signup/config/", EmbeddedSignupConfigView.as_view(), name="embedded-config-slash"),
    path("api/whatsapp/embedded-signup/exchange-token", EmbeddedSignupExchangeTokenView.as_view(), name="embedded-exchange"),
    path("api/whatsapp/embedded-signup/exchange-token/", EmbeddedSignupExchangeTokenView.as_view(), name="embedded-exchange-slash"),
]
