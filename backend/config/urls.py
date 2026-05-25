"""
URL configuration — Phase 4d additions.

Add additively to your config/urls.py:

    path("api/analytics/", include("apps.analytics.urls")),
"""
from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static


urlpatterns = [
    path("admin/", admin.site.urls),

    path("api/v1/auth/",          include("apps.accounts.urls")),
    path("api/core/",          include("apps.core.urls")),
    path("api/notifications/", include("apps.notifications.urls")),
    path("api/specialist/",    include("apps.specialist.urls")),
    path("api/reception/",     include("apps.reception.urls")),
    path("api/opd/",           include("apps.opd.urls")),
    path("api/emr/",           include("apps.emr.urls")),
    path("api/billing/",       include("apps.billing.urls")),
    path("api/public/",        include("apps.public.urls")),

    path("api/departments/", include("apps.department.urls")),
    path("api/pharmacy/",    include("apps.pharmacy.urls")),
    path("api/lab/",         include("apps.lab.urls")),
    path("api/ipd/",         include("apps.ipd.urls")),

    path("api/ot/",            include("apps.ot.urls")),
    path("api/blood-bank/",    include("apps.blood_bank.urls")),
    path("api/ambulance/",     include("apps.ambulance.urls")),
    path("api/dietary/",       include("apps.dietary.urls")),
    path("api/laundry/",       include("apps.laundry.urls")),
    path("api/gas-cylinder/",  include("apps.gas_cylinder.urls")),

    path("api/inventory/",     include("apps.inventory.urls")),
    path("api/assets/",        include("apps.assets.urls")),
    path("api/housekeeping/",  include("apps.housekeeping.urls")),

    path("api/hr/",         include("apps.hr.urls")),
    path("api/payroll/",    include("apps.payroll.urls")),
    path("api/attendance/", include("apps.attendance.urls")),
    path("api/security/",   include("apps.security_module.urls")),

    path("api/insurance/",   include("apps.insurance.urls")),
    path("api/vaccination/", include("apps.vaccination.urls")),
    path("api/complaints/",  include("apps.complaints.urls")),

    # Phase 4d — NEW
    path("api/analytics/",   include("apps.analytics.urls")),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
