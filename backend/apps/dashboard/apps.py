from django.apps import AppConfig


class DashboardConfig(AppConfig):
    """Read-only aggregator app — no models of its own.

    Pulls live numbers from opd, ipd, ot, billing, lab, pharmacy, reception,
    blood_bank and inventory to feed the executive dashboard.
    """
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.dashboard"
    verbose_name = "Dashboard (executive)"
