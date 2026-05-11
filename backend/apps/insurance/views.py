from decimal import Decimal
from rest_framework import serializers, viewsets, status
from rest_framework.decorators import action, api_view
from rest_framework.response import Response

from .models import (
    InsuranceCompany, TPA, PolicyCoverage,
    PreAuth, Claim, ClaimLine, ClaimDocument,
)
from .services import insurance_service


class InsuranceCompanySerializer(serializers.ModelSerializer):
    class Meta:
        model = InsuranceCompany
        fields = "__all__"


class TPASerializer(serializers.ModelSerializer):
    class Meta:
        model = TPA
        fields = "__all__"


class PolicyCoverageSerializer(serializers.ModelSerializer):
    patient_name = serializers.CharField(source="patient.full_name", read_only=True)
    insurance_company_name = serializers.CharField(
        source="insurance_company.name", read_only=True)
    tpa_name = serializers.CharField(source="tpa.name", read_only=True)
    cover_type_label = serializers.CharField(source="get_cover_type_display",
                                                read_only=True)
    class Meta:
        model = PolicyCoverage
        fields = "__all__"


class PreAuthSerializer(serializers.ModelSerializer):
    patient_name = serializers.CharField(source="patient.full_name", read_only=True)
    policy_number = serializers.CharField(source="policy.policy_number", read_only=True)
    insurance_name = serializers.CharField(source="policy.insurance_company.name",
                                              read_only=True)
    status_label = serializers.CharField(source="get_status_display", read_only=True)
    urgency_label = serializers.CharField(source="get_urgency_display", read_only=True)
    class Meta:
        model = PreAuth
        fields = "__all__"


class ClaimLineSerializer(serializers.ModelSerializer):
    class Meta:
        model = ClaimLine
        fields = "__all__"


class ClaimDocumentSerializer(serializers.ModelSerializer):
    document_type_label = serializers.CharField(source="get_document_type_display",
                                                   read_only=True)
    class Meta:
        model = ClaimDocument
        fields = "__all__"


class ClaimSerializer(serializers.ModelSerializer):
    patient_name = serializers.CharField(source="patient.full_name", read_only=True)
    policy_number = serializers.CharField(source="policy.policy_number", read_only=True)
    insurance_name = serializers.CharField(source="policy.insurance_company.name",
                                              read_only=True)
    invoice_code = serializers.CharField(source="invoice.code", read_only=True)
    pre_auth_code = serializers.CharField(source="pre_auth.code", read_only=True)
    status_label = serializers.CharField(source="get_status_display", read_only=True)
    claim_type_label = serializers.CharField(source="get_claim_type_display",
                                                read_only=True)
    lines = ClaimLineSerializer(many=True, read_only=True)
    documents = ClaimDocumentSerializer(many=True, read_only=True)
    class Meta:
        model = Claim
        fields = "__all__"


class InsuranceCompanyViewSet(viewsets.ModelViewSet):
    queryset = InsuranceCompany.objects.all()
    serializer_class = InsuranceCompanySerializer
    filterset_fields = ["is_empanelled", "is_cashless", "is_active"]
    search_fields = ["code", "name"]


class TPAViewSet(viewsets.ModelViewSet):
    queryset = TPA.objects.prefetch_related("insurance_companies").all()
    serializer_class = TPASerializer
    filterset_fields = ["is_active"]


class PolicyCoverageViewSet(viewsets.ModelViewSet):
    queryset = (PolicyCoverage.objects
                .select_related("patient", "insurance_company", "tpa").all())
    serializer_class = PolicyCoverageSerializer
    filterset_fields = ["patient", "insurance_company", "is_active"]


