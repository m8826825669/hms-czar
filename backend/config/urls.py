"""
URL configuration for HMS — Phase 3a (with OT + Blood Bank).

═════════════════════════════════════════════════════════════════════════════
IMPORTANT — read before applying:
═════════════════════════════════════════════════════════════════════════════
This file is the cumulative root URL config covering Phases 1a-3a.

If your existing config/urls.py has been customized (e.g. extra app routes,
custom auth endpoints, debug toolbar), DO NOT replace it wholesale. Instead:

1. Back up your current file:
       cp backend/config/urls.py backend/config/urls.py.phase2c.bak
   (or on Windows cmd: copy backend\\config\\urls.py backend\\config\\urls.py.phase2c.bak)

2. Add only these two lines to your existing urlpatterns list:
       path("api/ot/",          include("apps.ot.urls")),
       path("api/blood-bank/",  include("apps.blood_bank.urls")),

3. Skip the rest of this file.

If you have a clean Phase 2c install with no customizations, you can drop
this file in directly.

(Path separators above use forward-slash for portability; on Windows use
your shell's native path separator.)
═════════════════════════════════════════════════════════════════════════════
"""
from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static


urlpatterns = [
    path("admin/", admin.site.urls),

    # Auth + accounts
    path("api/auth/", include("apps.accounts.urls")),

    # Core domain (hospitals, patients, audit)
    path("api/core/", include("apps.core.urls")),

    # Phase 1a — notifications + specialist + reception
    path("api/notifications/", include("apps.notifications.urls")),
    path("api/specialist/",    include("apps.specialist.urls")),
    path("api/reception/",     include("apps.reception.urls")),

    # Phase 1b — OPD + EMR
    path("api/opd/", include("apps.opd.urls")),
    path("api/emr/", include("apps.emr.urls")),

    # Phase 1c — billing + public
    path("api/billing/", include("apps.billing.urls")),
    path("api/public/",  include("apps.public.urls")),

    # Phase 2a — department + pharmacy
    path("api/departments/", include("apps.department.urls")),
    path("api/pharmacy/",    include("apps.pharmacy.urls")),

    # Phase 2b — lab
    path("api/lab/", include("apps.lab.urls")),

    # Phase 2c — IPD + reports
    path("api/ipd/",     include("apps.ipd.urls")),
    path("api/reports/", include("apps.reports.urls")),

    # Phase 3a — OT + Blood Bank  ← NEW
    path("api/ot/",          include("apps.ot.urls")),
    path("api/blood-bank/",  include("apps.blood_bank.urls")),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
