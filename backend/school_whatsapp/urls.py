from django.contrib import admin
from django.urls import path, include
from api.views import HealthCheckView

urlpatterns = [
    path('admin/', admin.site.urls),
    path('health', HealthCheckView.as_view(), name='health-root'),
    path('health/', HealthCheckView.as_view(), name='health-slash'),
    path('', include('api.urls')),
]
