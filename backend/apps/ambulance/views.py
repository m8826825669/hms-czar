from decimal import Decimal
from datetime import datetime, timedelta
from django.utils import timezone
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response

from .models import Ambulance, AmbulanceDriver, Dispatch, DispatchLog
from .serializers import (
    AmbulanceSerializer, AmbulanceDriverSerializer,
    DispatchSerializer, DispatchLogSerializer,
)
from .services import dispatch_service


class AmbulanceViewSet(viewsets.ModelViewSet):
    queryset = Ambulance.objects.all()
    serializer_class = AmbulanceSerializer
    filterset_fields = ["status", "ambulance_type", "is_active"]
    search_fields = ["code", "registration_number"]

    @action(detail=False, methods=["get"])
    def available(self, request):
        qs = self.get_queryset().filter(status="AVAILABLE", is_active=True)
        return Response(self.get_serializer(qs, many=True).data)

    @action(detail=True, methods=["post"], url_path="update-gps")
    def update_gps(self, request, pk=None):
        amb = self.get_object()
        amb.last_lat = request.data.get("lat")
        amb.last_lng = request.data.get("lng")
        amb.last_location_update = timezone.now()
        amb.save(update_fields=["last_lat", "last_lng",
                                  "last_location_update", "updated_at"])
        return Response(self.get_serializer(amb).data)


class AmbulanceDriverViewSet(viewsets.ModelViewSet):
    queryset = AmbulanceDriver.objects.all()
    serializer_class = AmbulanceDriverSerializer
    filterset_fields = ["role", "is_on_duty", "shift", "is_active"]
    search_fields = ["employee_code", "full_name", "phone"]

    @action(detail=False, methods=["get"])
    def on_duty(self, request):
        qs = self.get_queryset().filter(is_on_duty=True, is_active=True)
        return Response(self.get_serializer(qs, many=True).data)


class DispatchViewSet(viewsets.ModelViewSet):
    queryset = (Dispatch.objects
                .select_related("patient", "ambulance", "driver", "paramedic", "invoice")
                .prefetch_related("logs")
                .all())
    serializer_class = DispatchSerializer
    filterset_fields = ["status", "priority", "ambulance"]
    search_fields = ["code", "patient__mrn", "caller_name", "caller_phone"]

    def create(self, request, *args, **kwargs):
        from apps.core.models import Hospital, Patient
        try:
            hospital = (Hospital.objects.first()
                        if "hospital" not in request.data
                        else Hospital.objects.get(id=request.data["hospital"]))
            patient = None
            if request.data.get("patient"):
                patient = Patient.objects.get(id=request.data["patient"])

            d = dispatch_service.request_dispatch(
                hospital=hospital,
                call_type=request.data.get("call_type", "EMERGENCY"),
                priority=request.data.get("priority", "URGENT"),
                pickup_address=request.data["pickup_address"],
                pickup_lat=request.data.get("pickup_lat"),
                pickup_lng=request.data.get("pickup_lng"),
                pickup_landmark=request.data.get("pickup_landmark", ""),
                drop_address=request.data.get("drop_address", ""),
                patient=patient,
                patient_name_temp=request.data.get("patient_name_temp", ""),
                patient_phone_temp=request.data.get("patient_phone_temp", ""),
                caller_name=request.data.get("caller_name", ""),
                caller_phone=request.data.get("caller_phone", ""),
                caller_relation=request.data.get("caller_relation", ""),
                chief_complaint=request.data.get("chief_complaint", ""),
                age_estimate=request.data.get("age_estimate"),
                is_conscious=request.data.get("is_conscious"),
                is_breathing=request.data.get("is_breathing"),
                notes=request.data.get("notes", ""),
            )
        except KeyError as e:
            return Response({"detail": f"Missing field: {e}"},
                             status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(self.get_serializer(d).data, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=["get"])
    def active(self, request):
        """Active = anything not COMPLETED/CANCELLED."""
        qs = self.get_queryset().exclude(
            status__in=["COMPLETED", "CANCELLED"]
        ).order_by("-priority", "requested_at")
        return Response(self.get_serializer(qs, many=True).data)

    @action(detail=True, methods=["post"])
    def assign(self, request, pk=None):
        d = self.get_object()
        try:
            ambulance = Ambulance.objects.get(id=request.data["ambulance_id"])
            driver = (AmbulanceDriver.objects.get(id=request.data["driver_id"])
                      if request.data.get("driver_id") else None)
            paramedic = (AmbulanceDriver.objects.get(id=request.data["paramedic_id"])
                          if request.data.get("paramedic_id") else None)
            dispatch_service.assign_ambulance(
                d, ambulance=ambulance, driver=driver, paramedic=paramedic,
                user=request.user if request.user.is_authenticated else None,
            )
        except KeyError as e:
            return Response({"detail": f"Missing field: {e}"},
                             status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(self.get_serializer(d).data)

    @action(detail=True, methods=["post"], url_path="update-status")
    def update_status_action(self, request, pk=None):
        d = self.get_object()
        try:
            dispatch_service.update_status(
                d,
                new_status=request.data["new_status"],
                lat=request.data.get("lat"),
                lng=request.data.get("lng"),
                note=request.data.get("note", ""),
                user=request.user if request.user.is_authenticated else None,
            )
        except KeyError as e:
            return Response({"detail": f"Missing field: {e}"},
                             status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(self.get_serializer(d).data)

    @action(detail=True, methods=["post"])
    def cancel(self, request, pk=None):
        d = self.get_object()
        reason = request.data.get("reason", "").strip()
        if not reason:
            return Response({"detail": "reason is required."},
                             status=status.HTTP_400_BAD_REQUEST)
        try:
            dispatch_service.cancel_dispatch(
                d, reason=reason,
                user=request.user if request.user.is_authenticated else None,
            )
        except Exception as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(self.get_serializer(d).data)

    @action(detail=True, methods=["post"])
    def bill(self, request, pk=None):
        d = self.get_object()
        try:
            dispatch_service.bill_dispatch(
                d,
                distance_km=Decimal(str(request.data.get("distance_km", "0"))),
                gst_rate=Decimal(str(request.data.get("gst_rate", "0"))),
            )
        except Exception as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(self.get_serializer(d).data)
