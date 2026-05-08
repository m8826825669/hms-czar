"""HMS root URL configuration (Phase 2c).

Phase 2c additions:
  /api/ipd/                              — Wards, beds, admissions, discharge
  /api/billing/gst/gstr1|gstr3b|workbook/ — GST reports (added in billing/urls.py)
  /api/specialist/dashboard/today/        — Doctor dashboard (added in specialist/urls.py)
"""
from django.contrib import admin
from django.urls import path, include


urlpatterns = [
    path("admin/", admin.site.urls),

    # Auth
    path("api/auth/", include("apps.accounts.urls")),

    # Phase 1a
    path("api/notifications/", include("apps.notifications.urls")),
    path("api/specialist/", include("apps.specialist.urls")),  # + doctor dashboard
    path("api/reception/", include("apps.reception.urls")),

    # Phase 1b
    path("api/opd/", include("apps.opd.urls")),
    path("api/emr/", include("apps.emr.urls")),

    # Phase 1c
    path("api/billing/", include("apps.billing.urls")),  # + refunds + GST
    path("api/p/", include("apps.public.urls")),

    # Phase 2a
    path("api/department/", include("apps.department.urls")),
    path("api/pharmacy/", include("apps.pharmacy.urls")),

    # Phase 2b
    path("api/lab/", include("apps.lab.urls")),

    # Phase 2c
    path("api/ipd/", include("apps.ipd.urls")),
]
