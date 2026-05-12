"""
Insurance & TPA module — Phase 4c.

Models:
  • InsuranceCompany    — insurer master (Star, HDFC Ergo, Bajaj Allianz, etc.)
  • TPA                 — Third-Party Administrators (Medi Assist, Paramount, etc.)
  • PolicyCoverage      — patient-level active policy
  • PreAuth             — pre-authorization request to TPA
  • Claim               — claim submission against PreAuth + Invoice
  • ClaimLine           — line breakdown of claim
  • ClaimDocument       — uploaded supporting docs (discharge summary, bills, etc.)
"""
from decimal import Decimal
from django.db import models
from django.utils import timezone


class InsuranceCompany(models.Model):
    hospital = models.ForeignKey("core.Hospital", on_delete=models.CASCADE,
                                  related_name="insurance_companies")
    code = models.CharField(max_length=20, db_index=True)
    name = models.CharField(max_length=200)
    short_name = models.CharField(max_length=50, blank=True, default="")
    contact_person = models.CharField(max_length=120, blank=True, default="")
    phone = models.CharField(max_length=20, blank=True, default="")
    email = models.EmailField(blank=True, default="")
    helpline_number = models.CharField(max_length=20, blank=True, default="")
    portal_url = models.URLField(blank=True, default="")
    is_empanelled = models.BooleanField(default=True,
        help_text="Hospital is empanelled with this insurer")
    is_cashless = models.BooleanField(default=True)
    is_active = models.BooleanField(default=True)
    notes = models.TextField(blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["name"]
        unique_together = [["hospital", "code"]]
        verbose_name_plural = "Insurance Companies"

    def __str__(self):
        return f"{self.code} — {self.name}"


class TPA(models.Model):
    hospital = models.ForeignKey("core.Hospital", on_delete=models.CASCADE,
                                  related_name="tpas")
    code = models.CharField(max_length=20, db_index=True)
    name = models.CharField(max_length=200)
    short_name = models.CharField(max_length=50, blank=True, default="")
    contact_person = models.CharField(max_length=120, blank=True, default="")
    phone = models.CharField(max_length=20, blank=True, default="")
    email = models.EmailField(blank=True, default="")
    address = models.TextField(blank=True, default="")
    portal_url = models.URLField(blank=True, default="")
    insurance_companies = models.ManyToManyField(
        InsuranceCompany, blank=True, related_name="tpas",
        help_text="Insurers this TPA administers")
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["name"]
        unique_together = [["hospital", "code"]]
        verbose_name = "TPA"
        verbose_name_plural = "TPAs"


class PolicyCoverage(models.Model):
    COVER_TYPES = [
        ("INDIVIDUAL", "Individual"),
        ("FAMILY",     "Family Floater"),
        ("GROUP",      "Group / Corporate"),
        ("SENIOR",     "Senior Citizen"),
        ("MATERNITY",  "Maternity Add-on"),
    ]

    hospital = models.ForeignKey("core.Hospital", on_delete=models.CASCADE,
                                  related_name="policy_coverages")
    patient = models.ForeignKey("core.Patient", on_delete=models.CASCADE,
                                   related_name="policies")
    insurance_company = models.ForeignKey(InsuranceCompany, on_delete=models.PROTECT,
                                             related_name="policies")
    tpa = models.ForeignKey(TPA, on_delete=models.SET_NULL,
                              null=True, blank=True, related_name="policies")

    policy_number = models.CharField(max_length=50, db_index=True)
    member_id = models.CharField(max_length=50, blank=True, default="",
        help_text="Member/UHID/Ecard ID")

    policy_holder_name = models.CharField(max_length=120,
        help_text="If different from patient")
    relation_to_holder = models.CharField(max_length=30, blank=True, default="")
    cover_type = models.CharField(max_length=12, choices=COVER_TYPES,
                                     default="INDIVIDUAL")

    sum_insured = models.DecimalField(max_digits=12, decimal_places=2,
                                          default=Decimal("0"))
    co_pay_percentage = models.DecimalField(max_digits=5, decimal_places=2,
                                               default=Decimal("0"))

    policy_start_date = models.DateField()
    policy_end_date = models.DateField()
    is_active = models.BooleanField(default=True)
    notes = models.TextField(blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-policy_start_date"]


class PreAuth(models.Model):
    STATUSES = [
        ("DRAFT",      "Draft"),
        ("SUBMITTED",  "Submitted to TPA"),
        ("APPROVED",   "Approved"),
        ("PARTIAL",    "Partially Approved"),
        ("REJECTED",   "Rejected"),
        ("EXPIRED",    "Expired"),
        ("CANCELLED",  "Cancelled"),
    ]
    URGENCY = [
        ("PLANNED", "Planned Admission"),
        ("EMERG",   "Emergency"),
    ]

    hospital = models.ForeignKey("core.Hospital", on_delete=models.CASCADE,
                                  related_name="pre_auths")
    code = models.CharField(max_length=30, unique=True, db_index=True,
        help_text="Auto-generated, e.g. PA-20260508-0001")

    patient = models.ForeignKey("core.Patient", on_delete=models.PROTECT,
                                   related_name="pre_auths")
    policy = models.ForeignKey(PolicyCoverage, on_delete=models.PROTECT,
                                  related_name="pre_auths")
    admission = models.ForeignKey("ipd.Admission", on_delete=models.SET_NULL,
                                     null=True, blank=True, related_name="pre_auths")

    urgency = models.CharField(max_length=10, choices=URGENCY, default="PLANNED")
    status = models.CharField(max_length=12, choices=STATUSES, default="DRAFT",
                                db_index=True)

    request_date = models.DateField(default=timezone.localdate)
    expected_admission_date = models.DateField(null=True, blank=True)
    expected_stay_days = models.PositiveIntegerField(default=1)

    primary_diagnosis = models.CharField(max_length=300)
    treatment_plan = models.TextField()

    requested_amount = models.DecimalField(max_digits=12, decimal_places=2,
                                              default=Decimal("0"))
    approved_amount = models.DecimalField(max_digits=12, decimal_places=2,
                                             default=Decimal("0"))

    tpa_reference = models.CharField(max_length=50, blank=True, default="",
        help_text="TPA-assigned reference / pre-auth number")
    submitted_at = models.DateTimeField(null=True, blank=True)
    decision_at = models.DateTimeField(null=True, blank=True)
    decision_notes = models.TextField(blank=True, default="")
    valid_until = models.DateField(null=True, blank=True)

    requested_by = models.ForeignKey("accounts.User", on_delete=models.SET_NULL,
                                        null=True, blank=True,
                                        related_name="pre_auths_requested")
    notes = models.TextField(blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-request_date"]


class Claim(models.Model):
    STATUSES = [
        ("DRAFT",      "Draft"),
        ("SUBMITTED",  "Submitted to TPA"),
        ("UNDER_REVIEW","Under Review"),
        ("APPROVED",   "Approved"),
        ("PARTIAL",    "Partially Approved"),
        ("REJECTED",   "Rejected"),
        ("SETTLED",    "Settled (Paid)"),
        ("CLOSED",     "Closed"),
    ]
    CLAIM_TYPES = [
        ("CASHLESS",     "Cashless"),
        ("REIMBURSEMENT","Reimbursement"),
    ]

    hospital = models.ForeignKey("core.Hospital", on_delete=models.CASCADE,
                                  related_name="claims")
    code = models.CharField(max_length=30, unique=True, db_index=True,
        help_text="Auto-generated, e.g. CL-20260508-0001")

    patient = models.ForeignKey("core.Patient", on_delete=models.PROTECT,
                                   related_name="claims")
    policy = models.ForeignKey(PolicyCoverage, on_delete=models.PROTECT,
                                  related_name="claims")
    pre_auth = models.ForeignKey(PreAuth, on_delete=models.SET_NULL,
                                    null=True, blank=True, related_name="claims")
    invoice = models.ForeignKey("billing.Invoice", on_delete=models.SET_NULL,
                                   null=True, blank=True, related_name="claims")
    admission = models.ForeignKey("ipd.Admission", on_delete=models.SET_NULL,
                                     null=True, blank=True, related_name="claims")

    claim_type = models.CharField(max_length=15, choices=CLAIM_TYPES, default="CASHLESS")
    status = models.CharField(max_length=12, choices=STATUSES, default="DRAFT")

    submission_date = models.DateField(default=timezone.localdate)
    tpa_claim_number = models.CharField(max_length=50, blank=True, default="")

    # Amounts
    bill_amount = models.DecimalField(max_digits=12, decimal_places=2,
                                          default=Decimal("0"))
    co_pay_amount = models.DecimalField(max_digits=12, decimal_places=2,
                                           default=Decimal("0"))
    deductions = models.DecimalField(max_digits=12, decimal_places=2,
                                        default=Decimal("0"))
    claim_amount = models.DecimalField(max_digits=12, decimal_places=2,
                                          default=Decimal("0"),
        help_text="Bill - Co-pay - Deductions")
    approved_amount = models.DecimalField(max_digits=12, decimal_places=2,
                                             default=Decimal("0"))
    settled_amount = models.DecimalField(max_digits=12, decimal_places=2,
                                            default=Decimal("0"))
    settled_date = models.DateField(null=True, blank=True)

    rejection_reason = models.TextField(blank=True, default="")
    notes = models.TextField(blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-submission_date"]


class ClaimLine(models.Model):
    claim = models.ForeignKey(Claim, on_delete=models.CASCADE, related_name="lines")
    description = models.CharField(max_length=300)
    quantity = models.DecimalField(max_digits=10, decimal_places=2,
                                       default=Decimal("1"))
    rate = models.DecimalField(max_digits=12, decimal_places=2)
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    is_disallowed = models.BooleanField(default=False)
    disallowance_reason = models.CharField(max_length=300, blank=True, default="")


class ClaimDocument(models.Model):
    DOC_TYPES = [
        ("DISCHARGE", "Discharge Summary"),
        ("BILL",      "Hospital Bill"),
        ("BILLS_PHARMA","Pharmacy Bills"),
        ("LAB",       "Lab Reports"),
        ("PHOTOS",    "Photos / Imaging"),
        ("PRESCRIPTION","Prescriptions"),
        ("ID_PROOF",  "ID Proof"),
        ("POLICY_COPY","Policy Copy"),
        ("CLAIM_FORM","Claim Form"),
        ("OTHER",     "Other"),
    ]
    claim = models.ForeignKey(Claim, on_delete=models.CASCADE, related_name="documents")
    document_type = models.CharField(max_length=15, choices=DOC_TYPES)
    document_url = models.URLField()
    description = models.CharField(max_length=200, blank=True, default="")
    uploaded_at = models.DateTimeField(auto_now_add=True)
