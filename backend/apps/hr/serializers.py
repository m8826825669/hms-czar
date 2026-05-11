from rest_framework import serializers
from .models import (
    Designation, Employee, EmploymentContract,
    LeaveType, LeaveBalance, LeaveRequest,
)


class DesignationSerializer(serializers.ModelSerializer):
    grade_label = serializers.CharField(source="get_grade_display", read_only=True)
    class Meta:
        model = Designation
        fields = "__all__"


class EmployeeSerializer(serializers.ModelSerializer):
    full_name = serializers.CharField(read_only=True)
    designation_title = serializers.CharField(source="designation.title", read_only=True)
    department_name = serializers.CharField(source="department.name", read_only=True)
    employment_type_label = serializers.CharField(source="get_employment_type_display",
                                                     read_only=True)
    status_label = serializers.CharField(source="get_status_display", read_only=True)
    years_of_service = serializers.FloatField(read_only=True)
    class Meta:
        model = Employee
        fields = "__all__"


class EmploymentContractSerializer(serializers.ModelSerializer):
    employee_name = serializers.CharField(source="employee.full_name", read_only=True)
    class Meta:
        model = EmploymentContract
        fields = "__all__"


class LeaveTypeSerializer(serializers.ModelSerializer):
    class Meta:
        model = LeaveType
        fields = "__all__"


class LeaveBalanceSerializer(serializers.ModelSerializer):
    employee_name = serializers.CharField(source="employee.full_name", read_only=True)
    leave_type_code = serializers.CharField(source="leave_type.code", read_only=True)
    leave_type_name = serializers.CharField(source="leave_type.name", read_only=True)
    available = serializers.DecimalField(max_digits=5, decimal_places=1, read_only=True)
    class Meta:
        model = LeaveBalance
        fields = "__all__"


class LeaveRequestSerializer(serializers.ModelSerializer):
    employee_code = serializers.CharField(source="employee.employee_code", read_only=True)
    employee_name = serializers.CharField(source="employee.full_name", read_only=True)
    leave_type_code = serializers.CharField(source="leave_type.code", read_only=True)
    leave_type_name = serializers.CharField(source="leave_type.name", read_only=True)
    status_label = serializers.CharField(source="get_status_display", read_only=True)
    class Meta:
        model = LeaveRequest
        fields = "__all__"
