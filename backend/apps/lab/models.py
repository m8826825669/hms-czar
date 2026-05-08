"""Lab module models.

TestCatalog       : master list of orderable tests with reference ranges.
LabOrder          : a doctor's order for one-or-more tests on a patient
                    (LAB-YYYYMMDD-NNNN). Auto-generates an Invoice on finalize.
LabOrderItem      : individual test line on the order.
LabSample         : a physical specimen (blood/urine/swab/etc) collected for the order.
                    One sample can satisfy multiple test parameters.
LabResult         : a single parameter result. One test can have many parameters
                    (e.g. CBC has Hb, RBC, WBC, Platelets, MCV, MCH...). Each
                    is auto-flagged NORMAL/LOW/HIGH/CRITICAL based on the
                    parameter's reference range.
"""
from decimal import Decimal
from django.db import models
from django.utils import timezone
from apps.core.models import TenantBaseModel


# ─────────────────────────────────── TestCatalog ───────────────────────────────────

class TestCatalog(TenantBaseModel):
    """Master catalog of orderable lab tests.

    Tests have one or more PARAMETERS — e.g. CBC has parameters Hb, RBC, WBC, Platelets.
    Each parameter has its own reference range (often gender/age dependent in real
    labs; we keep it simple here with a single low/high pair per parameter).
    """
    CATEGORIES = [
        ("HEMATOLOGY", "Haematology"),
        ("BIOCHEMISTRY", "Biochemistry"),
        ("MICROBIOLOGY", "Microbiology"),
        ("SEROLOGY", "Serology / Immunology"),
        ("URINALYSIS", "Urinalysis"),
        ("RADIOLOGY", "Radiology / Imaging"),
        ("PATHOLOGY", "Pathology / Histology"),
        ("OTHER", "Other"),
    ]
    SAMPLE_TYPES = [
        ("BLOOD", "Blood"),
        ("URINE", "Urine"),
        ("STOOL", "Stool"),
        ("SPUTUM", "Sputum"),
        ("SWAB", "Swab"),
        ("CSF", "CSF"),
        ("TISSUE", "Tissue/biopsy"),
        ("IMAGE", "Imaging (no sample)"),
        ("OTHER", "Other"),
    ]

    code = models.CharField(max_length=20, db_index=True,
        help_text="Unique short code, e.g. CBC, LFT, KFT, LIPID, FBS")
    name = models.CharField(max_length=200,
        help_text="Display name, e.g. 'Complete Blood Count'")
    category = models.CharField(max_length=15, choices=CATEGORIES, default="HEMATOLOGY")
    sample_type = models.CharField(max_length=10, choices=SAMPLE_TYPES, default="BLOOD")
    sample_volume = models.CharField(max_length=100, blank=True,
        help_text="e.g. '3 ml in EDTA tube', '10 ml mid-stream'")

    # Pricing — invoice generation pulls from here
    price = models.DecimalField(max_digits=10, decimal_places=2,
        help_text="Patient price (pre-GST)")
    hsn_code = models.CharField(max_length=8, blank=True, default="9993")
    gst_rate = models.DecimalField(max_digits=5, decimal_places=2,
                                   default=Decimal("0.00"),
        help_text="Most diagnostic services are GST-exempt in India (0%)")

    # Workflow hints
    typical_tat_hours = models.PositiveSmallIntegerField(default=24,
        help_text="Typical turnaround time in hours, used for ETA display")
    requires_fasting = models.BooleanField(default=False)
    instructions = models.TextField(blank=True,
        help_text="Pre-test instructions to print on the order slip")

    is_active = models.BooleanField(default=True, db_index=True)

    class Meta:
        unique_together = [("hospital", "code")]
        ordering = ["category", "name"]
        indexes = [models.Index(fields=["category", "is_active"])]
        verbose_name = "Test catalog item"
        verbose_name_plural = "Test catalog"

    def __str__(self):
        return f"{self.code} — {self.name} (₹{self.price})"


