"""Billing module models (Phase 1c + Phase 2b Refund model).

ServiceCatalog : master price list (consultation, lab, procedure, room rent...)
Invoice        : header — patient + GST split + Razorpay refs + status
InvoiceItem    : individual service line — qty × price + per-line GST
Payment        : transaction log — every cash/card/UPI/Razorpay event
Refund         : refund against invoice + payment (Phase 2b)
"""
from decimal import Decimal
from django.db import models
from django.utils import timezone
from apps.core.models import TenantBaseModel


def _quantize(amount):
    return Decimal(amount).quantize(Decimal("0.01"))


class ServiceCatalog(TenantBaseModel):
    CATEGORIES = [
        ("CONSULTATION", "Consultation"),
        ("INVESTIGATION", "Investigation/Lab"),
        ("PROCEDURE", "Procedure"),
        ("ROOM", "Room/Bed Rent"),
        ("MEDICINE", "Medicine"),
        ("PACKAGE", "Package/Bundle"),
        ("OTHER", "Other"),
    ]

    code = models.CharField(max_length=30, db_index=True)
    name = models.CharField(max_length=200)
    category = models.CharField(max_length=15, choices=CATEGORIES, default="CONSULTATION")
    description = models.TextField(blank=True)
    price = models.DecimalField(max_digits=10, decimal_places=2)
    hsn_code = models.CharField(max_length=8, blank=True)
    gst_rate = models.DecimalField(max_digits=5, decimal_places=2,
                                   default=Decimal("18.00"))
    is_taxable = models.BooleanField(default=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        unique_together = [("hospital", "code")]
        ordering = ["category", "name"]
        verbose_name = "Service catalog item"
        verbose_name_plural = "Service catalog"
        indexes = [models.Index(fields=["category", "is_active"])]

    def __str__(self):
        return f"{self.code} — {self.name} (₹{self.price})"


class Invoice(TenantBaseModel):
    STATUSES = [
        ("DRAFT", "Draft"),
        ("PENDING", "Pending payment"),
        ("PARTIAL", "Partially paid"),
        ("PAID", "Paid in full"),
        ("CANCELLED", "Cancelled"),
        ("REFUNDED", "Refunded"),
    ]
    GST_SPLITS = [
        ("INTRA", "Intra-state (CGST + SGST)"),
        ("INTER", "Inter-state (IGST)"),
        ("EXEMPT", "Exempt"),
    ]

    code = models.CharField(max_length=20, db_index=True)
    bill_date = models.DateField(default=timezone.localdate, db_index=True)

    patient = models.ForeignKey("core.Patient", on_delete=models.PROTECT,
                                related_name="invoices")
    consultation = models.ForeignKey("opd.Consultation", null=True, blank=True,
                                     on_delete=models.SET_NULL, related_name="invoices")
    appointment = models.ForeignKey("reception.Appointment", null=True, blank=True,
                                    on_delete=models.SET_NULL, related_name="invoices")

    patient_state = models.CharField(max_length=80, blank=True)
    hospital_state = models.CharField(max_length=80, blank=True)
    gst_split = models.CharField(max_length=10, choices=GST_SPLITS, default="INTRA")

    subtotal = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    discount_amount = models.DecimalField(max_digits=10, decimal_places=2,
                                          default=Decimal("0.00"))
    discount_reason = models.CharField(max_length=200, blank=True)
    taxable_amount = models.DecimalField(max_digits=12, decimal_places=2,
                                          default=Decimal("0.00"))
    cgst_amount = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal("0.00"))
    sgst_amount = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal("0.00"))
    igst_amount = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal("0.00"))
    total_amount = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    amount_paid = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    amount_due = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))

    # Phase 2b: track refunded amount
    amount_refunded = models.DecimalField(max_digits=12, decimal_places=2,
                                          default=Decimal("0.00"))

    status = models.CharField(max_length=10, choices=STATUSES, default="DRAFT", db_index=True)
    razorpay_order_id = models.CharField(max_length=64, blank=True, db_index=True)
    notes = models.TextField(blank=True)
    printed_at = models.DateTimeField(null=True, blank=True)
    cancelled_reason = models.CharField(max_length=300, blank=True)

    class Meta:
        unique_together = [("hospital", "code")]
        ordering = ["-bill_date", "-created_at"]
        indexes = [
            models.Index(fields=["patient", "-bill_date"]),
            models.Index(fields=["status", "-bill_date"]),
        ]

    def __str__(self):
        return f"{self.code} — {self.patient} (₹{self.total_amount})"

    @classmethod
    def generate_code(cls, hospital, on_date):
        prefix = f"INV-{on_date.strftime('%Y%m%d')}-"
        last = cls.objects.filter(hospital=hospital, code__startswith=prefix).order_by("-code").first()
        next_num = 1
        if last:
            try:
                next_num = int(last.code.split("-")[-1]) + 1
            except ValueError:
                pass
        return f"{prefix}{str(next_num).zfill(4)}"

    def recalculate_totals(self, save=True):
        items = self.items.all()
        subtotal = sum((i.subtotal for i in items), Decimal("0"))
        gst_total = sum((i.gst_amount for i in items), Decimal("0"))
        cgst = sgst = igst = Decimal("0")
        if self.gst_split == "INTRA":
            cgst = sgst = _quantize(gst_total / 2)
        elif self.gst_split == "INTER":
            igst = _quantize(gst_total)

        taxable = _quantize(subtotal - self.discount_amount)
        total = _quantize(taxable + gst_total)

        self.subtotal = _quantize(subtotal)
        self.taxable_amount = taxable
        self.cgst_amount = cgst
        self.sgst_amount = sgst
        self.igst_amount = igst
        self.total_amount = total
        self.amount_due = _quantize(total - self.amount_paid)
        if save:
            self.save(update_fields=["subtotal", "taxable_amount", "cgst_amount",
                                     "sgst_amount", "igst_amount", "total_amount",
                                     "amount_due"])
        return self

    def update_payment_status(self, save=True):
        self.amount_due = _quantize(self.total_amount - self.amount_paid)
        if self.status == "CANCELLED":
            return self
        # Phase 2b: full refund detection
        # - If amount_paid hits zero AND we've refunded the full original total → REFUNDED
        # - Otherwise standard PAID/PARTIAL/PENDING logic on what's currently paid
        if self.amount_refunded > 0 and self.amount_paid <= 0:
            self.status = "REFUNDED"
        elif self.amount_paid <= 0:
            self.status = "PENDING" if self.total_amount > 0 else "DRAFT"
        elif self.amount_paid >= self.total_amount:
            self.status = "PAID"
        else:
            self.status = "PARTIAL"
        if save:
            self.save(update_fields=["status", "amount_due"])
        return self


