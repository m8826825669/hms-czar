"""
Inventory / Stores module — Phase 4a.

Models:
  • StoreLocation       — physical store (main / dept sub-stores)
  • ItemCategory        — catalog tree
  • Supplier            — vendors with GST details
  • StockItem           — catalog item (with UOM, MOQ, reorder)
  • StockBatch          — batch-level stock with expiry + MRP
  • PurchaseOrder       — PO with status workflow
  • POLine              — PO line items
  • GRN                 — goods receipt against PO
  • GRNLine             — received line items
  • StockRequisition    — dept request to central stores
  • RequisitionLine
  • StockIssue          — fulfilled requisition
  • IssueLine
  • StockTransfer       — between stores
"""
from decimal import Decimal
from django.db import models
from django.utils import timezone
from django.core.validators import MinValueValidator


class StoreLocation(models.Model):
    STORE_TYPES = [
        ("MAIN",       "Main / Central Store"),
        ("PHARMACY",   "Pharmacy Store"),
        ("MEDICAL",    "Medical / Consumables"),
        ("SURGICAL",   "Surgical / OT Store"),
        ("GENERAL",    "General / Office"),
        ("KITCHEN",    "Kitchen / Pantry"),
        ("LINEN",      "Linen / Laundry"),
        ("CSSD",       "CSSD (Central Sterile)"),
    ]
    hospital = models.ForeignKey("core.Hospital", on_delete=models.CASCADE,
                                  related_name="store_locations")
    code = models.CharField(max_length=20, db_index=True)
    name = models.CharField(max_length=120)
    store_type = models.CharField(max_length=15, choices=STORE_TYPES, default="MAIN")
    department = models.ForeignKey(
        "department.Department", on_delete=models.SET_NULL,
        null=True, blank=True, related_name="stores",
    )
    location_description = models.CharField(max_length=200, blank=True, default="")
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["store_type", "code"]
        unique_together = [["hospital", "code"]]

    def __str__(self):
        return f"{self.code} — {self.name}"


class ItemCategory(models.Model):
    hospital = models.ForeignKey("core.Hospital", on_delete=models.CASCADE,
                                  related_name="inventory_categories")
    code = models.CharField(max_length=20, db_index=True)
    name = models.CharField(max_length=120)
    parent = models.ForeignKey("self", on_delete=models.SET_NULL,
                                 null=True, blank=True, related_name="children")
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["code"]
        unique_together = [["hospital", "code"]]
        verbose_name_plural = "Item Categories"

    def __str__(self):
        return f"{self.code} — {self.name}"


