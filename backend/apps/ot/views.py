from datetime import datetime, timedelta, date
from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response

from .models import (
    OperationTheatre, SurgicalProcedure, SurgeryBooking,
    SurgeryTeam, OTRegister, OTConsumable,
)
from .serializers import (
    OperationTheatreSerializer, SurgicalProcedureSerializer,
    SurgeryBookingSerializer, SurgeryTeamSerializer,
    OTRegisterSerializer, OTConsumableSerializer,
)
from .services import booking_service
from .services.register_pdf import generate_ot_register_pdf


# ─────────────────────────────────────────────────────────────────────────────
# Theatre + procedure CRUD
# ─────────────────────────────────────────────────────────────────────────────

class OperationTheatreViewSet(viewsets.ModelViewSet):
    queryset = OperationTheatre.objects.all()
    serializer_class = OperationTheatreSerializer
    filterset_fields = ["theatre_type", "status", "is_active"]
    search_fields = ["code", "name"]


class SurgicalProcedureViewSet(viewsets.ModelViewSet):
    queryset = SurgicalProcedure.objects.all()
    serializer_class = SurgicalProcedureSerializer
    filterset_fields = ["category", "is_active"]
    search_fields = ["code", "name"]


# ─────────────────────────────────────────────────────────────────────────────
# Surgery booking ViewSet
# ─────────────────────────────────────────────────────────────────────────────

