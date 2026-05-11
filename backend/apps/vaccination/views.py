from rest_framework import serializers, viewsets, status
from rest_framework.decorators import action, api_view
from rest_framework.response import Response

from .models import (
    Vaccine, ImmunizationSchedule, VaccinationRecord, VaccinationCertificate,
)
from .services import vaccination_service


class ImmunizationScheduleSerializer(serializers.ModelSerializer):
    age_unit_label = serializers.CharField(source="get_age_unit_display", read_only=True)
    class Meta:
        model = ImmunizationSchedule
        fields = "__all__"


class VaccineSerializer(serializers.ModelSerializer):
    vaccine_type_label = serializers.CharField(source="get_vaccine_type_display",
                                                  read_only=True)
    schedule = ImmunizationScheduleSerializer(many=True, read_only=True)
    class Meta:
        model = Vaccine
        fields = "__all__"


class VaccinationCertificateSerializer(serializers.ModelSerializer):
    class Meta:
        model = VaccinationCertificate
        fields = "__all__"


class VaccinationRecordSerializer(serializers.ModelSerializer):
    patient_name = serializers.CharField(source="patient.full_name", read_only=True)
    patient_code = serializers.CharField(source="patient.patient_code", read_only=True)
    vaccine_code = serializers.CharField(source="vaccine.code", read_only=True)
    vaccine_name = serializers.CharField(source="vaccine.name", read_only=True)
    status_label = serializers.CharField(source="get_status_display", read_only=True)
    certificate = VaccinationCertificateSerializer(read_only=True)
    class Meta:
        model = VaccinationRecord
        fields = "__all__"


class VaccineViewSet(viewsets.ModelViewSet):
    queryset = Vaccine.objects.prefetch_related("schedule").all()
    serializer_class = VaccineSerializer
    filterset_fields = ["vaccine_type", "is_active", "is_under_uip"]
    search_fields = ["code", "name"]


class ImmunizationScheduleViewSet(viewsets.ModelViewSet):
    queryset = ImmunizationSchedule.objects.select_related("vaccine").all()
    serializer_class = ImmunizationScheduleSerializer
    filterset_fields = ["vaccine"]


class VaccinationRecordViewSet(viewsets.ModelViewSet):
    queryset = (VaccinationRecord.objects
                .select_related("patient", "vaccine").all())
    serializer_class = VaccinationRecordSerializer
    filterset_fields = ["patient", "vaccine", "status"]

    def create(self, request, *args, **kwargs):
        from apps.core.models import Hospital
        from apps.reception.models import Patient
        try:
            hospital = Hospital.objects.first()
            patient = Patient.objects.get(id=request.data["patient"])
            vaccine = Vaccine.objects.get(id=request.data["vaccine"])
            record = vaccination_service.administer_vaccine(
                hospital=hospital, patient=patient, vaccine=vaccine,
                dose_number=int(request.data.get("dose_number", 1)),
                administered_date=request.data.get("administered_date"),
                batch_number=request.data.get("batch_number", ""),
                expiry_date=request.data.get("expiry_date"),
                administered_by=request.user if request.user.is_authenticated else None,
                administrator_name=request.data.get("administrator_name", ""),
                site_of_injection=request.data.get("site_of_injection", ""),
                adverse_reactions=request.data.get("adverse_reactions", ""),
                notes=request.data.get("notes", ""),
            )
        except KeyError as e:
            return Response({"detail": f"Missing field: {e}"}, status=400)
        except Exception as e:
            return Response({"detail": str(e)}, status=400)
        return Response(self.get_serializer(record).data, status=201)


@api_view(["GET"])
def patient_history(request, patient_id):
    from apps.reception.models import Patient
    try:
        patient = Patient.objects.get(id=patient_id)
    except Patient.DoesNotExist:
        return Response({"detail": "Patient not found"}, status=404)

    history = vaccination_service.get_patient_history(patient)
    due = vaccination_service.get_due_vaccinations(patient)
    return Response({
        "patient_id": patient.id,
        "patient_name": patient.full_name,
        "history": VaccinationRecordSerializer(history, many=True).data,
        "due_vaccinations": due,
    })