class Supplier(models.Model):
    hospital = models.ForeignKey("core.Hospital", on_delete=models.CASCADE,
                                  related_name="suppliers")
    code = models.CharField(max_length=20, db_index=True)
    name = models.CharField(max_length=200)

    contact_person = models.CharField(max_length=120, blank=True, default="")
    phone = models.CharField(max_length=20, blank=True, default="")
    email = models.EmailField(blank=True, default="")
    address = models.TextField(blank=True, default="")

    gstin = models.CharField(max_length=15, blank=True, default="",
        help_text="GSTIN, 15 chars")
    pan = models.CharField(max_length=10, blank=True, default="")
    bank_account = models.CharField(max_length=30, blank=True, default="")
    bank_ifsc = models.CharField(max_length=15, blank=True, default="")

    # Performance metrics
    payment_terms_days = models.PositiveIntegerField(default=30,
        help_text="Days credit allowed by supplier")
    rating = models.DecimalField(max_digits=3, decimal_places=2, default=Decimal("0"),
        help_text="0-5 stars based on quality, on-time delivery")
    is_blacklisted = models.BooleanField(default=False)
    blacklist_reason = models.CharField(max_length=300, blank=True, default="")

    is_active = models.BooleanField(default=True)
    notes = models.TextField(blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["name"]
        unique_together = [["hospital", "code"]]

    def __str__(self):
        return f"{self.code} — {self.name}"


class StockItem(models.Model):
    """Catalog item — distinct from PharmacyItem (consumables, stationery, linen, etc.)."""
    UOM_CHOICES = [
        ("PCS", "Pieces"), ("BOX", "Box"), ("PKT", "Packet"),
        ("KG", "Kilogram"), ("GM", "Gram"), ("LTR", "Litre"),
        ("ML", "Millilitre"), ("MTR", "Metre"), ("ROLL", "Roll"),
        ("PAIR", "Pair"), ("SET", "Set"), ("DOZEN", "Dozen"),
    ]
    ITEM_TYPES = [
        ("CONSUMABLE", "Consumable"),
        ("STATIONERY", "Stationery"),
        ("LINEN", "Linen"),
        ("HOUSEKEEPING", "Housekeeping Supply"),
        ("KITCHEN", "Kitchen / Food"),
        ("SURGICAL", "Surgical Consumable"),
        ("OTHER", "Other"),
    ]

    hospital = models.ForeignKey("core.Hospital", on_delete=models.CASCADE,
                                  related_name="stock_items")
    code = models.CharField(max_length=30, db_index=True)
    name = models.CharField(max_length=200)
    category = models.ForeignKey(ItemCategory, on_delete=models.PROTECT,
                                   related_name="items")
    item_type = models.CharField(max_length=15, choices=ITEM_TYPES, default="CONSUMABLE")
    description = models.TextField(blank=True, default="")

    uom = models.CharField(max_length=10, choices=UOM_CHOICES, default="PCS")
    hsn_code = models.CharField(max_length=8, blank=True, default="")
    gst_rate = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal("18.00"))

    # Stock control
    reorder_level = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal("0"),
        help_text="Trigger reorder when stock falls below this")
    minimum_stock = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal("0"))
    maximum_stock = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal("0"))

    # Default pricing (overridden by batch)
    default_purchase_price = models.DecimalField(
        max_digits=12, decimal_places=2, default=Decimal("0"))
    default_issue_rate = models.DecimalField(
        max_digits=12, decimal_places=2, default=Decimal("0"),
        help_text="Internal issue rate when transferring to departments")

    is_consumable = models.BooleanField(default=True)
    is_expirable = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["category", "name"]
        unique_together = [["hospital", "code"]]
        indexes = [
            models.Index(fields=["item_type", "is_active"]),
        ]

    def __str__(self):
        return f"{self.code} — {self.name}"


