from datetime import datetime
from django.utils import timezone
from rest_framework import serializers, viewsets, status
from rest_framework.decorators import action, api_view
from rest_framework.response import Response

from .models import SecurityGuard, VisitorPass, GatePass, Incident
from .services import security_service


class SecurityGuardSerializer(serializers.ModelSerializer):
    class Meta:
        model = SecurityGuard
        fields = "__all__"


class VisitorPassSerializer(serializers.ModelSerializer):
    visit_type_label = serializers.CharField(source="get_visit_type_display",
                                                read_only=True)
    status_label = serializers.CharField(source="get_status_display", read_only=True)
    issued_by_name = serializers.CharField(source="issued_by.full_name", read_only=True)
    visiting_patient_name = serializers.CharField(
        source="visiting_patient.full_name", read_only=True)
    department_name = serializers.CharField(
        source="department_to_visit.name", read_only=True)
    class Meta:
        model = VisitorPass
        fields = "__all__"


class GatePassSerializer(serializers.ModelSerializer):
    pass_type_label = serializers.CharField(source="get_pass_type_display",
                                               read_only=True)
    status_label = serializers.CharField(source="get_status_display", read_only=True)
    sender_department_name = serializers.CharField(
        source="sender_department.name", read_only=True)
    class Meta:
        model = GatePass
        fields = "__all__"


class IncidentSerializer(serializers.ModelSerializer):
    incident_type_label = serializers.CharField(source="get_incident_type_display",
                                                   read_only=True)
    severity_label = serializers.CharField(source="get_severity_display",
                                              read_only=True)
    status_label = serializers.CharField(source="get_status_display", read_only=True)
    department_name = serializers.CharField(source="department.name", read_only=True)
    handled_by_name = serializers.CharField(source="handled_by.full_name",
                                               read_only=True)
    class Meta:
        model = Incident
        fields = "__all__"


class SecurityGuardViewSet(viewsets.ModelViewSet):
    queryset = SecurityGuard.objects.all()
    serializer_class = SecurityGuardSerializer
    filterset_fields = ["is_active", "is_supervisor"]
    search_fields = ["employee_code", "full_name"]


class VisitorPassViewSet(viewsets.ModelViewSet):
    queryset = (VisitorPass.objects
                .select_related("visiting_patient", "department_to_visit",
                                "issued_by", "exit_logged_by").all())
    serializer_class = VisitorPassSerializer
    filterset_fields = ["status", "visit_type", "department_to_visit"]
    search_fields = ["pass_number", "visitor_name", "visitor_phone",
                      "id_proof_number"]

    def create(self, request, *args, **kwargs):
        from apps.core.models import Hospital
        try:
            hospital = Hospital.objects.first()
            extra = {}
            if request.data.get("visiting_patient"):
                from apps.reception.models import Patient
                extra["visiting_patient"] = Patient.objects.get(
                    id=request.data["visiting_patient"])
            if request.data.get("department_to_visit"):
                from apps.department.models import Department
                extra["department_to_visit"] = Department.objects.get(
                    id=request.data["department_to_visit"])
            if request.data.get("issued_by"):
                extra["issued_by"] = SecurityGuard.objects.get(
                    id=request.data["issued_by"])
            if request.data.get("expected_exit_time"):
                extra["expected_exit_time"] = request.data["expected_exit_time"]

            vp = security_service.issue_visitor_pass(
                hospital=hospital,
                visitor_name=request.data["visitor_name"],
                visitor_phone=request.data["visitor_phone"],
                visit_type=request.data.get("visit_type", "PATIENT"),
                id_proof_type=request.data.get("id_proof_type", ""),
                id_proof_number=request.data.get("id_proof_number", ""),
                photo_url=request.data.get("photo_url", ""),
                purpose=request.data.get("purpose", ""),
                visiting_person=request.data.get("visiting_person", ""),
                relationship=request.data.get("relationship", ""),
                room_number=request.data.get("room_number", ""),
                **extra,
            )
        except KeyError as e:
            return Response({"detail": f"Missing field: {e}"}, status=400)
        except Exception as e:
            return Response({"detail": str(e)}, status=400)
        return Response(self.get_serializer(vp).data, status=201)

    @action(detail=True, methods=["post"], url_path="log-exit")
    def log_exit(self, request, pk=None):
        vp = self.get_object()
        try:
            exited_by = (SecurityGuard.objects.get(id=request.data["exit_logged_by"])
                         if request.data.get("exit_logged_by") else None)
            security_service.log_visitor_exit(vp, exit_logged_by=exited_by)
        except Exception as e:
            return Response({"detail": str(e)}, status=400)
        return Response(self.get_serializer(vp).data)


