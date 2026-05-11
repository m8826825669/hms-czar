"""
Dietary / Kitchen module — Phase 3b.

Models:
  • DietType        — catalog (Diabetic, Renal, Cardiac, Liquid, Pureed, etc.)
  • MealItem        — kitchen menu catalog items
  • DietPlan        — patient's prescribed diet (linked to admission)
  • PatientMeal     — actual meal trays produced + delivered + consumed
  • KitchenOrder    — daily aggregate kitchen production sheet
"""
from decimal import Decimal
from django.db import models
from django.utils import timezone


class DietType(models.Model):
    """Catalog of standard hospital diets."""
    hospital = models.ForeignKey("core.Hospital", on_delete=models.CASCADE,
                                  related_name="diet_types")
    code = models.CharField(max_length=20, db_index=True)
    name = models.CharField(max_length=120)
    description = models.TextField(blank=True, default="")

    # Nutritional summary
    calories_per_day = models.PositiveIntegerField(default=0)
    protein_g = models.PositiveIntegerField(default=0)
    carbs_g = models.PositiveIntegerField(default=0)
    fat_g = models.PositiveIntegerField(default=0)
    sodium_mg = models.PositiveIntegerField(default=0)

    # Restrictions
    is_diabetic_safe = models.BooleanField(default=False)
    is_renal_safe = models.BooleanField(default=False)
    is_cardiac_safe = models.BooleanField(default=False)
    is_low_sodium = models.BooleanField(default=False)
    is_gluten_free = models.BooleanField(default=False)

    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["code"]
        unique_together = [["hospital", "code"]]

    def __str__(self):
        return f"{self.code} — {self.name}"


class MealItem(models.Model):
    """Single kitchen menu item — e.g. 'Idli with sambar', 'Khichdi', 'Roti+Dal'."""
    MEAL_TYPES = [
        ("BREAKFAST",     "Breakfast (07:30)"),
        ("MORNING_SNACK", "Mid-morning Snack (10:30)"),
        ("LUNCH",         "Lunch (12:30)"),
        ("EVENING_SNACK", "Evening Snack (16:30)"),
        ("DINNER",        "Dinner (19:30)"),
        ("BEDTIME",       "Bedtime Snack (21:30)"),
    ]

    hospital = models.ForeignKey("core.Hospital", on_delete=models.CASCADE,
                                  related_name="meal_items")
    code = models.CharField(max_length=20, db_index=True)
    name = models.CharField(max_length=120)
    meal_type = models.CharField(max_length=15, choices=MEAL_TYPES)
    description = models.CharField(max_length=300, blank=True, default="")

    calories = models.PositiveIntegerField(default=0)
    protein_g = models.DecimalField(max_digits=6, decimal_places=2, default=Decimal("0"))
    carbs_g = models.DecimalField(max_digits=6, decimal_places=2, default=Decimal("0"))
    fat_g = models.DecimalField(max_digits=6, decimal_places=2, default=Decimal("0"))

    # Tags for diet matching
    is_vegetarian = models.BooleanField(default=True)
    is_jain = models.BooleanField(default=False)
    contains_gluten = models.BooleanField(default=True)
    contains_dairy = models.BooleanField(default=True)
    contains_nuts = models.BooleanField(default=False)

    cost_per_serving = models.DecimalField(
        max_digits=8, decimal_places=2, default=Decimal("0"))

    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["meal_type", "code"]
        unique_together = [["hospital", "code"]]

    def __str__(self):
        return f"{self.code} — {self.name} ({self.get_meal_type_display()})"