class InvoiceItem(TenantBaseModel):
    invoice = models.ForeignKey(Invoice, on_delete=models.CASCADE, related_name="items")
    service = models.ForeignKey(ServiceCatalog, null=True, blank=True,
                                on_delete=models.SET_NULL)
    service_name = models.CharField(max_length=200)
    hsn_code = models.CharField(max_length=8, blank=True)
    quantity = models.DecimalField(max_digits=8, decimal_places=2, default=Decimal("1"))
    unit_price = models.DecimalField(max_digits=10, decimal_places=2)
    discount_pct = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal("0"))
    subtotal = models.DecimalField(max_digits=12, decimal_places=2)
    gst_rate = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal("18.00"))
    gst_amount = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal("0.00"))
    total = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    order_index = models.PositiveSmallIntegerField(default=0)

    class Meta:
        ordering = ["invoice", "order_index"]

    def __str__(self):
        return f"{self.service_name} ×{self.quantity} = ₹{self.total}"

    def compute(self):
        gross = _quantize(Decimal(self.quantity) * Decimal(self.unit_price))
        discount = _quantize(gross * Decimal(self.discount_pct) / Decimal("100"))
        sub = _quantize(gross - discount)
        gst = _quantize(sub * Decimal(self.gst_rate) / Decimal("100"))
        self.subtotal = sub
        self.gst_amount = gst
        self.total = _quantize(sub + gst)
        return self

    def save(self, *args, **kwargs):
        self.compute()
        super().save(*args, **kwargs)