class GatePassViewSet(viewsets.ModelViewSet):
    queryset = GatePass.objects.select_related("sender_department",
                                                  "received_at_gate_by").all()
    serializer_class = GatePassSerializer
    filterset_fields = ["status", "pass_type"]
    search_fields = ["pass_number", "issued_to_party", "vehicle_number"]

    def create(self, request, *args, **kwargs):
        from apps.core.models import Hospital
        try:
            hospital = Hospital.objects.first()
            extra = {}
            if request.data.get("sender_department"):
                from apps.department.models import Department
                extra["sender_department"] = Department.objects.get(
                    id=request.data["sender_department"])
            if request.data.get("expected_return_at"):
                extra["expected_return_at"] = request.data["expected_return_at"]
            gp = security_service.issue_gate_pass(
                hospital=hospital,
                pass_type=request.data.get("pass_type", "RETURNABLE"),
                items_description=request.data["items_description"],
                purpose=request.data["purpose"],
                issued_to_party=request.data["issued_to_party"],
                issued_to_phone=request.data.get("issued_to_phone", ""),
                vehicle_number=request.data.get("vehicle_number", ""),
                estimated_value=request.data.get("estimated_value", 0),
                issued_by=request.user if request.user.is_authenticated else None,
                **extra,
            )
        except KeyError as e:
            return Response({"detail": f"Missing field: {e}"}, status=400)
        except Exception as e:
            return Response({"detail": str(e)}, status=400)
        return Response(self.get_serializer(gp).data, status=201)

    @action(detail=True, methods=["post"], url_path="mark-returned")
    def mark_returned(self, request, pk=None):
        gp = self.get_object()
        try:
            received_by = (SecurityGuard.objects.get(id=request.data["received_by"])
                           if request.data.get("received_by") else None)
            security_service.mark_gate_pass_returned(gp, received_by=received_by)
        except Exception as e:
            return Response({"detail": str(e)}, status=400)
        return Response(self.get_serializer(gp).data)


class IncidentViewSet(viewsets.ModelViewSet):
    queryset = Incident.objects.select_related("department", "handled_by",
                                                  "reported_by").all()
    serializer_class = IncidentSerializer
    filterset_fields = ["status", "incident_type", "severity"]
    search_fields = ["incident_number", "title", "location", "fir_number"]

    def create(self, request, *args, **kwargs):
        from apps.core.models import Hospital
        try:
            hospital = Hospital.objects.first()
            extra = {}
            if request.data.get("department"):
                from apps.department.models import Department
                extra["department"] = Department.objects.get(
                    id=request.data["department"])
            if request.data.get("handled_by"):
                extra["handled_by"] = SecurityGuard.objects.get(
                    id=request.data["handled_by"])
            inc = security_service.log_incident(
                hospital=hospital,
                incident_type=request.data["incident_type"],
                severity=request.data.get("severity", "LOW"),
                title=request.data["title"],
                description=request.data["description"],
                location=request.data["location"],
                occurred_at=request.data.get("occurred_at"),
                persons_involved=request.data.get("persons_involved", ""),
                witnesses=request.data.get("witnesses", ""),
                estimated_loss=request.data.get("estimated_loss", 0),
                reported_by=request.user if request.user.is_authenticated else None,
                **extra,
            )
        except KeyError as e:
            return Response({"detail": f"Missing field: {e}"}, status=400)
        except Exception as e:
            return Response({"detail": str(e)}, status=400)
        return Response(self.get_serializer(inc).data, status=201)

    @action(detail=True, methods=["post"])
    def escalate(self, request, pk=None):
        inc = self.get_object()
        try:
            security_service.escalate_incident(inc,
                fir_number=request.data.get("fir_number", ""),
                actions_taken=request.data.get("actions_taken", ""))
        except Exception as e:
            return Response({"detail": str(e)}, status=400)
        return Response(self.get_serializer(inc).data)


@api_view(["GET"])
def security_dashboard(request):
    from apps.core.models import Hospital
    today = timezone.localdate()
    return Response({
        "active_visitors": VisitorPass.objects.filter(status="ACTIVE").count(),
        "visitors_today": VisitorPass.objects.filter(
            entry_time__date=today).count(),
        "open_gate_passes": GatePass.objects.filter(status="ISSUED").count(),
        "recent_incidents": Incident.objects.exclude(
            status__in=["CLOSED", "RESOLVED"]).count(),
        "critical_incidents": Incident.objects.filter(
            severity="CRITICAL", status__in=["REPORTED", "UNDER_REVIEW"]).count(),
    })
