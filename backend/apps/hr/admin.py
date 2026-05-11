from django.contrib import admin
from .models import (
    Designation, Employee, EmploymentContract,
    LeaveType, LeaveBalance, LeaveRequest,
)


@admin.register(Designation)
class DesignationAdmin(admin.ModelAdmin):
    list_display = ["code", "title", "grade", "base_salary", "is_active"]
    list_filter = ["grade", "is_active"]
    search_fields = ["code", "title"]


@admin.register(Employee)
class EmployeeAdmin(admin.ModelAdmin):
    list_display = ["employee_code", "first_name", "last_name",
                     "designation", "department", "status", "date_of_joining"]
    list_filter = ["status", "department", "designation", "employment_type"]
    search_fields = ["employee_code", "first_name", "last_name", "phone"]
    autocomplete_fields = ["designation", "department", "reports_to", "user"]
    readonly_fields = ["employee_code", "created_at", "updated_at"]


@admin.register(EmploymentContract)
class EmploymentContractAdmin(admin.ModelAdmin):
    list_display = ["contract_number", "employee", "start_date",
                     "end_date", "monthly_salary", "is_active"]
    autocomplete_fields = ["employee"]


@admin.register(LeaveType)
class LeaveTypeAdmin(admin.ModelAdmin):
    list_display = ["code", "name", "days_per_year", "is_paid", "is_active"]


@admin.register(LeaveBalance)
class LeaveBalanceAdmin(admin.ModelAdmin):
    list_display = ["employee", "leave_type", "year",
                     "allocated", "used", "pending"]
    list_filter = ["year", "leave_type"]
    autocomplete_fields = ["employee", "leave_type"]


@admin.register(LeaveRequest)
class LeaveRequestAdmin(admin.ModelAdmin):
    list_display = ["code", "employee", "leave_type",
                     "start_date", "end_date", "num_days", "status"]
    list_filter = ["status", "leave_type"]
    autocomplete_fields = ["employee", "leave_type", "approved_by"]
    readonly_fields = ["code", "applied_at", "decision_at"]
