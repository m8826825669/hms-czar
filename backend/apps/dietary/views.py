from datetime import date
from django.utils import timezone
from rest_framework import viewsets, status
from rest_framework.decorators import action, api_view
from rest_framework.response import Response

from .models import DietType, MealItem, DietPlan, PatientMeal, KitchenOrder
from .serializers import (
    DietTypeSerializer, MealItemSerializer, DietPlanSerializer,
    PatientMealSerializer, KitchenOrderSerializer,
)
from .services import diet_service


class DietTypeViewSet(viewsets.ModelViewSet):
    queryset = DietType.objects.all()
    serializer_class = DietTypeSerializer
    filterset_fields = ["is_active", "is_diabetic_safe", "is_renal_safe"]
    search_fields = ["code", "name"]


class MealItemViewSet(viewsets.ModelViewSet):
    queryset = MealItem.objects.all()
    serializer_class = MealItemSerializer
    filterset_fields = ["meal_type", "is_active", "is_vegetarian", "is_jain"]
    search_fields = ["code", "name"]


class DietPlanViewSet(viewsets.ModelViewSet):
    queryset = (DietPlan.objects
                .select_related("patient", "admission", "diet_type", "prescribed_by__user")
                .prefetch_related("meals__item")
                .all())
    serializer_class = DietPlanSerializer
    filterset_fields = ["status", "admission", "diet_type"]
    search_fields = ["patient__mrn"]

    def create(self, request, *args, **kwargs):
        from apps.ipd.models import Admission
        from apps.specialist.models import Doctor
        try:
            admission = Admission.objects.get(id=request.data["admission"])
            diet_type = DietType.objects.get(id=request.data["diet_type"])
            prescribed_by = (Doctor.objects.get(id=request.data["prescribed_by"])
                             if request.data.get("prescribed_by") else None)
            plan = diet_service.create_diet_plan(
                admission=admission,
                diet_type=diet_type,
                prescribed_by=prescribed_by,
                is_vegetarian=request.data.get("is_vegetarian", True),
                is_jain=request.data.get("is_jain", False),
                is_diabetic=request.data.get("is_diabetic", False),
                allergies=request.data.get("allergies", ""),
                food_preferences=request.data.get("food_preferences", ""),
                fluid_restriction_ml=request.data.get("fluid_restriction_ml"),
                notes=request.data.get("notes", ""),
            )
        except KeyError as e:
            return Response({"detail": f"Missing field: {e}"},
                             status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(self.get_serializer(plan).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"], url_path="generate-meals")
    def generate_meals(self, request, pk=None):
        plan = self.get_object()
        target = request.data.get("date")
        target_date = date.fromisoformat(target) if target else timezone.localdate()
        n = diet_service.generate_daily_meals(plan, target_date)
        return Response({"created": n, "date": target_date.isoformat()})

    @action(detail=True, methods=["post"], url_path="set-npo")
    def set_npo(self, request, pk=None):
        plan = self.get_object()
        plan.npo_until = request.data.get("npo_until")
        plan.npo_reason = request.data.get("npo_reason", "")
        plan.save(update_fields=["npo_until", "npo_reason", "updated_at"])
        return Response(self.get_serializer(plan).data)


class PatientMealViewSet(viewsets.ModelViewSet):
    queryset = (PatientMeal.objects
                .select_related("diet_plan__patient", "diet_plan__admission__bed", "item")
                .all())
    serializer_class = PatientMealSerializer
    filterset_fields = ["status", "meal_type", "meal_date", "diet_plan"]

    @action(detail=True, methods=["post"], url_path="update-status")
    def update_status_action(self, request, pk=None):
        meal = self.get_object()
        try:
            diet_service.update_meal_status(
                meal,
                new_status=request.data["new_status"],
                consumed_percentage=int(request.data.get("consumed_percentage", 0)),
                delivered_by=request.data.get("delivered_by", ""),
                refusal_reason=request.data.get("refusal_reason", ""),
                notes=request.data.get("notes", ""),
            )
        except KeyError as e:
            return Response({"detail": f"Missing field: {e}"},
                             status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(self.get_serializer(meal).data)


class KitchenOrderViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = KitchenOrder.objects.select_related("item").all()
    serializer_class = KitchenOrderSerializer
    filterset_fields = ["order_date", "meal_type", "is_finalized"]


@api_view(["GET"])
def kitchen_today(request):
    from apps.core.models import Hospital
    hospital = Hospital.objects.first()
    if not hospital:
        return Response({"detail": "No hospital."},
                         status=status.HTTP_400_BAD_REQUEST)
    target = request.query_params.get("date")
    target_date = date.fromisoformat(target) if target else timezone.localdate()
    return Response(diet_service.kitchen_today_summary(hospital, target_date))


@api_view(["POST"])
def generate_all_meals_today(request):
    """Bulk-generate meals for all active diet plans for today."""
    from apps.core.models import Hospital
    target = request.data.get("date")
    target_date = date.fromisoformat(target) if target else timezone.localdate()

    total = 0
    for plan in DietPlan.objects.filter(status="ACTIVE"):
        total += diet_service.generate_daily_meals(plan, target_date)
    return Response({"created": total, "date": target_date.isoformat()})
