"""
Laundry / Linen module — Phase 3b.

Models:
  • LinenItem     — catalog of laundry items (bedsheets, scrubs, gowns, etc.)
  • LinenStock    — current stock by item × department/ward
  • LaundryBatch  — pickup/dispatch/return batch with tracking
  • LaundryBatchItem  — items in a batch with counts (sent vs received)
  • LinenLoss     — damaged / lost / discarded items log
"""
from decimal import Decimal
from django.db import models
from django.utils import timezone


class LinenItem(models.Model):
    CATEGORIES = [
        ("BEDSHEET",   "Bedsheet"),
        ("PILLOW",     "Pillow Cover"),
        ("BLANKET",    "Blanket"),
        ("TOWEL",      "Towel"),
        ("GOWN",       "Patient Gown"),
        ("SCRUB",      "Surgical Scrubs"),
        ("OT_DRAPE",   "OT Drape / Sheet"),
        ("CURTAIN",    "Curtain / Privacy Screen"),
        ("UNIFORM",    "Staff Uniform"),
        ("OTHER",      "Other"),
    ]

    hospital = models.ForeignKey("core.Hospital", on_delete=models.CASCADE,
                                  related_name="linen_items")
    code = models.CharField(max_length=20, db_index=True)
    name = models.CharField(max_length=120)
    category = models.CharField(max_length=15, choices=CATEGORIES)
    color = models.CharField(max_length=30, blank=True, default="")
    size = models.CharField(max_length=30, blank=True, default="",
        help_text="e.g. 'S/M/L', '90x190 cm'")

    cost_per_unit = models.DecimalField(max_digits=8, decimal_places=2, default=Decimal("0"))
    laundry_cost_per_wash = models.DecimalField(
        max_digits=6, decimal_places=2, default=Decimal("0"),
        help_text="Per-cycle outsourced/in-house laundry cost",
    )
    expected_lifetime_washes = models.PositiveIntegerField(default=100)

    is_active = models.BooleanField(default=True)
    notes = models.CharField(max_length=300, blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["category", "code"]
        unique_together = [["hospital", "code"]]

    def __str__(self):
        return f"{self.code} — {self.name}"


class LinenStock(models.Model):
    """Current circulating stock of an item, scoped to a department or ward."""
    hospital = models.ForeignKey("core.Hospital", on_delete=models.CASCADE,
                                  related_name="linen_stock")
    item = models.ForeignKey(LinenItem, on_delete=models.CASCADE,
                              related_name="stock_entries")
    department = models.ForeignKey(
        "department.Department", on_delete=models.CASCADE,
        null=True, blank=True, related_name="linen_stock",
    )
    ward_label = models.CharField(max_length=80, blank=True, default="",
        help_text="Free-text ward/floor when no Department FK")

    total_units = models.PositiveIntegerField(default=0,
        help_text="Total units allocated to this location")
    in_use = models.PositiveIntegerField(default=0)
    in_laundry = models.PositiveIntegerField(default=0)
    clean_in_stock = models.PositiveIntegerField(default=0)

    minimum_threshold = models.PositiveIntegerField(default=10,
        help_text="Trigger reorder alert below this")
    last_audit_date = models.DateField(null=True, blank=True)

    notes = models.CharField(max_length=300, blank=True, default="")
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["item__category", "department"]
        unique_together = [["item", "department", "ward_label"]]


class LaundryBatch(models.Model):
    STATUSES = [
        ("CREATED",   "Created (Pickup pending)"),
        ("PICKED_UP", "Picked Up"),
        ("WASHING",   "At Laundry / Washing"),
        ("READY",     "Ready for Return"),
        ("RETURNED",  "Returned / Received"),
        ("CANCELLED", "Cancelled"),
    ]
    BATCH_TYPES = [
        ("OUTSOURCED",  "Outsourced Laundry"),
        ("IN_HOUSE",    "In-house Laundry"),
    ]

    hospital = models.ForeignKey("core.Hospital", on_delete=models.CASCADE,
                                  related_name="laundry_batches")
    code = models.CharField(max_length=30, unique=True, db_index=True,
        help_text="Auto-generated, e.g. LB-20260508-0001")
    batch_type = models.CharField(max_length=15, choices=BATCH_TYPES,
                                   default="OUTSOURCED")

    source_department = models.ForeignKey(
        "department.Department", on_delete=models.SET_NULL,
        null=True, blank=True, related_name="laundry_batches_source",
    )
    source_ward_label = models.CharField(max_length=80, blank=True, default="")

    vendor_name = models.CharField(max_length=120, blank=True, default="",
        help_text="External laundry vendor (when OUTSOURCED)")
    vendor_contact = models.CharField(max_length=80, blank=True, default="")

    pickup_at = models.DateTimeField(null=True, blank=True)
    expected_return_at = models.DateTimeField(null=True, blank=True)
    returned_at = models.DateTimeField(null=True, blank=True)

    status = models.CharField(max_length=12, choices=STATUSES, default="CREATED",
                               db_index=True)

    total_cost = models.DecimalField(max_digits=10, decimal_places=2,
                                       default=Decimal("0"))
    notes = models.TextField(blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["status"]),
        ]

    def __str__(self):
        return f"{self.code} ({self.get_status_display()})"


