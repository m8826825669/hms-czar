"""
URL configuration — FIXED to use consistent /api/v1/ prefix on every module.

Previously only `/api/v1/auth/` was versioned; every other module was at `/api/<x>/`,
which mismatches the frontend's axios baseURL (`${BACKEND_URL}/api/v1`) and the
fetch helpers' default base. That caused 404s on every screen except login.

Also exposes the OpenAPI schema and interactive docs:
    /api/schema/         raw OpenAPI 3 schema (YAML; ?format=json for JSON)
    /api/docs/           Swagger UI
    /api/redoc/          Redoc UI
"""
from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from drf_spectacular.views import (
    SpectacularAPIView,
    SpectacularSwaggerView,
    SpectacularRedocView,
)


urlpatterns = [
    path("admin/", admin.site.urls),

    # OpenAPI schema + interactive docs
    path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
    path("api/docs/",   SpectacularSwaggerView.as_view(url_name="schema"), name="swagger-ui"),
    path("api/redoc/",  SpectacularRedocView.as_view(url_name="schema"),   name="redoc"),

    # Auth & core
    path("api/v1/auth/",          include("apps.accounts.urls")),
    path("api/v1/core/",          include("apps.core.urls")),
    path("api/v1/notifications/", include("apps.notifications.urls")),
    path("api/v1/specialist/",    include("apps.specialist.urls")),
    path("api/v1/reception/",     include("apps.reception.urls")),
    path("api/v1/opd/",           include("apps.opd.urls")),
    path("api/v1/emr/",           include("apps.emr.urls")),
    path("api/v1/billing/",       include("apps.billing.urls")),
    path("api/v1/public/",        include("apps.public.urls")),

    # Clinical & departments
    path("api/v1/departments/",   include("apps.department.urls")),
    path("api/v1/pharmacy/",      include("apps.pharmacy.urls")),
    path("api/v1/lab/",           include("apps.lab.urls")),
    path("api/v1/ipd/",           include("apps.ipd.urls")),
    path("api/v1/nursing/",       include("apps.nursing.urls")),

    # Specialised clinical
    path("api/v1/ot/",            include("apps.ot.urls")),
    path("api/v1/blood-bank/",    include("apps.blood_bank.urls")),
    path("api/v1/ambulance/",     include("apps.ambulance.urls")),
    path("api/v1/dietary/",       include("apps.dietary.urls")),
    path("api/v1/laundry/",       include("apps.laundry.urls")),
    path("api/v1/gas-cylinder/",  include("apps.gas_cylinder.urls")),

    # Operations
    path("api/v1/inventory/",     include("apps.inventory.urls")),
    path("api/v1/assets/",        include("apps.assets.urls")),
    path("api/v1/housekeeping/",  include("apps.housekeeping.urls")),

    # People
    path("api/v1/hr/",            include("apps.hr.urls")),
    path("api/v1/payroll/",       include("apps.payroll.urls")),
    path("api/v1/attendance/",    include("apps.attendance.urls")),
    path("api/v1/security/",      include("apps.security_module.urls")),

    # Cross-cutting clinical/admin
    path("api/v1/insurance/",     include("apps.insurance.urls")),
    path("api/v1/vaccination/",   include("apps.vaccination.urls")),
    path("api/v1/complaints/",    include("apps.complaints.urls")),
    path("api/v1/internal-comms/", include("apps.internal_comms.urls")),
    path("api/v1/accounting/",    include("apps.accounting.urls")),
    path("api/v1/crisis/",        include("apps.crisis.urls")),
    path("api/v1/protection/",    include("apps.protection.urls")),
    path("api/v1/dashboard/",     include("apps.dashboard.urls")),

    # MIS / Analytics
    path("api/v1/analytics/",     include("apps.analytics.urls")),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
