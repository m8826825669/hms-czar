"""
Dietary service — diet plan creation, daily meal generation, kitchen order rollup.
"""
from datetime import timedelta, date
from django.core.exceptions import ValidationError
from django.db import transaction
from django.db.models import Count
from django.utils import timezone

from ..models import DietType, MealItem, DietPlan, PatientMeal, KitchenOrder


@transaction.atomic
def create_diet_plan(*, admission, diet_type, prescribed_by=None, **extra) -> DietPlan:
    if admission.status != "ADMITTED":
        raise ValidationError("Diet plan can only be created for active admissions.")

    plan = DietPlan.objects.create(
        hospital=admission.hospital,
        admission=admission,
        patient=admission.patient,
        diet_type=diet_type,
        prescribed_by=prescribed_by,
        is_vegetarian=extra.get("is_vegetarian", True),
        is_jain=extra.get("is_jain", False),
        is_diabetic=extra.get("is_diabetic", False),
        allergies=extra.get("allergies", ""),
        food_preferences=extra.get("food_preferences", ""),
        fluid_restriction_ml=extra.get("fluid_restriction_ml"),
        notes=extra.get("notes", ""),
    )
    return plan


@transaction.atomic
def generate_daily_meals(diet_plan: DietPlan, target_date: date,
                          *, default_items_by_meal: dict = None) -> int:
    """
    Generate PatientMeal rows for a given date, picking default_items_by_meal
    or the first compatible MealItem per meal_type.
    Returns count of meals created.
    """
    if diet_plan.status != "ACTIVE":
        return 0

    if diet_plan.npo_until and timezone.now() < diet_plan.npo_until:
        # Patient is NPO — skip
        return 0

    meal_types = ["BREAKFAST", "MORNING_SNACK", "LUNCH",
                  "EVENING_SNACK", "DINNER", "BEDTIME"]
    created = 0
    default_items_by_meal = default_items_by_meal or {}

    for mt in meal_types:
        # Skip if already exists
        if PatientMeal.objects.filter(
            diet_plan=diet_plan, meal_date=target_date, meal_type=mt,
        ).exists():
            continue

        item = default_items_by_meal.get(mt)
        if not item:
            # Pick first active item matching diet preferences
            qs = MealItem.objects.filter(
                hospital=diet_plan.hospital,
                meal_type=mt,
                is_active=True,
            )
            if diet_plan.is_vegetarian:
                qs = qs.filter(is_vegetarian=True)
            if diet_plan.is_jain:
                qs = qs.filter(is_jain=True)
            item = qs.first()

        if not item:
            continue

        PatientMeal.objects.create(
            diet_plan=diet_plan,
            meal_date=target_date,
            meal_type=mt,
            item=item,
            status="PLANNED",
        )
        created += 1

    return created


@transaction.atomic
def update_meal_status(meal: PatientMeal, *, new_status: str,
                       consumed_percentage: int = 0,
                       delivered_by: str = "",
                       refusal_reason: str = "",
                       notes: str = "") -> PatientMeal:
    valid_transitions = {
        "PLANNED":   ["IN_KITCHEN", "CANCELLED"],
        "IN_KITCHEN":["READY", "CANCELLED"],
        "READY":     ["DELIVERED", "CANCELLED"],
        "DELIVERED": ["CONSUMED", "REFUSED"],
    }
    if new_status not in valid_transitions.get(meal.status, []):
        raise ValidationError(
            f"Invalid transition {meal.status} → {new_status}",
        )

    meal.status = new_status
    if new_status == "DELIVERED":
        meal.delivered_at = timezone.now()
        meal.delivered_by = delivered_by
    if new_status == "CONSUMED":
        meal.consumed_percentage = consumed_percentage
    if new_status == "REFUSED":
        meal.refusal_reason = refusal_reason
    if notes:
        meal.notes = notes
    meal.save()
    return meal


@transaction.atomic
def rollup_kitchen_orders(hospital, target_date: date) -> int:
    """
    Aggregate planned/in-kitchen meals for a date into KitchenOrder rows.
    Returns count of order rows created/updated.
    """
    counts = (PatientMeal.objects
              .filter(
                  diet_plan__hospital=hospital,
                  meal_date=target_date,
                  status__in=["PLANNED", "IN_KITCHEN"],
              )
              .values("meal_type", "item")
              .annotate(qty=Count("id"))
              .order_by("meal_type", "item"))

    n = 0
    for row in counts:
        item = MealItem.objects.get(id=row["item"])
        ko, _ = KitchenOrder.objects.update_or_create(
            hospital=hospital,
            order_date=target_date,
            meal_type=row["meal_type"],
            item=item,
            defaults={"quantity": row["qty"]},
        )
        n += 1
    return n


def kitchen_today_summary(hospital, target_date=None):
    if target_date is None:
        target_date = timezone.localdate()

    rollup_kitchen_orders(hospital, target_date)

    by_meal = {}
    for ko in KitchenOrder.objects.filter(
        hospital=hospital, order_date=target_date,
    ).select_related("item").order_by("meal_type", "item__name"):
        by_meal.setdefault(ko.meal_type, []).append({
            "item_id": ko.item.id,
            "item_code": ko.item.code,
            "item_name": ko.item.name,
            "quantity": ko.quantity,
            "is_finalized": ko.is_finalized,
        })

    return {
        "date": target_date.isoformat(),
        "by_meal_type": by_meal,
        "total_meals": sum(
            len(items) for items in by_meal.values()
        ),
        "total_servings": sum(
            i["quantity"] for items in by_meal.values() for i in items
        ),
    }
