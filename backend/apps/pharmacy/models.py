"""Pharmacy module models.

DrugBatch         : per-batch inventory (batch_no, expiry, qty, MRP). One drug
                    can have many batches with different expiry dates.
StockMovement     : ledger of every IN/OUT/ADJUSTMENT — used for audit + reports.
PharmacyOrder     : a dispensing event (one per patient/Rx). Optionally linked
                    to a Prescription. Generates an Invoice automatically.
PharmacyOrderItem : line item on the order, tied to a specific batch (FEFO).

Inventory model:
- Stock IN  → DrugBatch.qty_in_stock += received_qty + creates StockMovement(PURCHASE_IN)
- Stock OUT → DrugBatch.qty_in_stock -= dispensed_qty + creates StockMovement(DISPENSE_OUT)
- All decrements honor FEFO (First Expiry First Out) across batches.
"""
from decimal import Decimal
from django.db import models
from django.utils import timezone
from apps.core.models import TenantBaseModel


def _q(amount):
    """Round to 2dp."""
    return Decimal(amount).quantize(Decimal("0.01"))


class DrugBatch(TenantBaseModel):
    """A single batch (lot) of a drug. Tracks expiry + on-hand quantity."""
    drug = models.ForeignKey(
        "opd.DrugMaster", on_delete=models.PROTECT, related_name="batches",
    )
    batch_no = models.CharField(max_length=50, db_index=True,
        help_text="Manufacturer batch number printed on the strip/box")
    mfg_date = models.DateField(null=True, blank=True)
    expiry_date = models.DateField(db_index=True)

    qty_purchased = models.PositiveIntegerField(default=0,
        help_text="Original received quantity")
    qty_in_stock = models.PositiveIntegerField(default=0,
        help_text="Current on-hand. Decremented on dispense / adjustment")

    purchase_price = models.DecimalField(max_digits=10, decimal_places=2,
                                          default=Decimal("0.00"),
        help_text="Cost from supplier (per unit, pre-GST)")
    mrp = models.DecimalField(max_digits=10, decimal_places=2,
        help_text="Maximum Retail Price (per unit, GST-inclusive). Selling price.")

    supplier_name = models.CharField(max_length=200, blank=True)
    supplier_invoice_no = models.CharField(max_length=50, blank=True)
    received_at = models.DateField(default=timezone.localdate, db_index=True)

    # Denormalized from drug for quick reporting
    hsn_code = models.CharField(max_length=8, blank=True)
    gst_rate = models.DecimalField(max_digits=5, decimal_places=2,
                                    default=Decimal("12.00"))

    notes = models.TextField(blank=True)

    class Meta:
        unique_together = [("hospital", "drug", "batch_no")]
        ordering = ["expiry_date", "received_at"]
        indexes = [
            models.Index(fields=["drug", "expiry_date"]),
            models.Index(fields=["expiry_date", "qty_in_stock"]),
        ]
        verbose_name_plural = "Drug batches"

    def __str__(self):
        return f"{self.drug} | {self.batch_no} (exp {self.expiry_date}, {self.qty_in_stock} units)"

    @property
    def is_expired(self):
        return self.expiry_date < timezone.localdate()

    @property
    def is_near_expiry(self):
        """True if within 90 days of expiry."""
        days_left = (self.expiry_date - timezone.localdate()).days
        return 0 <= days_left <= 90


