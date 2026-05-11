from datetime import date
from decimal import Decimal
from django.utils import timezone
from rest_framework import viewsets, status
from rest_framework.decorators import action, api_view
from rest_framework.response import Response

from .models import (
    BloodDonor, BloodDonation, BloodBag,
    BloodRequisition, CrossMatch, BloodIssue,
)
from .serializers import (
    BloodDonorSerializer, BloodDonationSerializer, BloodBagSerializer,
    BloodRequisitionSerializer, CrossMatchSerializer, BloodIssueSerializer,
)
from .services import bank_service


# ─────────────────────────────────────────────────────────────────────────────
# Donor
# ─────────────────────────────────────────────────────────────────────────────

class BloodDonorViewSet(viewsets.ModelViewSet):
    queryset = BloodDonor.objects.all()
    serializer_class = BloodDonorSerializer
    filterset_fields = ["blood_group", "is_eligible", "donor_type"]
    search_fields = ["donor_id", "first_name", "last_name", "phone"]

    def create(self, request, *args, **kwargs):
        from apps.core.models import Hospital
        try:
            hospital = (Hospital.objects.first()
                        if "hospital" not in request.data
                        else Hospital.objects.get(id=request.data["hospital"]))
            donor = bank_service.register_donor(
                hospital=hospital,
                first_name=request.data["first_name"],
                last_name=request.data.get("last_name", ""),
                gender=request.data["gender"],
                dob=date.fromisoformat(request.data["dob"]),
                blood_group=request.data["blood_group"],
                phone=request.data["phone"],
                email=request.data.get("email", ""),
                address=request.data.get("address", ""),
                aadhaar_last4=request.data.get("aadhaar_last4", ""),
                weight_kg=request.data.get("weight_kg", "0"),
                donor_type=request.data.get("donor_type", "VOLUNTARY"),
                notes=request.data.get("notes", ""),
            )
        except (KeyError, ValueError) as e:
            return Response({"detail": f"Invalid request: {e}"},
                             status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(self.get_serializer(donor).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["get"], url_path="eligibility")
    def eligibility(self, request, pk=None):
        donor = self.get_object()
        ok, reason = donor.can_donate_today()
        return Response({"can_donate": ok, "reason": reason})


# ─────────────────────────────────────────────────────────────────────────────
# Donation
# ─────────────────────────────────────────────────────────────────────────────

class BloodDonationViewSet(viewsets.ModelViewSet):
    queryset = BloodDonation.objects.select_related("donor").all()
    serializer_class = BloodDonationSerializer
    filterset_fields = ["status", "blood_group", "donor"]
    search_fields = ["donation_id", "donor__donor_id"]

    def create(self, request, *args, **kwargs):
        try:
            donor = BloodDonor.objects.get(id=request.data["donor"])
            donation = bank_service.record_donation(
                donor=donor,
                volume_collected_ml=int(request.data.get("volume_collected_ml", 350)),
                pre_hb_g_dl=Decimal(str(request.data.get("pre_hb_g_dl", "0"))),
                pre_bp_systolic=int(request.data.get("pre_bp_systolic", 0)),
                pre_bp_diastolic=int(request.data.get("pre_bp_diastolic", 0)),
                pre_pulse=int(request.data.get("pre_pulse", 0)),
                pre_temperature_c=Decimal(str(request.data.get("pre_temperature_c", "0"))),
                collected_by=request.user if request.user.is_authenticated else None,
                notes=request.data.get("notes", ""),
            )
        except KeyError as e:
            return Response({"detail": f"Missing field: {e}"},
                             status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(self.get_serializer(donation).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"])
    def screen(self, request, pk=None):
        """Submit screening test results. Body: {test_hiv, test_hbsag, test_hcv,
        test_syphilis, test_malaria, components: ["WHOLE", ...], storage_location?}"""
        donation = self.get_object()
        try:
            bank_service.complete_screening(
                donation,
                test_hiv=request.data["test_hiv"],
                test_hbsag=request.data["test_hbsag"],
                test_hcv=request.data["test_hcv"],
                test_syphilis=request.data["test_syphilis"],
                test_malaria=request.data["test_malaria"],
                components=request.data.get("components", ["WHOLE"]),
                storage_location=request.data.get("storage_location", ""),
                screened_by=request.user if request.user.is_authenticated else None,
                discard_reason=request.data.get("discard_reason", ""),
            )
        except Exception as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(self.get_serializer(donation).data)


# ─────────────────────────────────────────────────────────────────────────────
# Blood bag
# ─────────────────────────────────────────────────────────────────────────────

class BloodBagViewSet(viewsets.ModelViewSet):
    queryset = BloodBag.objects.select_related("donation__donor").all()
    serializer_class = BloodBagSerializer
    filterset_fields = ["status", "component", "blood_group"]
    search_fields = ["bag_id"]

    @action(detail=True, methods=["post"])
    def discard(self, request, pk=None):
        bag = self.get_object()
        reason = request.data.get("reason", "").strip()
        if not reason:
            return Response({"detail": "reason is required."},
                             status=status.HTTP_400_BAD_REQUEST)
        try:
            bank_service.discard_bag(
                bag, reason=reason,
                user=request.user if request.user.is_authenticated else None,
            )
        except Exception as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(self.get_serializer(bag).data)


# ─────────────────────────────────────────────────────────────────────────────
# Requisition + cross-match + issue
# ─────────────────────────────────────────────────────────────────────────────

class BloodRequisitionViewSet(viewsets.ModelViewSet):
    queryset = (BloodRequisition.objects
                .select_related("patient", "requested_by__user", "department",
                                "admission")
                .prefetch_related("crossmatches__bag", "issues__bag")
                .all())
    serializer_class = BloodRequisitionSerializer
    filterset_fields = ["status", "urgency", "blood_group", "component"]
    search_fields = ["code", "patient__mrn"]

    def create(self, request, *args, **kwargs):
        from apps.core.models import Hospital, Patient
        from apps.specialist.models import Doctor
        try:
            hospital = (Hospital.objects.first()
                        if "hospital" not in request.data
                        else Hospital.objects.get(id=request.data["hospital"]))
            patient = Patient.objects.get(id=request.data["patient"])
            doctor = Doctor.objects.get(id=request.data["requested_by"])

            department = None
            if request.data.get("department"):
                from apps.department.models import Department
                department = Department.objects.get(id=request.data["department"])

            admission = None
            if request.data.get("admission"):
                from apps.ipd.models import Admission
                admission = Admission.objects.get(id=request.data["admission"])

            req = bank_service.create_requisition(
                hospital=hospital,
                patient=patient,
                requested_by=doctor,
                blood_group=request.data["blood_group"],
                component=request.data.get("component", "PRBC"),
                units_required=int(request.data.get("units_required", 1)),
                urgency=request.data.get("urgency", "ROUTINE"),
                purpose=request.data.get("purpose", ""),
                department=department,
                admission=admission,
                notes=request.data.get("notes", ""),
            )
        except KeyError as e:
            return Response({"detail": f"Missing field: {e}"},
                             status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(self.get_serializer(req).data, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=["get"])
    def pending(self, request):
        qs = self.get_queryset().filter(
            status__in=["PENDING", "CROSSMATCH", "RESERVED"],
        ).order_by("urgency", "-requested_at")
        return Response(self.get_serializer(qs, many=True).data)

    @action(detail=True, methods=["get"], url_path="compatible-bags")
    def compatible_bags(self, request, pk=None):
        req = self.get_object()
        bags = bank_service.find_compatible_bags(req)
        return Response(BloodBagSerializer(bags, many=True).data)

    @action(detail=True, methods=["post"])
    def crossmatch(self, request, pk=None):
        req = self.get_object()
        try:
            bag = BloodBag.objects.get(id=request.data["bag_id"])
            cm = bank_service.crossmatch_bag(
                req, bag,
                result=request.data["result"],
                notes=request.data.get("notes", ""),
                performed_by=request.user if request.user.is_authenticated else None,
            )
        except KeyError as e:
            return Response({"detail": f"Missing field: {e}"},
                             status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(CrossMatchSerializer(cm).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"])
    def reserve(self, request, pk=None):
        """Reserve a bag for this requisition (after compatible cross-match)."""
        req = self.get_object()
        try:
            bag = BloodBag.objects.get(id=request.data["bag_id"])
            bank_service.reserve_bag_for_requisition(req, bag)
        except KeyError as e:
            return Response({"detail": f"Missing field: {e}"},
                             status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(self.get_serializer(req).data)

    @action(detail=True, methods=["post"], url_path="issue-bag")
    def issue_bag(self, request, pk=None):
        req = self.get_object()
        try:
            bag = BloodBag.objects.get(id=request.data["bag_id"])
            issue = bank_service.issue_bag(
                bag,
                issued_to_dept=request.data.get("issued_to_dept", ""),
                received_by_name=request.data.get("received_by_name", ""),
                issued_by=request.user if request.user.is_authenticated else None,
                create_invoice=bool(request.data.get("create_invoice", True)),
                unit_price=Decimal(str(request.data.get("unit_price", "1500"))),
                gst_rate=Decimal(str(request.data.get("gst_rate", "0"))),
            )
        except KeyError as e:
            return Response({"detail": f"Missing field: {e}"},
                             status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(BloodIssueSerializer(issue).data, status=status.HTTP_201_CREATED)


class BloodIssueViewSet(viewsets.ModelViewSet):
    queryset = BloodIssue.objects.select_related("requisition", "bag", "invoice").all()
    serializer_class = BloodIssueSerializer
    filterset_fields = ["requisition", "bag_returned"]

    @action(detail=True, methods=["post"], url_path="complete-transfusion")
    def complete_transfusion(self, request, pk=None):
        issue = self.get_object()
        from datetime import datetime as dt
        started = request.data.get("started_at")
        completed = request.data.get("completed_at")

        def _parse(v):
            if not v:
                return None
            s = str(v).replace("Z", "+00:00")
            x = dt.fromisoformat(s)
            return timezone.make_aware(x) if timezone.is_naive(x) else x

        bank_service.complete_transfusion(
            issue,
            started_at=_parse(started),
            completed_at=_parse(completed),
            reactions=request.data.get("reactions", ""),
            bag_returned=bool(request.data.get("bag_returned", False)),
        )
        return Response(self.get_serializer(issue).data)


# ─────────────────────────────────────────────────────────────────────────────
# Inventory dashboard
# ─────────────────────────────────────────────────────────────────────────────

@api_view(["GET"])
def inventory_view(request):
    from apps.core.models import Hospital
    hospital = Hospital.objects.first()
    if not hospital:
        return Response({"detail": "No hospital configured."},
                         status=status.HTTP_400_BAD_REQUEST)
    return Response(bank_service.inventory_summary(hospital))


@api_view(["POST"])
def expire_old_bags_view(request):
    """Manually trigger bag expiration sweep."""
    count = bank_service.expire_old_bags()
    return Response({"expired_count": count})