class Payment(TenantBaseModel):
    METHODS = [
        ("CASH", "Cash"), ("CARD", "Card"), ("UPI", "UPI"),
        ("NETBANKING", "Netbanking"), ("RAZORPAY", "Razorpay (online)"),
        ("CHEQUE", "Cheque"), ("WALLET", "Wallet"),
        ("INSURANCE", "Insurance/TPA"), ("OTHER", "Other"),
    ]
    STATUSES = [
        ("INITIATED", "Initiated"), ("SUCCESS", "Success"),
        ("FAILED", "Failed"), ("REFUNDED", "Refunded"),
    ]

    invoice = models.ForeignKey(Invoice, on_delete=models.PROTECT, related_name="payments")
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    method = models.CharField(max_length=12, choices=METHODS, default="CASH")
    reference = models.CharField(max_length=100, blank=True)
    status = models.CharField(max_length=10, choices=STATUSES, default="SUCCESS")
    received_at = models.DateTimeField(default=timezone.now, db_index=True)
    razorpay_order_id = models.CharField(max_length=64, blank=True, db_index=True)
    razorpay_payment_id = models.CharField(max_length=64, blank=True, db_index=True)
    razorpay_signature = models.CharField(max_length=256, blank=True)
    is_signature_verified = models.BooleanField(default=False)
    notes = models.TextField(blank=True)

    class Meta:
        ordering = ["-received_at"]
        indexes = [models.Index(fields=["invoice", "status"])]

    def __str__(self):
        return f"₹{self.amount} ({self.get_method_display()}) - {self.status}"


# ───────────────────────────── PHASE 2b: REFUNDS ─────────────────────────────────

class Refund(TenantBaseModel):
    """Refund against a paid/partially-paid invoice. Supports cash + Razorpay refunds.

    Workflow:
      REQUESTED → APPROVED → PROCESSED
                  ↓
                  REJECTED (with reason)

    On PROCESSED:
      - amount added to invoice.amount_refunded
      - invoice.amount_paid reduced by refund.amount
      - invoice status updated (PAID with full refund → REFUNDED;
        PARTIAL with partial refund stays PARTIAL with reduced amount_paid)
      - For Razorpay: razorpay_service.refund_payment is called and
        razorpay_refund_id + razorpay_status are persisted.
    """
    STATUSES = [
        ("REQUESTED", "Requested"),
        ("APPROVED", "Approved"),
        ("PROCESSED", "Processed"),
        ("REJECTED", "Rejected"),
    ]
    METHODS = [
        ("CASH", "Cash refund"),
        ("RAZORPAY", "Razorpay refund (online)"),
        ("BANK_TRANSFER", "Bank transfer"),
        ("ADJUSTMENT", "Credit adjustment"),
    ]

    code = models.CharField(max_length=20, db_index=True,
        help_text="Auto e.g. RFD-20260507-0001")
    invoice = models.ForeignKey(Invoice, on_delete=models.PROTECT,
                                related_name="refunds")
    payment = models.ForeignKey(Payment, null=True, blank=True,
                                on_delete=models.SET_NULL, related_name="refunds",
        help_text="Original payment being refunded (preferred for Razorpay)")
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    method = models.CharField(max_length=15, choices=METHODS, default="CASH")
    reason = models.TextField(help_text="Reason — required for audit")
    status = models.CharField(max_length=12, choices=STATUSES, default="REQUESTED",
                              db_index=True)

    requested_at = models.DateTimeField(default=timezone.now)
    approved_at = models.DateTimeField(null=True, blank=True)
    processed_at = models.DateTimeField(null=True, blank=True)
    approved_by = models.ForeignKey(
        "accounts.User", null=True, blank=True, on_delete=models.SET_NULL,
        related_name="approved_refunds",
    )

    razorpay_refund_id = models.CharField(max_length=64, blank=True, db_index=True)
    razorpay_status = models.CharField(max_length=30, blank=True,
        help_text="Razorpay refund status: pending/processed/failed")

    rejection_reason = models.CharField(max_length=300, blank=True)
    notes = models.TextField(blank=True)

    class Meta:
        unique_together = [("hospital", "code")]
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["status", "-created_at"]),
            models.Index(fields=["invoice", "-created_at"]),
        ]

    def __str__(self):
        return f"{self.code} ₹{self.amount} ({self.status})"

    @classmethod
    def generate_code(cls, hospital, on_date):
        prefix = f"RFD-{on_date.strftime('%Y%m%d')}-"
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