class LaundryBatchItem(models.Model):
    batch = models.ForeignKey(LaundryBatch, on_delete=models.CASCADE,
                               related_name="items")
    item = models.ForeignKey(LinenItem, on_delete=models.PROTECT,
                              related_name="batch_entries")
    quantity_sent = models.PositiveIntegerField(default=0)
    quantity_received = models.PositiveIntegerField(default=0)
    quantity_lost = models.PositiveIntegerField(default=0)
    quantity_damaged = models.PositiveIntegerField(default=0)

    cost_per_unit = models.DecimalField(max_digits=6, decimal_places=2,
                                          default=Decimal("0"))
    line_cost = models.DecimalField(max_digits=10, decimal_places=2,
                                      default=Decimal("0"))

    notes = models.CharField(max_length=200, blank=True, default="")

    class Meta:
        ordering = ["item__category"]
        unique_together = [["batch", "item"]]

    @property
    def discrepancy(self):
        """Sent vs (received + lost + damaged) — should be 0 if reconciled."""
        return self.quantity_sent - (
            self.quantity_received + self.quantity_lost + self.quantity_damaged
        )

    def save(self, *args, **kwargs):
        self.line_cost = (Decimal(self.quantity_sent) * self.cost_per_unit).quantize(Decimal("0.01"))
        super().save(*args, **kwargs)


class LinenLoss(models.Model):
    """Damaged / lost / discarded units logged separately for audit."""
    LOSS_TYPES = [
        ("DAMAGED",   "Damaged"),
        ("LOST",      "Lost / Stolen"),
        ("END_OF_LIFE","End of Life (worn out)"),
        ("CONTAMINATED","Contaminated"),
    ]

    hospital = models.ForeignKey("core.Hospital", on_delete=models.CASCADE,
                                  related_name="linen_losses")
    item = models.ForeignKey(LinenItem, on_delete=models.PROTECT,
                              related_name="losses")
    loss_type = models.CharField(max_length=15, choices=LOSS_TYPES)
    quantity = models.PositiveIntegerField(default=1)

    department = models.ForeignKey(
        "department.Department", on_delete=models.SET_NULL,
        null=True, blank=True, related_name="linen_losses",
    )
    batch = models.ForeignKey(LaundryBatch, on_delete=models.SET_NULL,
                               null=True, blank=True, related_name="losses")

    cost_impact = models.DecimalField(max_digits=10, decimal_places=2,
                                        default=Decimal("0"))
    reason = models.CharField(max_length=300, blank=True, default="")
    reported_by = models.ForeignKey("accounts.User", on_delete=models.SET_NULL,
                                      null=True, blank=True)
    reported_at = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ["-reported_at"]
