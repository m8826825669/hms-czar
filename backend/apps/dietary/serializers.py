from rest_framework import serializers
from .models import DietType, MealItem, DietPlan, PatientMeal, KitchenOrder


class DietTypeSerializer(serializers.ModelSerializer):
    class Meta:
        model = DietType
        fields = "__all__"
        read_only_fields = ["id", "created_at", "updated_at"]


class MealItemSerializer(serializers.ModelSerializer):
    meal_type_label = serializers.CharField(source="get_meal_type_display", read_only=True)
    class Meta:
        model = MealItem
        fields = "__all__"


class PatientMealSerializer(serializers.ModelSerializer):
    item_name = serializers.CharField(source="item.name", read_only=True)
    item_code = serializers.CharField(source="item.code", read_only=True)
    meal_type_label = serializers.CharField(source="get_meal_type_display", read_only=True)
    status_label = serializers.CharField(source="get_status_display", read_only=True)
    patient_name = serializers.SerializerMethodField()
    bed_label = serializers.SerializerMethodField()

    class Meta:
        model = PatientMeal
        fields = [
            "id", "diet_plan", "meal_date", "meal_type", "meal_type_label",
            "item", "item_name", "item_code",
            "status", "status_label",
            "delivered_at", "delivered_by",
            "consumed_percentage", "refusal_reason",
            "patient_name", "bed_label",
            "notes", "created_at", "updated_at",
        ]
        read_only_fields = ["id", "delivered_at", "created_at", "updated_at"]

    def get_patient_name(self, obj):
        p = obj.diet_plan.patient
        if hasattr(p, "full_name"):
            return p.full_name
        return f"{getattr(p, 'first_name', '')} {getattr(p, 'last_name', '')}".strip()

    def get_bed_label(self, obj):
        bed = getattr(obj.diet_plan.admission, "bed", None)
        return getattr(bed, "code", None) if bed else None


class DietPlanSerializer(serializers.ModelSerializer):
    diet_type_name = serializers.CharField(source="diet_type.name", read_only=True)
    patient_name = serializers.SerializerMethodField()
    admission_code = serializers.CharField(source="admission.code", read_only=True)
    status_label = serializers.CharField(source="get_status_display", read_only=True)
    meals = PatientMealSerializer(many=True, read_only=True)

    class Meta:
        model = DietPlan
        fields = [
            "id", "hospital", "admission", "admission_code",
            "patient", "patient_name",
            "diet_type", "diet_type_name",
            "prescribed_by",
            "is_vegetarian", "is_jain", "is_diabetic",
            "allergies", "food_preferences", "fluid_restriction_ml",
            "npo_until", "npo_reason",
            "started_at", "ended_at",
            "status", "status_label",
            "notes", "meals",
            "created_at", "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]

    def get_patient_name(self, obj):
        p = obj.patient
        if hasattr(p, "full_name"):
            return p.full_name
        return f"{getattr(p, 'first_name', '')} {getattr(p, 'last_name', '')}".strip()


class KitchenOrderSerializer(serializers.ModelSerializer):
    item_name = serializers.CharField(source="item.name", read_only=True)
    item_code = serializers.CharField(source="item.code", read_only=True)
    meal_type_label = serializers.CharField(source="get_meal_type_display", read_only=True)

    class Meta:
        model = KitchenOrder
        fields = [
            "id", "hospital", "order_date",
            "meal_type", "meal_type_label",
            "item", "item_code", "item_name", "quantity",
            "is_finalized", "notes",
            "created_at", "updated_at",
        ]