class StockMovement(TenantBaseModel):
    """Ledger entry for every stock change. Immutable audit trail."""
    TYPES = [
        ("PURCHASE_IN", "Purchase received"),
        ("DISPENSE_OUT", "Dispensed to patient"),
        ("RETURN_IN", "Patient return"),
        ("EXPIRED_OUT", "Removed (expired)"),
        ("DAMAGED_OUT", "Removed (damaged)"),
        ("ADJUSTMENT_IN", "Manual adjustment +"),
        ("ADJUSTMENT_OUT", "Manual adjustment −"),
    ]

    drug = models.ForeignKey("opd.DrugMaster", on_delete=models.PROTECT,
                             related_name="movements")
    batch = models.ForeignKey(DrugBatch, on_delete=models.PROTECT,
                              null=True, blank=True, related_name="movements")
    movement_type = models.CharField(max_length=14, choices=TYPES)
    quantity = models.PositiveIntegerField()
    moved_at = models.DateTimeField(default=timezone.now, db_index=True)

    # Optional reference (pharmacy order, purchase, etc.)
    reference_type = models.CharField(max_length=30, blank=True,
        help_text="e.g. 'pharmacy_order', 'manual'")
    reference_id = models.CharField(max_length=40, blank=True)

    notes = models.CharField(max_length=200, blank=True)

    class Meta:
        ordering = ["-moved_at"]
        indexes = [
            models.Index(fields=["drug", "-moved_at"]),
            models.Index(fields=["movement_type", "-moved_at"]),
        ]

    def __str__(self):
        return f"{self.movement_type} {self.quantity} of {self.drug} @ {self.moved_at:%Y-%m-%d}"


class PharmacyOrder(TenantBaseModel):
    """A pharmacy sale / dispensing event. Generates an Invoice on completion."""
    STATUSES = [
        ("DRAFT", "Draft"),
        ("COMPLETED", "Completed"),
        ("CANCELLED", "Cancelled"),
    ]

    code = models.CharField(max_length=20, db_index=True,
        help_text="Auto e.g. PHARM-20260507-0001")
    order_date = models.DateField(default=timezone.localdate, db_index=True)

    patient = models.ForeignKey("core.Patient", on_delete=models.PROTECT,
                                related_name="pharmacy_orders")
    prescription = models.ForeignKey(
        "opd.Prescription", on_delete=models.SET_NULL,
        null=True, blank=True, related_name="pharmacy_orders",
    )
    consultation = models.ForeignKey(
        "opd.Consultation", on_delete=models.SET_NULL,
        null=True, blank=True, related_name="pharmacy_orders",
    )

    # Money fields - pre-link to billing
    subtotal = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    discount_amount = models.DecimalField(max_digits=10, decimal_places=2,
                                          default=Decimal("0.00"))
    cgst_amount = models.DecimalField(max_digits=10, decimal_places=2,
                                      default=Decimal("0.00"))
    sgst_amount = models.DecimalField(max_digits=10, decimal_places=2,
                                      default=Decimal("0.00"))
    igst_amount = models.DecimalField(max_digits=10, decimal_places=2,
                                      default=Decimal("0.00"))
    total_amount = models.DecimalField(max_digits=12, decimal_places=2,
                                        default=Decimal("0.00"))

    invoice = models.OneToOneField(
        "billing.Invoice", on_delete=models.SET_NULL,
        null=True, blank=True, related_name="pharmacy_order",
    )

    status = models.CharField(max_length=10, choices=STATUSES, default="DRAFT", db_index=True)
    dispensed_at = models.DateTimeField(null=True, blank=True)

    notes = models.TextField(blank=True)

    class Meta:
        unique_together = [("hospital", "code")]
        ordering = ["-order_date", "-created_at"]
        indexes = [
            models.Index(fields=["patient", "-order_date"]),
            models.Index(fields=["status", "-order_date"]),
        ]

    def __str__(self):
        return f"{self.code} ({self.patient}) ₹{self.total_amount}"

    @classmethod
    def generate_code(cls, hospital, on_date):
        prefix = f"PHARM-{on_date.strftime('%Y%m%d')}-"
        last = cls.objects.filter(
            hospital=hospital, code__startswith=prefix
        ).order_by("-code").first()
        next_num = 1
        if last:
            try:
                next_num = int(last.code.split("-")[-1]) + 1
            except ValueError:
                pass
        return f"{prefix}{str(next_num).zfill(4)}"

    def recalculate_totals(self, save=True):
        items = self.items.all()
        sub = sum((Decimal(str(i.subtotal)) for i in items), Decimal("0"))
        gst_total = sum((Decimal(str(i.gst_amount)) for i in items), Decimal("0"))
        cgst = sgst = igst = Decimal("0")
        # Use the linked invoice's GST split if present, else default to INTRA
        split = self.invoice.gst_split if self.invoice else "INTRA"
        if split == "INTRA":
            cgst = sgst = _q(gst_total / 2)
        elif split == "INTER":
            igst = _q(gst_total)
        self.subtotal = _q(sub)
        self.cgst_amount = cgst
        self.sgst_amount = sgst
        self.igst_amount = igst
        self.total_amount = _q(sub + gst_total - self.discount_amount)
        if save:
            self.save(update_fields=["subtotal", "cgst_amount", "sgst_amount",
                                     "igst_amount", "total_amount"])
        return self


