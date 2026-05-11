from rest_framework import serializers, viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response

from .models import (
    SalaryComponent, SalaryStructure, SalaryStructureLine,
    PayrollRun, Payslip, PayslipLine, LoanAdvance,
)
from .services import payroll_service


class SalaryComponentSerializer(serializers.ModelSerializer):
    component_type_label = serializers.CharField(source="get_component_type_display",
                                                    read_only=True)
    class Meta:
        model = SalaryComponent
        fields = "__all__"


class SalaryStructureLineSerializer(serializers.ModelSerializer):
    component_code = serializers.CharField(source="component.code", read_only=True)
    component_name = serializers.CharField(source="component.name", read_only=True)
    component_type = serializers.CharField(source="component.component_type",
                                              read_only=True)
    class Meta:
        model = SalaryStructureLine
        fields = "__all__"


class SalaryStructureSerializer(serializers.ModelSerializer):
    employee_code = serializers.CharField(source="employee.employee_code", read_only=True)
    employee_name = serializers.CharField(source="employee.full_name", read_only=True)
    lines = SalaryStructureLineSerializer(many=True, read_only=True)
    class Meta:
        model = SalaryStructure
        fields = "__all__"


class PayslipLineSerializer(serializers.ModelSerializer):
    component_code = serializers.CharField(source="component.code", read_only=True)
    component_name = serializers.CharField(source="component.name", read_only=True)
    class Meta:
        model = PayslipLine
        fields = "__all__"


class PayslipSerializer(serializers.ModelSerializer):
    employee_code = serializers.CharField(source="employee.employee_code", read_only=True)
    employee_name = serializers.CharField(source="employee.full_name", read_only=True)
    status_label = serializers.CharField(source="get_status_display", read_only=True)
    lines = PayslipLineSerializer(many=True, read_only=True)
    class Meta:
        model = Payslip
        fields = "__all__"


class PayrollRunSerializer(serializers.ModelSerializer):
    status_label = serializers.CharField(source="get_status_display", read_only=True)
    payslips = PayslipSerializer(many=True, read_only=True)
    class Meta:
        model = PayrollRun
        fields = "__all__"


class LoanAdvanceSerializer(serializers.ModelSerializer):
    employee_name = serializers.CharField(source="employee.full_name", read_only=True)
    status_label = serializers.CharField(source="get_status_display", read_only=True)
    class Meta:
        model = LoanAdvance
        fields = "__all__"


class SalaryComponentViewSet(viewsets.ModelViewSet):
    queryset = SalaryComponent.objects.all()
    serializer_class = SalaryComponentSerializer
    filterset_fields = ["component_type", "is_active"]


class SalaryStructureViewSet(viewsets.ModelViewSet):
    queryset = (SalaryStructure.objects.select_related("employee")
                .prefetch_related("lines__component").all())
    serializer_class = SalaryStructureSerializer
    filterset_fields = ["employee"]


class PayrollRunViewSet(viewsets.ModelViewSet):
    queryset = PayrollRun.objects.prefetch_related("payslips").all()
    serializer_class = PayrollRunSerializer
    filterset_fields = ["status", "year", "month"]

    def create(self, request, *args, **kwargs):
        from apps.core.models import Hospital
        try:
            hospital = Hospital.objects.first()
            run = payroll_service.create_payroll_run(
                hospital=hospital,
                year=int(request.data["year"]),
                month=int(request.data["month"]),
            )
        except KeyError as e:
            return Response({"detail": f"Missing field: {e}"}, status=400)
        except Exception as e:
            return Response({"detail": str(e)}, status=400)
        return Response(self.get_serializer(run).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"])
    def process(self, request, pk=None):
        run = self.get_object()
        try:
            payroll_service.process_payroll(run)
        except Exception as e:
            return Response({"detail": str(e)}, status=400)
        return Response(self.get_serializer(run).data)

    @action(detail=True, methods=["post"])
    def approve(self, request, pk=None):
        run = self.get_object()
        try:
            payroll_service.approve_payroll(run)
        except Exception as e:
            return Response({"detail": str(e)}, status=400)
        return Response(self.get_serializer(run).data)

    @action(detail=True, methods=["post"], url_path="mark-paid")
    def mark_paid(self, request, pk=None):
        run = self.get_object()
        try:
            payroll_service.mark_paid(run)
        except Exception as e:
            return Response({"detail": str(e)}, status=400)
        return Response(self.get_serializer(run).data)


class PayslipViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = (Payslip.objects.select_related("employee", "payroll_run")
                .prefetch_related("lines__component").all())
    serializer_class = PayslipSerializer
    filterset_fields = ["payroll_run", "employee", "status"]


class LoanAdvanceViewSet(viewsets.ModelViewSet):
    queryset = LoanAdvance.objects.select_related("employee").all()
    serializer_class = LoanAdvanceSerializer
    filterset_fields = ["employee", "status"]
