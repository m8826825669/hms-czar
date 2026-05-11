"""
Asset Register module — Phase 4a.

Models:
  • AssetCategory          — equipment / furniture / IT / vehicle / etc.
  • Asset                  — individual asset with serial + lifecycle
  • AssetMaintenanceLog    — service / repair / breakdown log
  • AMC                    — annual maintenance contract
  • AssetDisposal          — disposal / write-off record
"""
from decimal import Decimal
from django.db import models
from django.utils import timezone


class AssetCategory(models.Model):
    CATEGORIES = [
        ("MEDICAL_EQUIP", "Medical Equipment"),
        ("IT_HARDWARE",   "IT Hardware"),
        ("FURNITURE",     "Furniture & Fixtures"),
        ("VEHICLE",       "Vehicle"),
        ("BUILDING",      "Building / Infrastructure"),
        ("OFFICE_EQUIP",  "Office Equipment"),
        ("LAB_EQUIP",     "Laboratory Equipment"),
        ("KITCHEN_EQUIP", "Kitchen Equipment"),
        ("OTHER",         "Other"),
    ]
    hospital = models.ForeignKey("core.Hospital", on_delete=models.CASCADE,
                                  related_name="asset_categories")
    code = models.CharField(max_length=20, db_index=True)
    name = models.CharField(max_length=120)
    category_type = models.CharField(max_length=15, choices=CATEGORIES)
    default_depreciation_pct = models.DecimalField(
        max_digits=5, decimal_places=2, default=Decimal("10.00"),
        help_text="Annual depreciation %, used if not overridden on asset")
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["category_type", "code"]
        unique_together = [["hospital", "code"]]
        verbose_name_plural = "Asset Categories"

    def __str__(self):
        return f"{self.code} — {self.name}"


