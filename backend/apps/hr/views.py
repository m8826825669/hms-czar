from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response

from .models import (
    Designation, Employee, EmploymentContract,
    LeaveType, LeaveBalance, LeaveRequest,
)
from .serializers import (
    DesignationSerializer, EmployeeSerializer, EmploymentContractSerializer,
    LeaveTypeSerializer, LeaveBalanceSerializer, LeaveRequestSerializer,
)
from .services import hr_service


class DesignationViewSet(viewsets.ModelViewSet):
    queryset = Designation.objects.all()
    serializer_class = DesignationSerializer
    filterset_fields = ["grade", "is_active"]


class EmployeeViewSet(viewsets.ModelViewSet):
    queryset = (Employee.objects
                .select_related("designation", "department", "reports_to").all())
    serializer_class = EmployeeSerializer
    filterset_fields = ["status", "department", "designation", "employment_type"]
    search_fields = ["employee_code", "first_name", "last_name", "phone", "email"]

    def create(self, request, *args, **kwargs):
        from apps.core.models import Hospital
        from apps.department.models import Department
        try:
            hospital = Hospital.objects.first()
            desig = Designation.objects.get(id=request.data["designation"])
            dept = (Department.objects.get(id=request.data["department"])
                    if request.data.get("department") else None)
            emp = hr_service.onboard_employee(
                hospital=hospital, designation=desig,
                first_name=request.data["first_name"],
                last_name=request.data["last_name"],
                phone=request.data["phone"],
                date_of_joining=request.data["date_of_joining"],
                middle_name=request.data.get("middle_name", ""),
                gender=request.data.get("gender", "M"),
                email=request.data.get("email", ""),
                department=dept,
                employment_type=request.data.get("employment_type", "PERM"),
                aadhaar_number=request.data.get("aadhaar_number", ""),
                pan_number=request.data.get("pan_number", ""),
                bank_name=request.data.get("bank_name", ""),
                bank_account_number=request.data.get("bank_account_number", ""),
                bank_ifsc=request.data.get("bank_ifsc", ""),
            )
        except KeyError as e:
            return Response({"detail": f"Missing field: {e}"}, status=400)
        except Exception as e:
            return Response({"detail": str(e)}, status=400)
        return Response(self.get_serializer(emp).data, status=status.HTTP_201_CREATED)


class EmploymentContractViewSet(viewsets.ModelViewSet):
    queryset = EmploymentContract.objects.select_related("employee").all()
    serializer_class = EmploymentContractSerializer
    filterset_fields = ["employee", "is_active"]


class LeaveTypeViewSet(viewsets.ModelViewSet):
    queryset = LeaveType.objects.all()
    serializer_class = LeaveTypeSerializer
    filterset_fields = ["is_active", "is_paid"]


class LeaveBalanceViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = LeaveBalance.objects.select_related("employee", "leave_type").all()
    serializer_class = LeaveBalanceSerializer
    filterset_fields = ["employee", "leave_type", "year"]


class LeaveRequestViewSet(viewsets.ModelViewSet):
    queryset = LeaveRequest.objects.select_related(
        "employee", "leave_type", "approved_by").all()
    serializer_class = LeaveRequestSerializer
    filterset_fields = ["status", "employee", "leave_type"]

    def create(self, request, *args, **kwargs):
        from apps.core.models import Hospital
        from datetime import date
        try:
            hospital = Hospital.objects.first()
            emp = Employee.objects.get(id=request.data["employee"])
            lt = LeaveType.objects.get(id=request.data["leave_type"])
            req = hr_service.apply_leave(
                hospital=hospital, employee=emp, leave_type=lt,
                start_date=date.fromisoformat(request.data["start_date"]),
                end_date=date.fromisoformat(request.data["end_date"]),
                reason=request.data["reason"],
                contact_during_leave=request.data.get("contact_during_leave", ""),
            )
        except KeyError as e:
            return Response({"detail": f"Missing field: {e}"}, status=400)
        except Exception as e:
            return Response({"detail": str(e)}, status=400)
        return Response(self.get_serializer(req).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"])
    def approve(self, request, pk=None):
        req = self.get_object()
        approved_by_id = request.data.get("approved_by_id")
        try:
            approver = Employee.objects.get(id=approved_by_id) if approved_by_id else None
            hr_service.approve_leave(req, approved_by=approver,
                decision_notes=request.data.get("decision_notes", ""))
        except Exception as e:
            return Response({"detail": str(e)}, status=400)
        return Response(self.get_serializer(req).data)

    @action(detail=True, methods=["post"])
    def reject(self, request, pk=None):
        req = self.get_object()
        rejected_by_id = request.data.get("rejected_by_id")
        try:
            rejector = Employee.objects.get(id=rejected_by_id) if rejected_by_id else None
            hr_service.reject_leave(req, rejected_by=rejector,
                decision_notes=request.data.get("decision_notes", ""))
        except Exception as e:
            return Response({"detail": str(e)}, status=400)
        return Response(self.get_serializer(req).data)
