"""
HR module — Phase 4b.

Models:
  • Designation         — job title catalog
  • Employee            — staff master with personal/professional details
  • EmploymentContract  — contract terms + dates
  • LeaveType           — leave catalog (CL/SL/EL/Maternity/...)
  • LeaveBalance        — annual balance per employee per type
  • LeaveRequest        — application + approval flow
"""
from decimal import Decimal
from django.db import models
from django.utils import timezone

def _current_year():
    return timezone.now().year

class Designation(models.Model):
    GRADES = [
        ("EXEC",   "Executive"),
        ("MGR",    "Manager"),
        ("SR",     "Senior"),
        ("MID",    "Mid-level"),
        ("JR",     "Junior"),
        ("TRAINEE","Trainee"),
    ]
    hospital = models.ForeignKey("core.Hospital", on_delete=models.CASCADE,
                                  related_name="designations")
    code = models.CharField(max_length=20, db_index=True)
    title = models.CharField(max_length=120)
    grade = models.CharField(max_length=10, choices=GRADES, default="MID")
    base_salary = models.DecimalField(max_digits=12, decimal_places=2,
                                        default=Decimal("0"))
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["grade", "title"]
        unique_together = [["hospital", "code"]]

    def __str__(self):
        return f"{self.code} — {self.title}"