class Asset(models.Model):
    STATUSES = [
        ("ACTIVE",       "Active / In Use"),
        ("UNDER_REPAIR", "Under Repair"),
        ("MAINTENANCE",  "Under Maintenance"),
        ("IDLE",         "Idle / Reserve"),
        ("DISPOSED",     "Disposed"),
        ("LOST",         "Lost / Stolen"),
    ]
    CONDITIONS = [
        ("EXCELLENT", "Excellent"),
        ("GOOD",      "Good"),
        ("FAIR",      "Fair"),
        ("POOR",      "Poor"),
        ("NON_FUNCTIONAL", "Non-functional"),
    ]

    hospital = models.ForeignKey("core.Hospital", on_delete=models.CASCADE,
                                  related_name="assets")
    asset_code = models.CharField(max_length=30, unique=True, db_index=True,
        help_text="Auto-generated, e.g. ASSET-20260508-0001")
    name = models.CharField(max_length=200)
    category = models.ForeignKey(AssetCategory, on_delete=models.PROTECT,
                                   related_name="assets")
    description = models.TextField(blank=True, default="")

    # Identification
    serial_number = models.CharField(max_length=80, blank=True, default="", db_index=True)
    model_number = models.CharField(max_length=80, blank=True, default="")
    manufacturer = models.CharField(max_length=120, blank=True, default="")
    barcode = models.CharField(max_length=80, blank=True, default="")

    # Purchase
    purchase_date = models.DateField(null=True, blank=True)
    purchase_cost = models.DecimalField(max_digits=14, decimal_places=2,
                                          default=Decimal("0"))
    invoice_number = models.CharField(max_length=50, blank=True, default="")
    supplier_name = models.CharField(max_length=200, blank=True, default="")

    # Depreciation
    depreciation_pct = models.DecimalField(max_digits=5, decimal_places=2,
                                              default=Decimal("10.00"),
        help_text="Annual depreciation %")
    salvage_value = models.DecimalField(max_digits=14, decimal_places=2,
                                          default=Decimal("0"))
    useful_life_years = models.PositiveIntegerField(default=10)

    # Warranty
    warranty_start_date = models.DateField(null=True, blank=True)
    warranty_end_date = models.DateField(null=True, blank=True)

    # Location
    department = models.ForeignKey(
        "department.Department", on_delete=models.SET_NULL,
        null=True, blank=True, related_name="assets",
    )
    location = models.CharField(max_length=200, blank=True, default="")
    custodian = models.ForeignKey("accounts.User", on_delete=models.SET_NULL,
                                     null=True, blank=True, related_name="custodian_of_assets")

    # Status
    status = models.CharField(max_length=15, choices=STATUSES, default="ACTIVE",
                                db_index=True)
    condition = models.CharField(max_length=15, choices=CONDITIONS, default="GOOD")

    last_maintenance_date = models.DateField(null=True, blank=True)
    next_maintenance_date = models.DateField(null=True, blank=True, db_index=True)

    notes = models.TextField(blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["asset_code"]
        indexes = [
            models.Index(fields=["status", "category"]),
            models.Index(fields=["department"]),
        ]

    def __str__(self):
        return f"{self.asset_code} — {self.name}"

    @property
    def is_under_warranty(self):
        if not self.warranty_end_date:
            return False
        return self.warranty_end_date >= timezone.localdate()

    @property
    def age_years(self):
        if not self.purchase_date:
            return 0
        today = timezone.localdate()
        return (today - self.purchase_date).days / 365.25

    @property
    def book_value(self):
        """Straight-line depreciation."""
        if not self.purchase_cost or not self.purchase_date:
            return Decimal("0")
        years = Decimal(str(self.age_years))
        annual_dep = self.purchase_cost * self.depreciation_pct / Decimal("100")
        accumulated = annual_dep * years
        residual = self.purchase_cost - accumulated
        return max(residual, self.salvage_value)


class AssetMaintenanceLog(models.Model):
    MAINTENANCE_TYPES = [
        ("PREVENTIVE",  "Preventive Maintenance"),
        ("BREAKDOWN",   "Breakdown / Repair"),
        ("CALIBRATION", "Calibration"),
        ("INSPECTION",  "Inspection"),
        ("WARRANTY",    "Warranty Service"),
        ("UPGRADE",     "Upgrade / Modification"),
    ]
    STATUSES = [
        ("SCHEDULED",   "Scheduled"),
        ("IN_PROGRESS", "In Progress"),
        ("COMPLETED",   "Completed"),
        ("CANCELLED",   "Cancelled"),
    ]

    asset = models.ForeignKey(Asset, on_delete=models.CASCADE,
                                 related_name="maintenance_logs")
    maintenance_type = models.CharField(max_length=15, choices=MAINTENANCE_TYPES,
                                           default="PREVENTIVE")
    status = models.CharField(max_length=12, choices=STATUSES, default="SCHEDULED")

    scheduled_date = models.DateField()
    started_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)

    description = models.CharField(max_length=300)
    work_performed = models.TextField(blank=True, default="")
    parts_replaced = models.TextField(blank=True, default="")

    cost = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0"))
    vendor_name = models.CharField(max_length=200, blank=True, default="")
    technician_name = models.CharField(max_length=120, blank=True, default="")

    next_due_date = models.DateField(null=True, blank=True)
    is_under_amc = models.BooleanField(default=False)

    performed_by = models.ForeignKey("accounts.User", on_delete=models.SET_NULL,
                                        null=True, blank=True,
                                        related_name="maintenance_performed")
    notes = models.TextField(blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-scheduled_date"]
        indexes = [
            models.Index(fields=["status", "scheduled_date"]),
        ]


class AMC(models.Model):
    """Annual Maintenance Contract for an asset."""
    STATUSES = [
        ("ACTIVE",   "Active"),
        ("EXPIRED",  "Expired"),
        ("RENEWED",  "Renewed"),
        ("CANCELLED","Cancelled"),
    ]

    asset = models.ForeignKey(Asset, on_delete=models.CASCADE, related_name="amcs")
    contract_number = models.CharField(max_length=50, db_index=True)
    vendor_name = models.CharField(max_length=200)
    vendor_contact = models.CharField(max_length=120, blank=True, default="")

    start_date = models.DateField()
    end_date = models.DateField()
    contract_value = models.DecimalField(max_digits=12, decimal_places=2,
                                            default=Decimal("0"))

    coverage_details = models.TextField(blank=True, default="")
    excluded_items = models.TextField(blank=True, default="")
    visit_frequency = models.CharField(max_length=50, blank=True, default="",
        help_text="e.g. 'Quarterly', 'Monthly', '4 visits/year'")

    status = models.CharField(max_length=12, choices=STATUSES, default="ACTIVE")
    notes = models.TextField(blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-start_date"]
        verbose_name = "AMC"
        verbose_name_plural = "AMCs"

    @property
    def is_active(self):
        today = timezone.localdate()
        return self.start_date <= today <= self.end_date

    @property
    def days_to_expiry(self):
        return (self.end_date - timezone.localdate()).days


class AssetDisposal(models.Model):
    DISPOSAL_TYPES = [
        ("SCRAP",      "Scrapped"),
        ("SOLD",       "Sold"),
        ("DONATED",    "Donated"),
        ("LOST",       "Lost"),
        ("DAMAGED",    "Damaged Beyond Repair"),
        ("TRANSFERRED","Transferred (External)"),
    ]

    asset = models.OneToOneField(Asset, on_delete=models.CASCADE,
                                    related_name="disposal")
    disposal_date = models.DateField()
    disposal_type = models.CharField(max_length=15, choices=DISPOSAL_TYPES)
    sale_value = models.DecimalField(max_digits=12, decimal_places=2,
                                        default=Decimal("0"))
    recipient = models.CharField(max_length=200, blank=True, default="")
    reason = models.TextField()
    approved_by = models.ForeignKey("accounts.User", on_delete=models.SET_NULL,
                                       null=True, blank=True,
                                       related_name="approved_disposals")
    certificate_reference = models.CharField(max_length=80, blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)