class StockBatch(models.Model):
    """Batch-level stock-on-hand for an item at a store location."""
    hospital = models.ForeignKey("core.Hospital", on_delete=models.CASCADE,
                                  related_name="stock_batches")
    item = models.ForeignKey(StockItem, on_delete=models.PROTECT,
                               related_name="batches")
    store = models.ForeignKey(StoreLocation, on_delete=models.PROTECT,
                                related_name="batches")
    batch_number = models.CharField(max_length=40, db_index=True)
    supplier = models.ForeignKey(Supplier, on_delete=models.SET_NULL,
                                   null=True, blank=True, related_name="supplied_batches")

    # Quantities
    received_quantity = models.DecimalField(max_digits=12, decimal_places=2,
        validators=[MinValueValidator(Decimal("0"))])
    current_quantity = models.DecimalField(max_digits=12, decimal_places=2,
        validators=[MinValueValidator(Decimal("0"))])

    # Pricing
    purchase_rate = models.DecimalField(max_digits=12, decimal_places=2)
    mrp = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0"))
    issue_rate = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0"))

    manufacture_date = models.DateField(null=True, blank=True)
    expiry_date = models.DateField(null=True, blank=True, db_index=True)
    received_date = models.DateField(default=timezone.now)

    grn_reference = models.CharField(max_length=30, blank=True, default="")
    location_in_store = models.CharField(max_length=100, blank=True, default="",
        help_text="Rack/shelf identifier")

    is_active = models.BooleanField(default=True)
    notes = models.CharField(max_length=300, blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["expiry_date", "received_date"]
        indexes = [
            models.Index(fields=["item", "store", "is_active"]),
            models.Index(fields=["expiry_date"]),
        ]

    def __str__(self):
        return f"{self.item.code} batch {self.batch_number} ({self.current_quantity} {self.item.uom})"


class PurchaseOrder(models.Model):
    STATUSES = [
        ("DRAFT",     "Draft"),
        ("SUBMITTED", "Submitted for Approval"),
        ("APPROVED",  "Approved"),
        ("SENT",      "Sent to Supplier"),
        ("PARTIAL",   "Partially Received"),
        ("RECEIVED",  "Fully Received"),
        ("CLOSED",    "Closed"),
        ("CANCELLED", "Cancelled"),
    ]

    hospital = models.ForeignKey("core.Hospital", on_delete=models.CASCADE,
                                  related_name="purchase_orders")
    code = models.CharField(max_length=30, unique=True, db_index=True,
        help_text="Auto-generated, e.g. PO-20260508-0001")

    supplier = models.ForeignKey(Supplier, on_delete=models.PROTECT,
                                   related_name="purchase_orders")
    store = models.ForeignKey(StoreLocation, on_delete=models.PROTECT,
                                related_name="purchase_orders",
                                help_text="Destination store")

    order_date = models.DateField(default=timezone.localdate)
    expected_delivery_date = models.DateField(null=True, blank=True)

    status = models.CharField(max_length=12, choices=STATUSES, default="DRAFT",
                                db_index=True)

    # Totals (auto-computed from lines)
    subtotal = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0"))
    gst_amount = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0"))
    total_amount = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0"))

    payment_terms_days = models.PositiveIntegerField(default=30)
    delivery_address = models.TextField(blank=True, default="")
    terms_and_conditions = models.TextField(blank=True, default="")

    requested_by = models.ForeignKey("accounts.User", on_delete=models.SET_NULL,
                                        null=True, blank=True, related_name="po_requests")
    approved_by = models.ForeignKey("accounts.User", on_delete=models.SET_NULL,
                                        null=True, blank=True, related_name="po_approvals")
    approved_at = models.DateTimeField(null=True, blank=True)

    notes = models.TextField(blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-order_date"]

    def __str__(self):
        return self.code


class POLine(models.Model):
    purchase_order = models.ForeignKey(PurchaseOrder, on_delete=models.CASCADE,
                                          related_name="lines")
    item = models.ForeignKey(StockItem, on_delete=models.PROTECT,
                               related_name="po_lines")

    quantity = models.DecimalField(max_digits=12, decimal_places=2,
        validators=[MinValueValidator(Decimal("0.01"))])
    received_quantity = models.DecimalField(max_digits=12, decimal_places=2,
                                              default=Decimal("0"))

    unit_price = models.DecimalField(max_digits=12, decimal_places=2)
    discount_pct = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal("0"))
    gst_rate = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal("0"))

    subtotal = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0"))
    gst_amount = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0"))
    line_total = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0"))

    notes = models.CharField(max_length=200, blank=True, default="")

    class Meta:
        ordering = ["id"]

    def save(self, *args, **kwargs):
        gross = self.quantity * self.unit_price
        discount_amt = gross * self.discount_pct / Decimal("100")
        self.subtotal = (gross - discount_amt).quantize(Decimal("0.01"))
        self.gst_amount = (self.subtotal * self.gst_rate / Decimal("100")).quantize(Decimal("0.01"))
        self.line_total = (self.subtotal + self.gst_amount).quantize(Decimal("0.01"))
        super().save(*args, **kwargs)