class PharmacyOrderItem(TenantBaseModel):
    """Line item on a pharmacy order. Tied to a specific DrugBatch (FEFO)."""
    order = models.ForeignKey(PharmacyOrder, on_delete=models.CASCADE,
                              related_name="items")
    drug = models.ForeignKey("opd.DrugMaster", on_delete=models.PROTECT)
    batch = models.ForeignKey(DrugBatch, on_delete=models.PROTECT,
        help_text="Specific batch FEFO-allocated at dispense time")
    drug_name = models.CharField(max_length=200,
        help_text="Denormalized from drug.display_name")
    batch_no = models.CharField(max_length=50, blank=True,
        help_text="Denormalized from batch.batch_no")
    expiry_date = models.DateField(null=True, blank=True,
        help_text="Denormalized from batch.expiry_date")

    quantity = models.PositiveIntegerField()
    unit_mrp = models.DecimalField(max_digits=10, decimal_places=2,
        help_text="MRP per unit at time of dispense (GST-inclusive)")
    discount_pct = models.DecimalField(max_digits=5, decimal_places=2,
                                        default=Decimal("0"))

    # Computed fields - GST is BACKED OUT of MRP (since MRP is GST-inclusive)
    gst_rate = models.DecimalField(max_digits=5, decimal_places=2,
                                    default=Decimal("12.00"))
    subtotal = models.DecimalField(max_digits=12, decimal_places=2,
                                    default=Decimal("0.00"),
        help_text="Pre-GST line value (qty × unit_mrp / (1 + gst_rate/100))")
    gst_amount = models.DecimalField(max_digits=10, decimal_places=2,
                                      default=Decimal("0.00"))
    total = models.DecimalField(max_digits=12, decimal_places=2,
                                 default=Decimal("0.00"),
        help_text="qty × unit_mrp − discount")

    # Optional link back to source Rx item
    prescription_item = models.ForeignKey(
        "opd.PrescriptionItem", on_delete=models.SET_NULL,
        null=True, blank=True, related_name="dispensed_items",
    )

    order_index = models.PositiveSmallIntegerField(default=0)

    class Meta:
        ordering = ["order", "order_index"]

    def __str__(self):
        return f"{self.drug_name} ×{self.quantity} ({self.batch_no})"

    def compute(self):
        """MRP is GST-inclusive in India, so back-calculate the pre-GST subtotal."""
        gross = Decimal(self.quantity) * Decimal(self.unit_mrp)
        discount = _q(gross * Decimal(self.discount_pct) / Decimal("100"))
        gross_after_discount = _q(gross - discount)
        # Back out GST from MRP-inclusive amount
        rate = Decimal(self.gst_rate)
        if rate > 0:
            divisor = Decimal("1") + (rate / Decimal("100"))
            sub = _q(gross_after_discount / divisor)
        else:
            sub = gross_after_discount
        self.subtotal = sub
        self.gst_amount = _q(gross_after_discount - sub)
        self.total = gross_after_discount
        return self

    def save(self, *args, **kwargs):
        # Denormalize from batch
        if self.batch:
            self.batch_no = self.batch.batch_no
            self.expiry_date = self.batch.expiry_date
            if not self.gst_rate:
                self.gst_rate = self.batch.gst_rate
        if self.drug and not self.drug_name:
            self.drug_name = self.drug.display_name
        self.compute()
        super().save(*args, **kwargs)