class TestParameter(TenantBaseModel):
    """A single measured parameter within a test.

    e.g. for CBC the parameters are: Hb, RBC, WBC, Platelets, MCV, MCH, MCHC, etc.
    For LFT: SGOT, SGPT, ALP, Bilirubin (Total/Direct/Indirect), Total Protein, etc.
    Reference ranges are stored per-parameter.
    """
    test = models.ForeignKey(TestCatalog, on_delete=models.CASCADE,
                             related_name="parameters")
    code = models.CharField(max_length=20,
        help_text="Short code unique within the test, e.g. 'HB', 'RBC', 'SGOT'")
    name = models.CharField(max_length=120, help_text="Full name, e.g. 'Haemoglobin'")
    unit = models.CharField(max_length=20, blank=True,
        help_text="e.g. 'g/dL', 'mg/dL', 'cells/cumm'")

    # Reference range — kept simple. Real labs split by gender/age.
    ref_low = models.DecimalField(max_digits=12, decimal_places=4,
                                  null=True, blank=True)
    ref_high = models.DecimalField(max_digits=12, decimal_places=4,
                                   null=True, blank=True)
    ref_text = models.CharField(max_length=120, blank=True,
        help_text="Free-text range, used when value is qualitative "
                  "(e.g. 'Negative', 'Non-reactive')")

    # Critical thresholds — out of these → auto-flag CRITICAL
    critical_low = models.DecimalField(max_digits=12, decimal_places=4,
                                       null=True, blank=True)
    critical_high = models.DecimalField(max_digits=12, decimal_places=4,
                                        null=True, blank=True)

    is_qualitative = models.BooleanField(default=False,
        help_text="If True the result is text (Positive/Negative) not numeric")
    sort_order = models.PositiveSmallIntegerField(default=0)

    class Meta:
        unique_together = [("test", "code")]
        ordering = ["test", "sort_order", "name"]

    def __str__(self):
        return f"{self.test.code}.{self.code} ({self.name})"

    def evaluate(self, raw_value):
        """Given a string value, return ('NORMAL'|'LOW'|'HIGH'|'CRITICAL', notes).

        Qualitative parameters stay NORMAL unless explicitly tagged.
        Numeric parameters compared to ref_low/high and critical_low/high.
        """
        if self.is_qualitative or not raw_value:
            return ("NORMAL", "")
        try:
            val = Decimal(str(raw_value).strip())
        except Exception:
            return ("NORMAL", "non-numeric value")

        # Critical first — overrides LOW/HIGH
        if self.critical_low is not None and val < self.critical_low:
            return ("CRITICAL", f"Below critical threshold {self.critical_low}")
        if self.critical_high is not None and val > self.critical_high:
            return ("CRITICAL", f"Above critical threshold {self.critical_high}")

        if self.ref_low is not None and val < self.ref_low:
            return ("LOW", f"Below reference {self.ref_low}")
        if self.ref_high is not None and val > self.ref_high:
            return ("HIGH", f"Above reference {self.ref_high}")

        return ("NORMAL", "")


# ─────────────────────────────────── LabOrder ───────────────────────────────────

class LabOrder(TenantBaseModel):
    """A doctor's order for one or more tests for a patient."""
    STATUSES = [
        ("DRAFT", "Draft"),
        ("ORDERED", "Ordered (awaiting sample)"),
        ("COLLECTED", "Sample collected"),
        ("IN_PROGRESS", "Tests in progress"),
        ("REPORTED", "Reported"),
        ("CANCELLED", "Cancelled"),
    ]
    PRIORITIES = [
        ("ROUTINE", "Routine"),
        ("URGENT", "Urgent"),
        ("STAT", "STAT (immediate)"),
    ]

    code = models.CharField(max_length=20, db_index=True,
        help_text="Auto e.g. LAB-20260507-0001")
    order_date = models.DateField(default=timezone.localdate, db_index=True)

    patient = models.ForeignKey("core.Patient", on_delete=models.PROTECT,
                                related_name="lab_orders")
    consultation = models.ForeignKey(
        "opd.Consultation", on_delete=models.SET_NULL,
        null=True, blank=True, related_name="lab_orders",
    )
    ordered_by = models.ForeignKey(
        "specialist.Doctor", on_delete=models.PROTECT,
        related_name="ordered_lab_orders",
    )

    priority = models.CharField(max_length=10, choices=PRIORITIES, default="ROUTINE")
    clinical_notes = models.TextField(blank=True,
        help_text="Provisional diagnosis / why these tests were ordered")
    requires_fasting = models.BooleanField(default=False)
    fasting_hours = models.PositiveSmallIntegerField(default=0)

    # Money — auto-recalculated
    subtotal = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    cgst_amount = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal("0.00"))
    sgst_amount = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal("0.00"))
    igst_amount = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal("0.00"))
    total_amount = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))

    invoice = models.OneToOneField(
        "billing.Invoice", on_delete=models.SET_NULL,
        null=True, blank=True, related_name="lab_order",
    )

    status = models.CharField(max_length=12, choices=STATUSES, default="DRAFT", db_index=True)
    sample_collected_at = models.DateTimeField(null=True, blank=True)
    reported_at = models.DateTimeField(null=True, blank=True)
    reported_by = models.ForeignKey(
        "specialist.Doctor", on_delete=models.SET_NULL, null=True, blank=True,
        related_name="reported_lab_orders",
        help_text="Pathologist / radiologist who signed the report",
    )

    notes = models.TextField(blank=True)

    class Meta:
        unique_together = [("hospital", "code")]
        ordering = ["-order_date", "-created_at"]
        indexes = [
            models.Index(fields=["patient", "-order_date"]),
            models.Index(fields=["status", "-order_date"]),
            models.Index(fields=["priority", "-order_date"]),
        ]

    def __str__(self):
        return f"{self.code} — {self.patient} ({self.status})"

    @classmethod
    def generate_code(cls, hospital, on_date):
        prefix = f"LAB-{on_date.strftime('%Y%m%d')}-"
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
        sub = sum((Decimal(str(i.price)) for i in items), Decimal("0"))
        gst_total = sum((Decimal(str(i.gst_amount)) for i in items), Decimal("0"))
        cgst = sgst = igst = Decimal("0")
        split = self.invoice.gst_split if self.invoice else "EXEMPT"
        if split == "INTRA":
            cgst = sgst = (gst_total / 2).quantize(Decimal("0.01"))
        elif split == "INTER":
            igst = gst_total.quantize(Decimal("0.01"))
        self.subtotal = sub.quantize(Decimal("0.01"))
        self.cgst_amount = cgst
        self.sgst_amount = sgst
        self.igst_amount = igst
        self.total_amount = (sub + gst_total).quantize(Decimal("0.01"))
        if save:
            self.save(update_fields=["subtotal", "cgst_amount", "sgst_amount",
                                     "igst_amount", "total_amount"])
        return self