class GRN(models.Model):
    """Goods Receipt Note — physical receipt of items against a PO."""
    STATUSES = [
        ("DRAFT",     "Draft"),
        ("RECEIVED",  "Received"),
        ("VERIFIED",  "Verified"),
        ("CANCELLED", "Cancelled"),
    ]

    hospital = models.ForeignKey("core.Hospital", on_delete=models.CASCADE,
                                  related_name="grns")
    code = models.CharField(max_length=30, unique=True, db_index=True,
        help_text="Auto-generated, e.g. GRN-20260508-0001")
    purchase_order = models.ForeignKey(PurchaseOrder, on_delete=models.PROTECT,
                                          null=True, blank=True, related_name="grns")
    supplier = models.ForeignKey(Supplier, on_delete=models.PROTECT,
                                   related_name="grns")
    store = models.ForeignKey(StoreLocation, on_delete=models.PROTECT,
                                related_name="grns")

    receipt_date = models.DateField(default=timezone.localdate)
    supplier_invoice_number = models.CharField(max_length=50, blank=True, default="")
    supplier_invoice_date = models.DateField(null=True, blank=True)

    status = models.CharField(max_length=12, choices=STATUSES, default="DRAFT")

    subtotal = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0"))
    gst_amount = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0"))
    total_amount = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0"))

    received_by = models.ForeignKey("accounts.User", on_delete=models.SET_NULL,
                                       null=True, blank=True, related_name="grn_receipts")
    verified_by = models.ForeignKey("accounts.User", on_delete=models.SET_NULL,
                                       null=True, blank=True, related_name="grn_verifications")
    verified_at = models.DateTimeField(null=True, blank=True)

    notes = models.TextField(blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-receipt_date"]

    def __str__(self):
        return self.code


class GRNLine(models.Model):
    grn = models.ForeignKey(GRN, on_delete=models.CASCADE, related_name="lines")
    po_line = models.ForeignKey(POLine, on_delete=models.SET_NULL,
                                   null=True, blank=True, related_name="grn_lines")
    item = models.ForeignKey(StockItem, on_delete=models.PROTECT,
                               related_name="grn_lines")

    batch_number = models.CharField(max_length=40)
    received_quantity = models.DecimalField(max_digits=12, decimal_places=2,
        validators=[MinValueValidator(Decimal("0.01"))])
    accepted_quantity = models.DecimalField(max_digits=12, decimal_places=2)
    rejected_quantity = models.DecimalField(max_digits=12, decimal_places=2,
                                              default=Decimal("0"))

    unit_price = models.DecimalField(max_digits=12, decimal_places=2)
    mrp = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0"))
    gst_rate = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal("0"))

    manufacture_date = models.DateField(null=True, blank=True)
    expiry_date = models.DateField(null=True, blank=True)

    rejection_reason = models.CharField(max_length=300, blank=True, default="")
    notes = models.CharField(max_length=200, blank=True, default="")

    line_total = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0"))

    class Meta:
        ordering = ["id"]

    def save(self, *args, **kwargs):
        net = self.accepted_quantity * self.unit_price
        gst = net * self.gst_rate / Decimal("100")
        self.line_total = (net + gst).quantize(Decimal("0.01"))
        super().save(*args, **kwargs)


