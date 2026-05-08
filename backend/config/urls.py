"""HMS root URL configuration.

Phase 2b adds:
- /api/lab/ — Lab module (tests, orders, samples, results, reports)

(Refunds live under /api/billing/refunds/ — see billing/urls.py)
"""
from django.contrib import admin
from django.urls import path, include


urlpatterns = [
    path("admin/", admin.site.urls),

    # Auth
    path("api/auth/", include("apps.accounts.urls")),

    # Phase 1a
    path("api/notifications/", include("apps.notifications.urls")),
    path("api/specialist/", include("apps.specialist.urls")),
    path("api/reception/", include("apps.reception.urls")),

    # Phase 1b
    path("api/opd/", include("apps.opd.urls")),
    path("api/emr/", include("apps.emr.urls")),

    # Phase 1c
    path("api/billing/", include("apps.billing.urls")),
    path("api/p/", include("apps.public.urls")),

    # Phase 2a
    path("api/department/", include("apps.department.urls")),
    path("api/pharmacy/", include("apps.pharmacy.urls")),

    # Phase 2b
    path("api/lab/", include("apps.lab.urls")),
]