class DietPlan(models.Model):
    """Diet prescription for an admitted patient."""
    STATUSES = [
        ("ACTIVE", "Active"),
        ("PAUSED", "Paused (NPO)"),
        ("ENDED",  "Ended"),
    ]

    hospital = models.ForeignKey("core.Hospital", on_delete=models.CASCADE,
                                  related_name="diet_plans")
    admission = models.ForeignKey("ipd.Admission", on_delete=models.CASCADE,
                                   related_name="diet_plans")
    patient = models.ForeignKey("core.Patient", on_delete=models.PROTECT,
                                 related_name="diet_plans")

    diet_type = models.ForeignKey(DietType, on_delete=models.PROTECT,
                                   related_name="plans")
    prescribed_by = models.ForeignKey(
        "specialist.Doctor", on_delete=models.SET_NULL, null=True, blank=True,
        related_name="prescribed_diet_plans",
    )

    # Patient-specific overrides
    is_vegetarian = models.BooleanField(default=True)
    is_jain = models.BooleanField(default=False)
    is_diabetic = models.BooleanField(default=False)
    allergies = models.CharField(max_length=300, blank=True, default="",
        help_text="Comma-separated, e.g. 'peanuts, shellfish'")
    food_preferences = models.TextField(blank=True, default="",
        help_text="Patient/family preferences — likes, dislikes")
    fluid_restriction_ml = models.PositiveIntegerField(
        null=True, blank=True,
        help_text="Daily fluid limit (renal patients)")

    # NPO (nil per oral) windows — common pre-op
    npo_until = models.DateTimeField(null=True, blank=True,
        help_text="Patient is NPO until this datetime")
    npo_reason = models.CharField(max_length=200, blank=True, default="")

    started_at = models.DateField(default=timezone.now)
    ended_at = models.DateField(null=True, blank=True)
    status = models.CharField(max_length=10, choices=STATUSES, default="ACTIVE")

    notes = models.TextField(blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-started_at"]

    def __str__(self):
        return f"{self.patient} — {self.diet_type.code} ({self.status})"


class PatientMeal(models.Model):
    """Single meal tray for a single patient, on a specific date."""
    STATUSES = [
        ("PLANNED",   "Planned"),
        ("IN_KITCHEN","Being Prepared"),
        ("READY",     "Ready for Delivery"),
        ("DELIVERED", "Delivered to Patient"),
        ("CONSUMED",  "Consumed"),
        ("REFUSED",   "Refused / Not Consumed"),
        ("CANCELLED", "Cancelled (NPO / discharge)"),
    ]

    diet_plan = models.ForeignKey(DietPlan, on_delete=models.CASCADE,
                                    related_name="meals")
    meal_date = models.DateField(db_index=True)
    meal_type = models.CharField(max_length=15, choices=MealItem.MEAL_TYPES,
                                  db_index=True)
    item = models.ForeignKey(MealItem, on_delete=models.PROTECT,
                              related_name="patient_meals")

    status = models.CharField(max_length=12, choices=STATUSES, default="PLANNED")

    delivered_at = models.DateTimeField(null=True, blank=True)
    delivered_by = models.CharField(max_length=120, blank=True, default="")
    consumed_percentage = models.PositiveIntegerField(default=0,
        help_text="0-100, recorded when nurse logs intake")
    refusal_reason = models.CharField(max_length=200, blank=True, default="")

    notes = models.CharField(max_length=300, blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["meal_date", "meal_type"]
        unique_together = [["diet_plan", "meal_date", "meal_type"]]
        indexes = [
            models.Index(fields=["meal_date", "status"]),
        ]

    def __str__(self):
        return f"{self.diet_plan.patient_id} — {self.meal_date} {self.meal_type}"


class KitchenOrder(models.Model):
    """Aggregate kitchen production sheet for one date+meal — auto-built from PatientMeals."""
    hospital = models.ForeignKey("core.Hospital", on_delete=models.CASCADE,
                                  related_name="kitchen_orders")
    order_date = models.DateField(db_index=True)
    meal_type = models.CharField(max_length=15, choices=MealItem.MEAL_TYPES)
    item = models.ForeignKey(MealItem, on_delete=models.PROTECT,
                              related_name="kitchen_orders")
    quantity = models.PositiveIntegerField(default=0)
    notes = models.CharField(max_length=300, blank=True, default="")

    is_finalized = models.BooleanField(default=False,
        help_text="Once finalized, kitchen counts are locked")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["order_date", "meal_type"]
        unique_together = [["hospital", "order_date", "meal_type", "item"]]