class StockRequisition(models.Model):
    STATUSES = [
        ("DRAFT",     "Draft"),
        ("SUBMITTED", "Submitted"),
        ("APPROVED",  "Approved"),
        ("PARTIAL",   "Partially Fulfilled"),
        ("FULFILLED", "Fully Fulfilled"),
        ("CANCELLED", "Cancelled"),
    ]
    URGENCY = [
        ("ROUTINE", "Routine"),
        ("URGENT",  "Urgent"),
        ("EMERG",   "Emergency"),
    ]

    hospital = models.ForeignKey("core.Hospital", on_delete=models.CASCADE,
                                  related_name="stock_requisitions")
    code = models.CharField(max_length=30, unique=True, db_index=True,
        help_text="Auto-generated, e.g. REQ-20260508-0001")

    requesting_dept = models.ForeignKey(
        "department.Department", on_delete=models.PROTECT,
        related_name="stock_requisitions",
    )
    source_store = models.ForeignKey(
        StoreLocation, on_delete=models.PROTECT,
        related_name="incoming_requisitions",
        help_text="Store to fulfill from",
    )

    requested_by = models.ForeignKey("accounts.User", on_delete=models.SET_NULL,
                                        null=True, blank=True, related_name="stock_requests")
    requested_date = models.DateField(default=timezone.localdate)
    required_by_date = models.DateField(null=True, blank=True)

    urgency = models.CharField(max_length=10, choices=URGENCY, default="ROUTINE")
    status = models.CharField(max_length=12, choices=STATUSES, default="DRAFT")

    purpose = models.CharField(max_length=300, blank=True, default="")
    approved_by = models.ForeignKey("accounts.User", on_delete=models.SET_NULL,
                                       null=True, blank=True, related_name="stock_req_approvals")
    approved_at = models.DateTimeField(null=True, blank=True)

    notes = models.TextField(blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-requested_date"]


class RequisitionLine(models.Model):
    requisition = models.ForeignKey(StockRequisition, on_delete=models.CASCADE,
                                       related_name="lines")
    item = models.ForeignKey(StockItem, on_delete=models.PROTECT,
                               related_name="requisition_lines")
    quantity_requested = models.DecimalField(max_digits=12, decimal_places=2,
        validators=[MinValueValidator(Decimal("0.01"))])
    quantity_approved = models.DecimalField(max_digits=12, decimal_places=2,
                                              default=Decimal("0"))
    quantity_issued = models.DecimalField(max_digits=12, decimal_places=2,
                                            default=Decimal("0"))
    notes = models.CharField(max_length=200, blank=True, default="")

    class Meta:
        ordering = ["id"]


class StockIssue(models.Model):
    """Issue of stock from store to department (against requisition)."""
    hospital = models.ForeignKey("core.Hospital", on_delete=models.CASCADE,
                                  related_name="stock_issues")
    code = models.CharField(max_length=30, unique=True, db_index=True,
        help_text="Auto-generated, e.g. ISS-20260508-0001")

    requisition = models.ForeignKey(StockRequisition, on_delete=models.PROTECT,
                                       null=True, blank=True, related_name="issues")
    issuing_store = models.ForeignKey(StoreLocation, on_delete=models.PROTECT,
                                         related_name="issues")
    receiving_dept = models.ForeignKey(
        "department.Department", on_delete=models.PROTECT,
        related_name="received_issues",
    )

    issue_date = models.DateField(default=timezone.localdate)
    issued_by = models.ForeignKey("accounts.User", on_delete=models.SET_NULL,
                                     null=True, blank=True, related_name="stock_issued_by")
    received_by_name = models.CharField(max_length=120, blank=True, default="")

    total_value = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0"))
    notes = models.TextField(blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-issue_date"]


class IssueLine(models.Model):
    issue = models.ForeignKey(StockIssue, on_delete=models.CASCADE, related_name="lines")
    batch = models.ForeignKey(StockBatch, on_delete=models.PROTECT,
                                related_name="issue_lines")
    quantity = models.DecimalField(max_digits=12, decimal_places=2,
        validators=[MinValueValidator(Decimal("0.01"))])
    issue_rate = models.DecimalField(max_digits=12, decimal_places=2)
    line_total = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0"))

    class Meta:
        ordering = ["id"]

    def save(self, *args, **kwargs):
        self.line_total = (self.quantity * self.issue_rate).quantize(Decimal("0.01"))
        super().save(*args, **kwargs)


class StockTransfer(models.Model):
    """Transfer of stock between stores."""
    STATUSES = [
        ("PENDING",   "Pending"),
        ("IN_TRANSIT","In Transit"),
        ("RECEIVED",  "Received at Destination"),
        ("CANCELLED", "Cancelled"),
    ]

    hospital = models.ForeignKey("core.Hospital", on_delete=models.CASCADE,
                                  related_name="stock_transfers")
    code = models.CharField(max_length=30, unique=True, db_index=True)

    from_store = models.ForeignKey(StoreLocation, on_delete=models.PROTECT,
                                      related_name="outgoing_transfers")
    to_store = models.ForeignKey(StoreLocation, on_delete=models.PROTECT,
                                    related_name="incoming_transfers")

    transfer_date = models.DateField(default=timezone.localdate)
    status = models.CharField(max_length=12, choices=STATUSES, default="PENDING")

    item = models.ForeignKey(StockItem, on_delete=models.PROTECT,
                               related_name="transfers")
    quantity = models.DecimalField(max_digits=12, decimal_places=2)
    batch_number = models.CharField(max_length=40, blank=True, default="")

    initiated_by = models.ForeignKey("accounts.User", on_delete=models.SET_NULL,
                                        null=True, blank=True, related_name="transfers_initiated")
    received_by = models.ForeignKey("accounts.User", on_delete=models.SET_NULL,
                                       null=True, blank=True, related_name="transfers_received")
    received_at = models.DateTimeField(null=True, blank=True)

    notes = models.TextField(blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-transfer_date"]
