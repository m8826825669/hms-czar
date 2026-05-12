"""
Go-live readiness service.

Runs a battery of operational checks and returns a structured report on
whether the system is ready for production cutover. Each check returns
{check, category, status, message, action}. Statuses:

  PASS    — all good
  WARN    — non-blocking but should review
  FAIL    — must be fixed before go-live

The check list is conservative — it surfaces likely gaps without making
strong assumptions, since not every deployment uses every module.
"""
from __future__ import annotations

from typing import Any

from django.apps import apps
from django.conf import settings
from django.contrib.auth import get_user_model
from django.db import connection


def _model(label):
    try:
        return apps.get_model(*label.split("."))
    except Exception:
        return None


def _row(check, category, status_, message, action=""):
    return {
        "check":    check,
        "category": category,
        "status":   status_,
        "message":  message,
        "action":   action,
    }


# ---------------------------------------------------------------------------
# Individual check helpers
# ---------------------------------------------------------------------------
def _check_db_connection():
    try:
        with connection.cursor() as cur:
            cur.execute("SELECT 1")
            cur.fetchone()
        return _row(
            "Database connectivity",
            "Infrastructure",
            "PASS",
            f"Connected to {connection.vendor} engine successfully.",
        )
    except Exception as exc:
        return _row(
            "Database connectivity",
            "Infrastructure",
            "FAIL",
            f"Could not connect to the database: {exc}",
            "Verify DB credentials in settings and that the DB server is reachable.",
        )


def _check_debug_off():
    if settings.DEBUG:
        return _row(
            "Debug mode disabled",
            "Security",
            "FAIL",
            "DEBUG is currently True — sensitive tracebacks would be exposed in production.",
            "Set DEBUG = False in production settings before go-live.",
        )
    return _row(
        "Debug mode disabled",
        "Security",
        "PASS",
        "DEBUG is False.",
    )


def _check_secret_key():
    sk = getattr(settings, "SECRET_KEY", "") or ""
    if not sk or "django-insecure" in sk or len(sk) < 40:
        return _row(
            "SECRET_KEY hardened",
            "Security",
            "FAIL",
            "SECRET_KEY is missing, the Django default, or shorter than 40 characters.",
            "Generate a fresh 50+ char SECRET_KEY and load it from an environment variable.",
        )
    return _row(
        "SECRET_KEY hardened",
        "Security",
        "PASS",
        "SECRET_KEY meets length and uniqueness checks.",
    )


def _check_allowed_hosts():
    hosts = getattr(settings, "ALLOWED_HOSTS", [])
    if not hosts or "*" in hosts:
        return _row(
            "ALLOWED_HOSTS restricted",
            "Security",
            "WARN",
            "ALLOWED_HOSTS is empty or contains '*'.",
            "Set ALLOWED_HOSTS to your exact production domains.",
        )
    return _row(
        "ALLOWED_HOSTS restricted",
        "Security",
        "PASS",
        f"Configured: {', '.join(hosts)}.",
    )


def _check_superuser():
    User = get_user_model()
    n = User.objects.filter(is_superuser=True).count()
    if n == 0:
        return _row(
            "Superuser exists",
            "Access",
            "FAIL",
            "No superuser is configured.",
            "Run `manage.py createsuperuser` before launch.",
        )
    return _row(
        "Superuser exists",
        "Access",
        "PASS",
        f"{n} superuser(s) configured.",
    )


def _check_hospital_configured():
    Hospital = _model("core.Hospital")
    if not Hospital:
        return _row(
            "Hospital record",
            "Master Data",
            "WARN",
            "core.Hospital model not found — running without multi-tenant scoping.",
        )
    n = Hospital.objects.count()
    if n == 0:
        return _row(
            "Hospital record",
            "Master Data",
            "FAIL",
            "No Hospital record exists.",
            "Create at least one Hospital before go-live.",
        )
    return _row(
        "Hospital record",
        "Master Data",
        "PASS",
        f"{n} hospital(s) configured.",
    )


def _check_departments():
    Dept = _model("department.Department")
    if not Dept:
        return _row("Departments seeded", "Master Data", "WARN", "department.Department model not installed.")
    n = Dept.objects.count()
    if n < 3:
        return _row(
            "Departments seeded",
            "Master Data",
            "WARN",
            f"Only {n} department(s) configured.",
            "Seed your departments (OPD, IPD, Pharmacy, Lab, etc.) before go-live.",
        )
    return _row("Departments seeded", "Master Data", "PASS", f"{n} departments configured.")