class SurgeryBookingViewSet(viewsets.ModelViewSet):
    queryset = (SurgeryBooking.objects
                .select_related("patient", "theatre", "procedure",
                                "primary_surgeon__user", "anaesthetist__user",
                                "admission", "invoice")
                .prefetch_related("team__doctor__user", "consumables", "ot_register")
                .all())
    serializer_class = SurgeryBookingSerializer
    filterset_fields = ["status", "urgency", "theatre", "primary_surgeon", "admission"]
    search_fields = ["code", "patient__mrn", "patient__first_name", "patient__last_name"]

    def create(self, request, *args, **kwargs):
        """Use service to ensure conflict check + locked pricing + auto-team."""
        from apps.core.models import Hospital, Patient
        from apps.specialist.models import Doctor

        data = request.data
        try:
            hospital = (Hospital.objects.first()
                        if "hospital" not in data
                        else Hospital.objects.get(id=data["hospital"]))
            patient = Patient.objects.get(id=data["patient"])
            theatre = OperationTheatre.objects.get(id=data["theatre"])
            procedure = SurgicalProcedure.objects.get(id=data["procedure"])
            primary_surgeon = Doctor.objects.get(id=data["primary_surgeon"])
            anaesthetist = (Doctor.objects.get(id=data["anaesthetist"])
                            if data.get("anaesthetist") else None)

            admission = None
            if data.get("admission"):
                from apps.ipd.models import Admission
                admission = Admission.objects.get(id=data["admission"])

            scheduled_start = _parse_datetime(data["scheduled_start"])
            scheduled_end = _parse_datetime(data["scheduled_end"])

            booking = booking_service.book_surgery(
                hospital=hospital,
                patient=patient,
                theatre=theatre,
                procedure=procedure,
                primary_surgeon=primary_surgeon,
                anaesthetist=anaesthetist,
                admission=admission,
                scheduled_start=scheduled_start,
                scheduled_end=scheduled_end,
                urgency=data.get("urgency", "ELECTIVE"),
                pre_op_diagnosis=data.get("pre_op_diagnosis", ""),
                pre_op_assessment=data.get("pre_op_assessment", ""),
                consent_obtained=data.get("consent_obtained", False),
                notes=data.get("notes", ""),
                booked_by=request.user if request.user.is_authenticated else None,
            )
        except (KeyError, ValueError) as e:
            return Response(
                {"detail": f"Invalid request: {e}"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        except Exception as e:
            return Response(
                {"detail": str(e)},
                status=status.HTTP_400_BAD_REQUEST,
            )

        ser = self.get_serializer(booking)
        return Response(ser.data, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=["get"])
    def today(self, request):
        """Today's surgeries grouped by status."""
        today = timezone.localdate()
        start = timezone.make_aware(datetime.combine(today, datetime.min.time()))
        end = start + timedelta(days=1)
        qs = self.get_queryset().filter(
            scheduled_start__gte=start, scheduled_start__lt=end,
        ).order_by("scheduled_start")

        bookings = self.get_serializer(qs, many=True).data
        theatres = OperationTheatreSerializer(
            OperationTheatre.objects.filter(is_active=True).order_by("code"),
            many=True,
        ).data

        return Response({
            "date": today.isoformat(),
            "theatres": theatres,
            "bookings": bookings,
            "counts": {
                "scheduled": qs.filter(status__in=["SCHEDULED", "CHECKED_IN"]).count(),
                "in_progress": qs.filter(status="IN_PROGRESS").count(),
                "completed": qs.filter(status="COMPLETED").count(),
                "cancelled": qs.filter(status="CANCELLED").count(),
            },
        })

    @action(detail=False, methods=["get"], url_path="calendar")
    def calendar(self, request):
        """Booking list for a date range. Query params: start, end (YYYY-MM-DD)."""
        try:
            start_date = date.fromisoformat(request.query_params.get("start", ""))
            end_date = date.fromisoformat(request.query_params.get("end", ""))
        except ValueError:
            return Response(
                {"detail": "start and end are required (YYYY-MM-DD)."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        start_dt = timezone.make_aware(datetime.combine(start_date, datetime.min.time()))
        end_dt = timezone.make_aware(datetime.combine(end_date, datetime.max.time()))

        qs = self.get_queryset().filter(
            scheduled_start__gte=start_dt, scheduled_start__lte=end_dt,
        ).order_by("scheduled_start")

        return Response(self.get_serializer(qs, many=True).data)

    @action(detail=True, methods=["post"], url_path="check-in")
    def check_in(self, request, pk=None):
        booking = self.get_object()
        try:
            booking_service.check_in_patient(booking)
        except Exception as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(self.get_serializer(booking).data)

    @action(detail=True, methods=["post"])
    def start(self, request, pk=None):
        booking = self.get_object()
        try:
            booking_service.start_surgery(booking)
        except Exception as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(self.get_serializer(booking).data)

    @action(detail=True, methods=["post"])
    def complete(self, request, pk=None):
        booking = self.get_object()
        try:
            generate_invoice = bool(request.data.get("generate_invoice", True))
            booking_service.complete_surgery(booking, generate_invoice=generate_invoice)
        except Exception as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(self.get_serializer(booking).data)

    @action(detail=True, methods=["post"])
    def cancel(self, request, pk=None):
        booking = self.get_object()
        reason = request.data.get("reason", "").strip()
        if not reason:
            return Response(
                {"detail": "Cancellation reason is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            booking_service.cancel_surgery(
                booking, reason=reason,
                user=request.user if request.user.is_authenticated else None,
            )
        except Exception as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(self.get_serializer(booking).data)

    @action(detail=True, methods=["post"])
    def postpone(self, request, pk=None):
        booking = self.get_object()
        try:
            new_start = _parse_datetime(request.data["new_start"])
            new_end = _parse_datetime(request.data["new_end"])
            reason = request.data.get("reason", "")
            booking_service.postpone_surgery(
                booking, new_start, new_end, reason=reason,
            )
        except Exception as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(self.get_serializer(booking).data)

    @action(detail=True, methods=["post"], url_path="add-team-member")
    def add_team_member(self, request, pk=None):
        booking = self.get_object()
        from apps.specialist.models import Doctor
        doctor = (Doctor.objects.get(id=request.data["doctor_id"])
                  if request.data.get("doctor_id") else None)
        member = booking_service.add_team_member(
            booking,
            role=request.data["role"],
            doctor=doctor,
            member_name=request.data.get("member_name", ""),
            notes=request.data.get("notes", ""),
        )
        return Response(SurgeryTeamSerializer(member).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"], url_path="add-consumable")
    def add_consumable(self, request, pk=None):
        booking = self.get_object()
        try:
            cons = booking_service.add_consumable(
                booking,
                item_name=request.data["item_name"],
                quantity=request.data["quantity"],
                unit_price=request.data["unit_price"],
                unit=request.data.get("unit", "pcs"),
                gst_rate=request.data.get("gst_rate", 0),
                notes=request.data.get("notes", ""),
                added_by=request.user if request.user.is_authenticated else None,
            )
        except Exception as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(OTConsumableSerializer(cons).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["get", "post"], url_path="register")
    def register(self, request, pk=None):
        booking = self.get_object()
        if request.method == "GET":
            register, _ = OTRegister.objects.get_or_create(booking=booking)
            return Response(OTRegisterSerializer(register).data)

        # POST = upsert
        from apps.specialist.models import Doctor
        prepared_by = None
        if request.data.get("prepared_by_id"):
            prepared_by = Doctor.objects.get(id=request.data["prepared_by_id"])

        finalize = bool(request.data.get("finalize", False))

        try:
            register = booking_service.upsert_register(
                booking,
                prepared_by=prepared_by,
                finalize=finalize,
                pre_op_findings=request.data.get("pre_op_findings"),
                surgical_steps=request.data.get("surgical_steps"),
                intra_op_findings=request.data.get("intra_op_findings"),
                complications=request.data.get("complications"),
                blood_loss_ml=request.data.get("blood_loss_ml"),
                blood_transfused_units=request.data.get("blood_transfused_units"),
                instruments_used=request.data.get("instruments_used"),
                implants_used=request.data.get("implants_used"),
                specimens_sent=request.data.get("specimens_sent"),
                anaesthesia_type=request.data.get("anaesthesia_type"),
                anaesthesia_notes=request.data.get("anaesthesia_notes"),
                post_op_orders=request.data.get("post_op_orders"),
                condition_on_shifting=request.data.get("condition_on_shifting"),
            )
        except Exception as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(OTRegisterSerializer(register).data)

    @action(detail=True, methods=["get"], url_path="register-pdf")
    def register_pdf(self, request, pk=None):
        booking = self.get_object()
        pdf = generate_ot_register_pdf(booking)
        resp = HttpResponse(pdf, content_type="application/pdf")
        resp["Content-Disposition"] = (
            f'inline; filename="OT-register-{booking.code}.pdf"'
        )
        return resp


class SurgeryTeamViewSet(viewsets.ModelViewSet):
    queryset = SurgeryTeam.objects.all()
    serializer_class = SurgeryTeamSerializer
    filterset_fields = ["booking", "role"]


class OTConsumableViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = OTConsumable.objects.all()
    serializer_class = OTConsumableSerializer
    filterset_fields = ["booking"]


# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────

def _parse_datetime(value):
    """Parse ISO-8601 with optional Z. Return aware datetime."""
    if isinstance(value, datetime):
        return value
    s = str(value).replace("Z", "+00:00")
    dt = datetime.fromisoformat(s)
    if timezone.is_naive(dt):
        dt = timezone.make_aware(dt)
    return dt