class LabOrderItem(TenantBaseModel):
    """A single test line on a LabOrder."""
    order = models.ForeignKey(LabOrder, on_delete=models.CASCADE, related_name="items")
    test = models.ForeignKey(TestCatalog, on_delete=models.PROTECT)
    test_code = models.CharField(max_length=20, blank=True,
        help_text="Denormalized from test.code at order time")
    test_name = models.CharField(max_length=200, blank=True,
        help_text="Denormalized from test.name at order time")
    sample_type = models.CharField(max_length=10, blank=True,
        help_text="Denormalized from test.sample_type")

    price = models.DecimalField(max_digits=10, decimal_places=2,
        help_text="Charged price at order time (snapshot)")
    gst_rate = models.DecimalField(max_digits=5, decimal_places=2,
                                   default=Decimal("0.00"))
    gst_amount = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal("0.00"))

    status = models.CharField(max_length=12,
        choices=[("PENDING", "Pending"), ("IN_PROGRESS", "In progress"),
                 ("COMPLETED", "Completed"), ("CANCELLED", "Cancelled")],
        default="PENDING", db_index=True)
    notes = models.CharField(max_length=300, blank=True)
    order_index = models.PositiveSmallIntegerField(default=0)

    class Meta:
        ordering = ["order", "order_index"]

    def __str__(self):
        return f"{self.test_name} (₹{self.price})"

    def compute(self):
        gross = Decimal(self.price)
        rate = Decimal(self.gst_rate)
        self.gst_amount = (gross * rate / Decimal("100")).quantize(Decimal("0.01"))
        return self

    def save(self, *args, **kwargs):
        if self.test_id and not self.test_name:
            self.test_name = self.test.name
            self.test_code = self.test.code
            self.sample_type = self.test.sample_type
        self.compute()
        super().save(*args, **kwargs)


# ─────────────────────────────────── LabSample ───────────────────────────────────

