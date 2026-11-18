from django.contrib import admin
from django.urls import path, re_path, include
from django.conf import settings
from django.views.static import serve
from api.views import HealthCheckView

urlpatterns = [
    path('admin/', admin.site.urls),
    path('health', HealthCheckView.as_view(), name='health-root'),
    path('health/', HealthCheckView.as_view(), name='health-slash'),
    re_path(r'^uploads/(?P<path>.*)$', serve, {'document_root': settings.MEDIA_ROOT}),
    path('api/fees/', include('fees.urls')),
    path('api/fees', include('fees.urls')),
    path('', include('api.urls')),
]
