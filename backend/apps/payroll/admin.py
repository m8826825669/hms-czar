from django.contrib import admin
from .models import (
    SalaryComponent, SalaryStructure, SalaryStructureLine,
    PayrollRun, Payslip, PayslipLine, LoanAdvance,
)


@admin.register(SalaryComponent)
class SalaryComponentAdmin(admin.ModelAdmin):
    list_display = ["code", "name", "component_type", "calculation_type",
                     "default_value", "is_active"]
    list_filter = ["component_type", "is_active"]


class SalaryStructureLineInline(admin.TabularInline):
    model = SalaryStructureLine
    extra = 0
    raw_id_fields = ["component"]


@admin.register(SalaryStructure)
class SalaryStructureAdmin(admin.ModelAdmin):
    list_display = ["employee", "gross_salary", "effective_from", "effective_to"]
    raw_id_fields = ["employee"]
    inlines = [SalaryStructureLineInline]


class PayslipInline(admin.TabularInline):
    model = Payslip
    extra = 0
    readonly_fields = ["code", "gross_earnings", "gross_deductions", "net_pay"]


@admin.register(PayrollRun)
class PayrollRunAdmin(admin.ModelAdmin):
    list_display = ["code", "year", "month", "status",
                     "total_employees", "total_net"]
    list_filter = ["status", "year"]
    readonly_fields = ["code", "total_employees", "total_gross",
                         "total_deductions", "total_net",
                         "processed_at", "approved_at", "paid_at"]


class PayslipLineInline(admin.TabularInline):
    model = PayslipLine
    extra = 0
    raw_id_fields = ["component"]


@admin.register(Payslip)
class PayslipAdmin(admin.ModelAdmin):
    list_display = ["code", "employee", "payroll_run", "gross_earnings",
                     "gross_deductions", "net_pay", "status"]
    list_filter = ["status", "payroll_run"]
    raw_id_fields = ["employee", "payroll_run"]
    inlines = [PayslipLineInline]


@admin.register(LoanAdvance)
class LoanAdvanceAdmin(admin.ModelAdmin):
    list_display = ["code", "employee", "loan_amount",
                     "monthly_deduction", "total_paid", "status"]
    list_filter = ["status"]
    raw_id_fields = ["employee"]