def _check_doctors():
    Specialist = _model("specialist.Doctor") or _model("specialist.Specialist")
    if not Specialist:
        return _row("Doctors registered", "Master Data", "WARN", "Specialist/Doctor model not installed.")
    n = Specialist.objects.count()
    if n == 0:
        return _row(
            "Doctors registered",
            "Master Data",
            "FAIL",
            "No doctors are registered.",
            "Onboard your doctors before go-live.",
        )
    return _row("Doctors registered", "Master Data", "PASS", f"{n} doctor(s) registered.")


def _check_services_catalog():
    Service = _model("billing.ServiceCatalog") or _model("billing.Service")
    if not Service:
        return _row("Service catalogue", "Billing", "WARN", "Service catalogue model not installed.")
    n = Service.objects.count()
    if n < 10:
        return _row(
            "Service catalogue",
            "Billing",
            "WARN",
            f"Only {n} service(s) defined.",
            "Populate the service catalogue with realistic charge codes.",
        )
    return _row("Service catalogue", "Billing", "PASS", f"{n} services priced.")


def _check_payment_gateway():
    rk = getattr(settings, "RAZORPAY_KEY_ID", "") or ""
    rs = getattr(settings, "RAZORPAY_KEY_SECRET", "") or ""
    if not (rk and rs):
        return _row(
            "Payment gateway configured",
            "Billing",
            "WARN",
            "Razorpay credentials not set.",
            "Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in environment.",
        )
    if rk.startswith("rzp_test_"):
        return _row(
            "Payment gateway configured",
            "Billing",
            "WARN",
            "Razorpay is in TEST mode.",
            "Switch to live Razorpay keys before accepting real payments.",
        )
    return _row("Payment gateway configured", "Billing", "PASS", "Razorpay live credentials detected.")


def _check_email():
    eh = getattr(settings, "EMAIL_HOST", "") or ""
    if not eh or "console" in str(getattr(settings, "EMAIL_BACKEND", "")):
        return _row(
            "Email delivery",
            "Notifications",
            "WARN",
            "Email backend is console / not configured.",
            "Configure SMTP credentials (or SES / SendGrid) and verify send.",
        )
    return _row("Email delivery", "Notifications", "PASS", f"Configured: {eh}.")


def _check_sms():
    sms_key = getattr(settings, "MSG91_AUTH_KEY", "") or getattr(settings, "MSG91_API_KEY", "") or ""
    if not sms_key:
        return _row(
            "SMS gateway",
            "Notifications",
            "WARN",
            "MSG91 credentials not configured.",
            "Set MSG91_AUTH_KEY and template IDs for OTP/notification SMS.",
        )
    return _row("SMS gateway", "Notifications", "PASS", "MSG91 key detected.")


def _check_redis():
    caches = getattr(settings, "CACHES", {}) or {}
    default = caches.get("default", {})
    backend = default.get("BACKEND", "")
    if "redis" in backend.lower():
        return _row("Redis cache backend", "Infrastructure", "PASS", "Redis cache backend in use.")
    return _row(
        "Redis cache backend",
        "Infrastructure",
        "WARN",
        f"Cache backend is `{backend or 'unset'}`.",
        "Switch to Redis for production caching and Celery broker.",
    )


def _check_celery():
    broker = getattr(settings, "CELERY_BROKER_URL", "") or ""
    if not broker:
        return _row(
            "Celery broker",
            "Infrastructure",
            "WARN",
            "CELERY_BROKER_URL is not set — async tasks will not run.",
            "Configure Celery broker (Redis) and start `celery -A config worker`.",
        )
    return _row("Celery broker", "Infrastructure", "PASS", f"Broker: {broker}.")


def _check_media_dir():
    mr = getattr(settings, "MEDIA_ROOT", "")
    if not mr:
        return _row(
            "Media root",
            "Storage",
            "WARN",
            "MEDIA_ROOT not configured.",
            "Configure persistent media storage (local volume or S3).",
        )
    return _row("Media root", "Storage", "PASS", f"MEDIA_ROOT = {mr}.")