class PreAuthViewSet(viewsets.ModelViewSet):
    queryset = (PreAuth.objects.select_related(
        "patient", "policy", "policy__insurance_company", "admission").all())
    serializer_class = PreAuthSerializer
    filterset_fields = ["status", "urgency", "patient"]
    search_fields = ["code", "tpa_reference"]

    def create(self, request, *args, **kwargs):
        from apps.core.models import Hospital
        from apps.reception.models import Patient
        try:
            hospital = Hospital.objects.first()
            patient = Patient.objects.get(id=request.data["patient"])
            policy = PolicyCoverage.objects.get(id=request.data["policy"])
            pa = insurance_service.submit_pre_auth(
                hospital=hospital, patient=patient, policy=policy,
                primary_diagnosis=request.data["primary_diagnosis"],
                treatment_plan=request.data["treatment_plan"],
                requested_amount=request.data["requested_amount"],
                urgency=request.data.get("urgency", "PLANNED"),
                expected_stay_days=request.data.get("expected_stay_days", 1),
                expected_admission_date=request.data.get("expected_admission_date"),
            )
        except KeyError as e:
            return Response({"detail": f"Missing field: {e}"}, status=400)
        except Exception as e:
            return Response({"detail": str(e)}, status=400)
        return Response(self.get_serializer(pa).data, status=201)

    @action(detail=True, methods=["post"])
    def approve(self, request, pk=None):
        pa = self.get_object()
        try:
            insurance_service.approve_pre_auth(
                pa,
                approved_amount=request.data["approved_amount"],
                tpa_reference=request.data.get("tpa_reference", ""),
                valid_until=request.data.get("valid_until"),
                decision_notes=request.data.get("decision_notes", ""),
            )
        except Exception as e:
            return Response({"detail": str(e)}, status=400)
        return Response(self.get_serializer(pa).data)

    @action(detail=True, methods=["post"])
    def reject(self, request, pk=None):
        pa = self.get_object()
        try:
            insurance_service.reject_pre_auth(
                pa, reason=request.data.get("reason", "")
            )
        except Exception as e:
            return Response({"detail": str(e)}, status=400)
        return Response(self.get_serializer(pa).data)


class ClaimViewSet(viewsets.ModelViewSet):
    queryset = (Claim.objects.select_related(
        "patient", "policy", "policy__insurance_company",
        "pre_auth", "invoice")
                .prefetch_related("lines", "documents").all())
    serializer_class = ClaimSerializer
    filterset_fields = ["status", "claim_type", "patient"]
    search_fields = ["code", "tpa_claim_number"]

    def create(self, request, *args, **kwargs):
        from apps.core.models import Hospital
        from apps.reception.models import Patient
        try:
            hospital = Hospital.objects.first()
            patient = Patient.objects.get(id=request.data["patient"])
            policy = PolicyCoverage.objects.get(id=request.data["policy"])
            pa = (PreAuth.objects.get(id=request.data["pre_auth"])
                  if request.data.get("pre_auth") else None)
            inv = None
            if request.data.get("invoice"):
                from apps.billing.models import Invoice
                inv = Invoice.objects.get(id=request.data["invoice"])
            claim = insurance_service.file_claim(
                hospital=hospital, patient=patient, policy=policy,
                invoice=inv, pre_auth=pa,
                claim_type=request.data.get("claim_type", "CASHLESS"),
                bill_amount=request.data.get("bill_amount", 0),
                co_pay_amount=request.data.get("co_pay_amount", 0),
                deductions=request.data.get("deductions", 0),
                lines=request.data.get("lines", []),
            )
        except KeyError as e:
            return Response({"detail": f"Missing field: {e}"}, status=400)
        except Exception as e:
            return Response({"detail": str(e)}, status=400)
        return Response(self.get_serializer(claim).data, status=201)

    @action(detail=True, methods=["post"])
    def settle(self, request, pk=None):
        claim = self.get_object()
        try:
            insurance_service.settle_claim(
                claim,
                settled_amount=request.data["settled_amount"],
                settled_date=request.data.get("settled_date"),
            )
        except Exception as e:
            return Response({"detail": str(e)}, status=400)
        return Response(self.get_serializer(claim).data)


@api_view(["GET"])
def insurance_dashboard(request):
    return Response({
        "active_policies": PolicyCoverage.objects.filter(is_active=True).count(),
        "pending_pre_auths": PreAuth.objects.filter(status="SUBMITTED").count(),
        "open_claims": Claim.objects.exclude(
            status__in=["SETTLED", "CLOSED", "REJECTED"]).count(),
        "settled_this_month": Claim.objects.filter(status="SETTLED").count(),
        "by_status": dict(
            Claim.objects.values_list("status").annotate(
                c=__import__("django.db.models", fromlist=["Count"]).Count("id")
            ).values_list("status", "c"),
        ),
    })