class Employee(models.Model):
    GENDERS = [("M", "Male"), ("F", "Female"), ("O", "Other")]
    EMPLOYMENT_TYPES = [
        ("PERM",     "Permanent"),
        ("CONTRACT", "Contract"),
        ("CONSULTANT","Visiting Consultant"),
        ("INTERN",   "Intern"),
        ("LOCUM",    "Locum"),
    ]
    STATUSES = [
        ("ACTIVE",      "Active"),
        ("ON_LEAVE",    "On Long Leave"),
        ("SUSPENDED",   "Suspended"),
        ("RESIGNED",    "Resigned"),
        ("TERMINATED",  "Terminated"),
        ("RETIRED",     "Retired"),
    ]
    BLOOD_GROUPS = [
        ("A+", "A+"), ("A-", "A-"), ("B+", "B+"), ("B-", "B-"),
        ("AB+", "AB+"), ("AB-", "AB-"), ("O+", "O+"), ("O-", "O-"),
        ("UNK", "Unknown"),
    ]

    hospital = models.ForeignKey("core.Hospital", on_delete=models.CASCADE,
                                  related_name="employees")
    employee_code = models.CharField(max_length=20, unique=True, db_index=True,
        help_text="Auto-generated, e.g. EMP-2026-0001")
    user = models.OneToOneField("accounts.User", on_delete=models.SET_NULL,
                                  null=True, blank=True,
                                  related_name="employee_profile")

    # Personal
    first_name = models.CharField(max_length=60)
    middle_name = models.CharField(max_length=60, blank=True, default="")
    last_name = models.CharField(max_length=60)
    gender = models.CharField(max_length=1, choices=GENDERS, default="M")
    date_of_birth = models.DateField(null=True, blank=True)
    blood_group = models.CharField(max_length=5, choices=BLOOD_GROUPS, default="UNK")
    marital_status = models.CharField(max_length=20, blank=True, default="")

    # Contact
    phone = models.CharField(max_length=20, db_index=True)
    alternate_phone = models.CharField(max_length=20, blank=True, default="")
    email = models.EmailField(blank=True, default="")
    address = models.TextField(blank=True, default="")
    emergency_contact_name = models.CharField(max_length=120, blank=True, default="")
    emergency_contact_phone = models.CharField(max_length=20, blank=True, default="")

    # Government IDs
    aadhaar_number = models.CharField(max_length=12, blank=True, default="",
        help_text="12-digit Aadhaar")
    pan_number = models.CharField(max_length=10, blank=True, default="")

    # Employment
    department = models.ForeignKey(
        "department.Department", on_delete=models.SET_NULL,
        null=True, blank=True, related_name="employees",
    )
    designation = models.ForeignKey(Designation, on_delete=models.PROTECT,
                                       related_name="employees")
    employment_type = models.CharField(max_length=15, choices=EMPLOYMENT_TYPES,
                                          default="PERM")
    reports_to = models.ForeignKey("self", on_delete=models.SET_NULL,
                                      null=True, blank=True,
                                      related_name="direct_reports")

    date_of_joining = models.DateField()
    date_of_leaving = models.DateField(null=True, blank=True)
    probation_end_date = models.DateField(null=True, blank=True)
    confirmation_date = models.DateField(null=True, blank=True)

    status = models.CharField(max_length=12, choices=STATUSES, default="ACTIVE",
                                db_index=True)

    # Banking (for payroll)
    bank_name = models.CharField(max_length=100, blank=True, default="")
    bank_account_number = models.CharField(max_length=30, blank=True, default="")
    bank_ifsc = models.CharField(max_length=15, blank=True, default="")

    # PF/ESI
    pf_number = models.CharField(max_length=30, blank=True, default="")
    uan_number = models.CharField(max_length=15, blank=True, default="")
    esi_number = models.CharField(max_length=20, blank=True, default="")

    notes = models.TextField(blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["employee_code"]
        indexes = [
            models.Index(fields=["status", "department"]),
        ]

    def __str__(self):
        return f"{self.employee_code} — {self.first_name} {self.last_name}"

    @property
    def full_name(self):
        parts = [self.first_name, self.middle_name, self.last_name]
        return " ".join(p for p in parts if p)

    @property
    def years_of_service(self):
        end = self.date_of_leaving or timezone.localdate()
        return (end - self.date_of_joining).days / 365.25


class EmploymentContract(models.Model):
    employee = models.ForeignKey(Employee, on_delete=models.CASCADE,
                                    related_name="contracts")
    contract_number = models.CharField(max_length=30, db_index=True)
    start_date = models.DateField()
    end_date = models.DateField(null=True, blank=True,
        help_text="Null for permanent contracts")
    monthly_salary = models.DecimalField(max_digits=12, decimal_places=2)
    notice_period_days = models.PositiveIntegerField(default=30)
    is_active = models.BooleanField(default=True)
    contract_terms = models.TextField(blank=True, default="")
    signed_date = models.DateField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-start_date"]


class LeaveType(models.Model):
    hospital = models.ForeignKey("core.Hospital", on_delete=models.CASCADE,
                                  related_name="leave_types")
    code = models.CharField(max_length=20, db_index=True,
        help_text="e.g. CL, SL, EL, ML")
    name = models.CharField(max_length=80)
    days_per_year = models.DecimalField(max_digits=5, decimal_places=1,
                                          default=Decimal("12.0"))
    is_paid = models.BooleanField(default=True)
    is_carry_forward = models.BooleanField(default=False)
    max_carry_forward = models.DecimalField(max_digits=5, decimal_places=1,
                                              default=Decimal("0"))
    requires_attachment = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["code"]
        unique_together = [["hospital", "code"]]


class LeaveBalance(models.Model):
    employee = models.ForeignKey(Employee, on_delete=models.CASCADE,
                                    related_name="leave_balances")
    leave_type = models.ForeignKey(LeaveType, on_delete=models.PROTECT,
                                       related_name="balances")
    year = models.PositiveIntegerField(default=_current_year)
    allocated = models.DecimalField(max_digits=5, decimal_places=1)
    used = models.DecimalField(max_digits=5, decimal_places=1, default=Decimal("0"))
    pending = models.DecimalField(max_digits=5, decimal_places=1, default=Decimal("0"))

    class Meta:
        unique_together = [["employee", "leave_type", "year"]]

    @property
    def available(self):
        return self.allocated - self.used - self.pending


class LeaveRequest(models.Model):
    STATUSES = [
        ("DRAFT",     "Draft"),
        ("SUBMITTED", "Submitted"),
        ("APPROVED",  "Approved"),
        ("REJECTED",  "Rejected"),
        ("CANCELLED", "Cancelled"),
    ]
    hospital = models.ForeignKey("core.Hospital", on_delete=models.CASCADE,
                                  related_name="leave_requests")
    code = models.CharField(max_length=30, unique=True, db_index=True)
    employee = models.ForeignKey(Employee, on_delete=models.PROTECT,
                                    related_name="leave_requests")
    leave_type = models.ForeignKey(LeaveType, on_delete=models.PROTECT,
                                       related_name="requests")

    start_date = models.DateField()
    end_date = models.DateField()
    num_days = models.DecimalField(max_digits=5, decimal_places=1)

    reason = models.TextField()
    contact_during_leave = models.CharField(max_length=200, blank=True, default="")

    status = models.CharField(max_length=12, choices=STATUSES, default="SUBMITTED")
    applied_at = models.DateTimeField(default=timezone.now)
    approved_by = models.ForeignKey(Employee, on_delete=models.SET_NULL,
                                       null=True, blank=True,
                                       related_name="leaves_approved")
    decision_at = models.DateTimeField(null=True, blank=True)
    decision_notes = models.CharField(max_length=300, blank=True, default="")

    attachment_url = models.URLField(blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-applied_at"]