class LabSample(TenantBaseModel):
    """Physical specimen collected from the patient.

    A single venipuncture can yield blood that's split across multiple tubes;
    each tube becomes a separate LabSample. We tag each sample with its
    sample_type so that a single CBC+LFT order needs only one EDTA tube
    for CBC and one plain tube for LFT.
    """
    SAMPLE_TYPES = TestCatalog.SAMPLE_TYPES

    order = models.ForeignKey(LabOrder, on_delete=models.CASCADE, related_name="samples")
    sample_type = models.CharField(max_length=10, choices=SAMPLE_TYPES, default="BLOOD")
    container = models.CharField(max_length=80, blank=True,
        help_text="e.g. 'EDTA purple-top', 'plain red-top', 'fluoride grey-top'")
    barcode = models.CharField(max_length=40, blank=True, db_index=True,
        help_text="Auto-generated unique label for the tube")
    volume = models.CharField(max_length=100, blank=True,
        help_text="e.g. '3 ml', '10 ml'")

    collected_by = models.ForeignKey(
        "accounts.User", on_delete=models.SET_NULL, null=True, blank=True,
        related_name="collected_samples",
    )
    collected_at = models.DateTimeField(default=timezone.now)
    is_received = models.BooleanField(default=True,
        help_text="Lab has physically received the sample")
    is_rejected = models.BooleanField(default=False,
        help_text="Sample is unusable (haemolysed/clotted/insufficient)")
    rejection_reason = models.CharField(max_length=200, blank=True)

    notes = models.CharField(max_length=300, blank=True)

    class Meta:
        ordering = ["order", "-collected_at"]
        indexes = [
            models.Index(fields=["barcode"]),
            models.Index(fields=["order", "sample_type"]),
        ]

    def __str__(self):
        return f"{self.barcode or 'sample'} ({self.get_sample_type_display()}) for {self.order.code}"

    @classmethod
    def generate_barcode(cls, hospital, order_code, seq):
        # SAM-{LAB-CODE-SUFFIX}-{seq}, e.g. SAM-202605070001-A
        compact = order_code.replace("LAB-", "").replace("-", "")
        return f"SAM-{compact}-{chr(64 + seq)}"  # A, B, C, ...


# ─────────────────────────────────── LabResult ───────────────────────────────────

class LabResult(TenantBaseModel):
    """A single result value for one parameter.

    Tying results to individual TestParameter records (rather than free text)
    is what gives us automatic abnormal flagging and structured PDFs.
    """
    FLAGS = [
        ("NORMAL", "Normal"),
        ("LOW", "Low"),
        ("HIGH", "High"),
        ("CRITICAL", "Critical"),
    ]

    order_item = models.ForeignKey(LabOrderItem, on_delete=models.CASCADE,
                                   related_name="results")
    parameter = models.ForeignKey(TestParameter, on_delete=models.PROTECT)
    parameter_name = models.CharField(max_length=120, blank=True,
        help_text="Denormalized from parameter.name")
    parameter_unit = models.CharField(max_length=20, blank=True,
        help_text="Denormalized from parameter.unit")
    parameter_ref = models.CharField(max_length=80, blank=True,
        help_text="Denormalized human-readable range, e.g. '12.0 - 17.0'")

    value = models.CharField(max_length=80,
        help_text="Raw entered value as string (preserves precision/format)")
    flag = models.CharField(max_length=10, choices=FLAGS, default="NORMAL", db_index=True)
    interpretation = models.CharField(max_length=300, blank=True,
        help_text="Optional clinical comment from the pathologist")

    entered_at = models.DateTimeField(default=timezone.now)
    entered_by = models.ForeignKey(
        "accounts.User", on_delete=models.SET_NULL, null=True, blank=True,
        related_name="lab_results_entered",
    )
    verified_at = models.DateTimeField(null=True, blank=True)
    verified_by = models.ForeignKey(
        "accounts.User", on_delete=models.SET_NULL, null=True, blank=True,
        related_name="lab_results_verified",
    )

    sort_order = models.PositiveSmallIntegerField(default=0)

    class Meta:
        unique_together = [("order_item", "parameter")]
        ordering = ["order_item", "sort_order"]
        indexes = [
            models.Index(fields=["flag", "-entered_at"]),
        ]

    def __str__(self):
        return f"{self.parameter_name}: {self.value} {self.parameter_unit} ({self.flag})"

    def auto_flag(self):
        """Compute and set flag from the parameter's reference range."""
        flag, note = self.parameter.evaluate(self.value)
        self.flag = flag
        if note and not self.interpretation:
            self.interpretation = note
        return self.flag

    def save(self, *args, **kwargs):
        # Denormalize from parameter
        if self.parameter_id:
            self.parameter_name = self.parameter.name
            self.parameter_unit = self.parameter.unit
            if self.parameter.is_qualitative and self.parameter.ref_text:
                self.parameter_ref = self.parameter.ref_text
            elif self.parameter.ref_low is not None and self.parameter.ref_high is not None:
                self.parameter_ref = f"{self.parameter.ref_low} - {self.parameter.ref_high}"
            elif self.parameter.ref_low is not None:
                self.parameter_ref = f"≥ {self.parameter.ref_low}"
            elif self.parameter.ref_high is not None:
                self.parameter_ref = f"≤ {self.parameter.ref_high}"
            self.sort_order = self.parameter.sort_order
        # Auto-flag
        if self.value and self.flag == "NORMAL":
            self.auto_flag()
        super().save(*args, **kwargs)
