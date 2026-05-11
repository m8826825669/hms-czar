"""
URL configuration for HMS — Phase 3b (with Ambulance + Dietary + Laundry + Gas Cylinder).

═════════════════════════════════════════════════════════════════════════════
IMPORTANT — read before applying:
═════════════════════════════════════════════════════════════════════════════
If your existing config/urls.py is customized, DO NOT replace wholesale.

Back up first:
    cp backend/config/urls.py backend/config/urls.py.phase3a.bak

Then add only these four lines to your urlpatterns list:
    path("api/ambulance/",      include("apps.ambulance.urls")),
    path("api/dietary/",        include("apps.dietary.urls")),
    path("api/laundry/",        include("apps.laundry.urls")),
    path("api/gas-cylinder/",   include("apps.gas_cylinder.urls")),

If clean Phase 3a install, this file is a safe drop-in.
═════════════════════════════════════════════════════════════════════════════
"""
from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static


urlpatterns = [
    path("admin/", admin.site.urls),

    # Phases 1a-1c — accounts, core, notifications, specialist, reception, opd, emr, billing, public
    path("api/auth/",          include("apps.accounts.urls")),
    path("api/core/",          include("apps.core.urls")),
    path("api/notifications/", include("apps.notifications.urls")),
    path("api/specialist/",    include("apps.specialist.urls")),
    path("api/reception/",     include("apps.reception.urls")),
    path("api/opd/",           include("apps.opd.urls")),
    path("api/emr/",           include("apps.emr.urls")),
    path("api/billing/",       include("apps.billing.urls")),
    path("api/public/",        include("apps.public.urls")),

    # Phase 2a-2c — departments, pharmacy, lab, ipd, reports
    path("api/departments/", include("apps.department.urls")),
    path("api/pharmacy/",    include("apps.pharmacy.urls")),
    path("api/lab/",         include("apps.lab.urls")),
    path("api/ipd/",         include("apps.ipd.urls")),
   # path("api/reports/",     include("apps.reports.urls")),

    # Phase 3a — OT + Blood Bank
    path("api/ot/",          include("apps.ot.urls")),
    path("api/blood-bank/",  include("apps.blood_bank.urls")),

    # Phase 3b — Ambulance + Dietary + Laundry + Gas Cylinder  ← NEW
    path("api/ambulance/",     include("apps.ambulance.urls")),
    path("api/dietary/",       include("apps.dietary.urls")),
    path("api/laundry/",       include("apps.laundry.urls")),
    path("api/gas-cylinder/",  include("apps.gas_cylinder.urls")),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