def _check_patient_data():
    Patient = _model("core.Patient")
    if not Patient:
        return _row("Patient data", "Operational", "WARN", "Patient model not installed.")
    n = Patient.objects.count()
    if n == 0:
        return _row(
            "Patient data",
            "Operational",
            "WARN",
            "No patients have been registered yet.",
            "Pilot test with at least 50 patients before go-live.",
        )
    return _row("Patient data", "Operational", "PASS", f"{n} patients on record.")


def _check_inventory():
    Item = _model("inventory.InventoryItem") or _model("inventory.Item")
    if not Item:
        return _row("Inventory items", "Master Data", "WARN", "Inventory model not installed.")
    n = Item.objects.count()
    if n < 20:
        return _row(
            "Inventory items",
            "Master Data",
            "WARN",
            f"Only {n} inventory item(s) configured.",
            "Import your full item master before go-live.",
        )
    return _row("Inventory items", "Master Data", "PASS", f"{n} inventory items configured.")


def _check_pharmacy_stock():
    Batch = _model("pharmacy.Batch") or _model("pharmacy.MedicineBatch")
    if not Batch:
        return _row("Pharmacy stock", "Operational", "WARN", "Pharmacy batch model not installed.")
    n = Batch.objects.count()
    if n == 0:
        return _row(
            "Pharmacy stock",
            "Operational",
            "FAIL",
            "No pharmacy stock batches found.",
            "Load opening stock with batch numbers and expiry before go-live.",
        )
    return _row("Pharmacy stock", "Operational", "PASS", f"{n} pharmacy batch(es) in stock.")


def _check_payroll_components():
    Comp = _model("payroll.SalaryComponent")
    if not Comp:
        return _row("Salary structure", "HR/Payroll", "WARN", "Payroll module not installed.")
    n = Comp.objects.count()
    if n < 3:
        return _row(
            "Salary structure",
            "HR/Payroll",
            "WARN",
            f"Only {n} salary component(s) defined.",
            "Define your full earnings + deductions catalogue (BASIC, HRA, PF, ESI, TDS, PT).",
        )
    return _row("Salary structure", "HR/Payroll", "PASS", f"{n} salary components configured.")


def _check_backups():
    # Heuristic — most teams document this externally
    if getattr(settings, "BACKUP_PROVIDER", None):
        return _row("Backup strategy", "Operations", "PASS", "BACKUP_PROVIDER configured.")
    return _row(
        "Backup strategy",
        "Operations",
        "WARN",
        "No backup strategy is wired into settings.",
        "Document and automate nightly PostgreSQL backups + media sync to off-site storage.",
    )


def _check_logging():
    logging_cfg = getattr(settings, "LOGGING", None)
    if not logging_cfg:
        return _row(
            "Application logging",
            "Operations",
            "WARN",
            "LOGGING is not configured.",
            "Configure file or centralised logging (Loki / ELK / CloudWatch).",
        )
    return _row("Application logging", "Operations", "PASS", "LOGGING dict is configured.")


# ---------------------------------------------------------------------------
# Runner
# ---------------------------------------------------------------------------
ALL_CHECKS = [
    _check_db_connection,
    _check_debug_off,
    _check_secret_key,
    _check_allowed_hosts,
    _check_superuser,
    _check_hospital_configured,
    _check_departments,
    _check_doctors,
    _check_services_catalog,
    _check_payment_gateway,
    _check_email,
    _check_sms,
    _check_redis,
    _check_celery,
    _check_media_dir,
    _check_patient_data,
    _check_inventory,
    _check_pharmacy_stock,
    _check_payroll_components,
    _check_backups,
    _check_logging,
]


def run_checks(hospital_id: int | None = None) -> dict[str, Any]:
    """Run every check and return the structured report."""
    rows = []
    for fn in ALL_CHECKS:
        try:
            rows.append(fn())
        except Exception as exc:  # pragma: no cover
            rows.append(_row(fn.__name__, "Unknown", "FAIL", f"Check raised: {exc}"))

    summary = {
        "total":  len(rows),
        "pass":   sum(1 for r in rows if r["status"] == "PASS"),
        "warn":   sum(1 for r in rows if r["status"] == "WARN"),
        "fail":   sum(1 for r in rows if r["status"] == "FAIL"),
    }
    summary["ready_for_golive"] = summary["fail"] == 0
    summary["readiness_pct"] = round(100.0 * summary["pass"] / summary["total"], 1) if summary["total"] else 0.0

    return {
        "summary": summary,
        "rows":    rows,
    }
