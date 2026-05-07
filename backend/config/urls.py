"""HMS URL configuration."""
from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView, SpectacularRedocView

api_v1_patterns = [
    path("auth/", include("apps.accounts.urls")),
    path("core/", include("apps.core.urls")),
    # Phase 1a
    path("notifications/", include("apps.notifications.urls")),
    path("specialist/", include("apps.specialist.urls")),
    path("reception/", include("apps.reception.urls")),
    # Phase 1b
    path("opd/", include("apps.opd.urls")),
    path("emr/", include("apps.emr.urls")),
    # Phase 1c
    path("billing/", include("apps.billing.urls")),
    path("public/", include("apps.public.urls")),
]

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/v1/", include((api_v1_patterns, "api"), namespace="v1")),
    path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
    path("api/docs/", SpectacularSwaggerView.as_view(url_name="schema"), name="swagger-ui"),
    path("api/redoc/", SpectacularRedocView.as_view(url_name="schema"), name="redoc"),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)
