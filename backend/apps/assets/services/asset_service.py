"""Asset management service."""
from __future__ import annotations
from decimal import Decimal
from datetime import timedelta
from django.core.exceptions import ValidationError
from django.db import transaction
from django.db.models import Q, Sum
from django.utils import timezone

from ..models import Asset, AssetMaintenanceLog, AMC, AssetDisposal


def _gen_asset_code(hospital):
    today = timezone.now().date()
    prefix = f"ASSET-{today.strftime('%Y%m%d')}-"
    last = (Asset.objects.filter(hospital=hospital, asset_code__startswith=prefix)
            .order_by("-asset_code").first())
    if last:
        try:
            n = int(last.asset_code.split("-")[-1]) + 1
        except (ValueError, IndexError):
            n = 1
    else:
        n = 1
    return f"{prefix}{n:04d}"


@transaction.atomic
def register_asset(*, hospital, name, category, **extra):
    asset = Asset.objects.create(
        hospital=hospital,
        asset_code=_gen_asset_code(hospital),
        name=name, category=category,
        description=extra.get("description", ""),
        serial_number=extra.get("serial_number", ""),
        model_number=extra.get("model_number", ""),
        manufacturer=extra.get("manufacturer", ""),
        barcode=extra.get("barcode", ""),
        purchase_date=extra.get("purchase_date"),
        purchase_cost=Decimal(str(extra.get("purchase_cost", 0))),
        invoice_number=extra.get("invoice_number", ""),
        supplier_name=extra.get("supplier_name", ""),
        depreciation_pct=Decimal(str(extra.get("depreciation_pct",
                                                  category.default_depreciation_pct))),
        salvage_value=Decimal(str(extra.get("salvage_value", 0))),
        useful_life_years=extra.get("useful_life_years", 10),
        warranty_start_date=extra.get("warranty_start_date"),
        warranty_end_date=extra.get("warranty_end_date"),
        department=extra.get("department"),
        location=extra.get("location", ""),
        custodian=extra.get("custodian"),
        status="ACTIVE",
        condition=extra.get("condition", "GOOD"),
        notes=extra.get("notes", ""),
    )
    return asset


@transaction.atomic
def schedule_maintenance(asset: Asset, *, scheduled_date, maintenance_type,
                          description: str, **extra) -> AssetMaintenanceLog:
    if asset.status == "DISPOSED":
        raise ValidationError("Cannot schedule maintenance for disposed asset.")
    log = AssetMaintenanceLog.objects.create(
        asset=asset,
        maintenance_type=maintenance_type,
        scheduled_date=scheduled_date,
        description=description,
        cost=Decimal(str(extra.get("cost", 0))),
        vendor_name=extra.get("vendor_name", ""),
        technician_name=extra.get("technician_name", ""),
        is_under_amc=extra.get("is_under_amc", False),
        performed_by=extra.get("performed_by"),
        notes=extra.get("notes", ""),
        status="SCHEDULED",
    )
    return log


@transaction.atomic
def complete_maintenance(log: AssetMaintenanceLog, *, work_performed: str,
                          parts_replaced: str = "", cost: Decimal = None,
                          next_due_date=None) -> AssetMaintenanceLog:
    if log.status == "COMPLETED":
        raise ValidationError("Maintenance already completed.")

    log.work_performed = work_performed
    log.parts_replaced = parts_replaced
    if cost is not None:
        log.cost = cost
    log.completed_at = timezone.now()
    log.status = "COMPLETED"
    log.next_due_date = next_due_date
    log.save()

    # Update asset
    log.asset.last_maintenance_date = timezone.localdate()
    log.asset.next_maintenance_date = next_due_date
    if log.asset.status == "UNDER_REPAIR":
        log.asset.status = "ACTIVE"
    log.asset.save(update_fields=["last_maintenance_date", "next_maintenance_date",
                                    "status", "updated_at"])
    return log


@transaction.atomic
def dispose_asset(asset: Asset, *, disposal_date, disposal_type, reason,
                    sale_value=Decimal("0"), recipient="", approved_by=None,
                    certificate_reference="") -> AssetDisposal:
    if asset.status == "DISPOSED":
        raise ValidationError("Asset already disposed.")

    disposal = AssetDisposal.objects.create(
        asset=asset, disposal_date=disposal_date,
        disposal_type=disposal_type, reason=reason,
        sale_value=sale_value, recipient=recipient,
        approved_by=approved_by, certificate_reference=certificate_reference,
    )
    asset.status = "DISPOSED"
    asset.save(update_fields=["status", "updated_at"])
    return disposal


def get_dashboard_metrics(hospital):
    """High-level metrics for asset dashboard."""
    today = timezone.localdate()
    upcoming_30 = today + timedelta(days=30)
    expiring_amcs = AMC.objects.filter(
        asset__hospital=hospital, status="ACTIVE",
        end_date__lte=upcoming_30, end_date__gte=today,
    ).count()

    maintenance_due = Asset.objects.filter(
        hospital=hospital, status="ACTIVE",
        next_maintenance_date__lte=upcoming_30,
        next_maintenance_date__gte=today,
    ).count()

    total_value = (Asset.objects.filter(hospital=hospital)
                   .exclude(status="DISPOSED")
                   .aggregate(s=Sum("purchase_cost"))["s"] or Decimal("0"))

    by_status = dict(
        Asset.objects.filter(hospital=hospital)
        .values_list("status").annotate(c=Sum(1)).values_list("status", "c"),
    )

    by_category = list(
        Asset.objects.filter(hospital=hospital).exclude(status="DISPOSED")
        .values("category__code", "category__name")
        .annotate(count=Sum(1), value=Sum("purchase_cost"))
        .order_by("category__code"),
    )

    return {
        "total_assets": Asset.objects.filter(hospital=hospital).count(),
        "active_assets": Asset.objects.filter(hospital=hospital, status="ACTIVE").count(),
        "under_repair": Asset.objects.filter(hospital=hospital,
                                               status="UNDER_REPAIR").count(),
        "disposed": Asset.objects.filter(hospital=hospital, status="DISPOSED").count(),
        "total_book_value": str(total_value),
        "amcs_expiring_30d": expiring_amcs,
        "maintenance_due_30d": maintenance_due,
        "by_status": by_status,
        "by_category": by_category,
    }
