from django.contrib import admin
from .models import DietType, MealItem, DietPlan, PatientMeal, KitchenOrder


@admin.register(DietType)
class DietTypeAdmin(admin.ModelAdmin):
    list_display = ["code", "name", "calories_per_day",
                     "is_diabetic_safe", "is_renal_safe", "is_active"]
    list_filter = ["is_diabetic_safe", "is_renal_safe", "is_cardiac_safe", "is_active"]
    search_fields = ["code", "name"]


@admin.register(MealItem)
class MealItemAdmin(admin.ModelAdmin):
    list_display = ["code", "name", "meal_type", "calories", "cost_per_serving",
                     "is_vegetarian", "is_active"]
    list_filter = ["meal_type", "is_vegetarian", "is_jain", "is_active"]
    search_fields = ["code", "name"]


class PatientMealInline(admin.TabularInline):
    model = PatientMeal
    extra = 0
    readonly_fields = ["delivered_at", "created_at", "updated_at"]


@admin.register(DietPlan)
class DietPlanAdmin(admin.ModelAdmin):
    list_display = ["patient", "diet_type", "status", "started_at", "ended_at"]
    list_filter = ["status", "diet_type"]
    search_fields = ["patient__mrn", "admission__code"]
    autocomplete_fields = ["patient", "admission", "diet_type", "prescribed_by"]
    readonly_fields = ["created_at", "updated_at"]
    inlines = [PatientMealInline]


@admin.register(PatientMeal)
class PatientMealAdmin(admin.ModelAdmin):
    list_display = ["diet_plan", "meal_date", "meal_type", "item", "status"]
    list_filter = ["status", "meal_type", "meal_date"]
    autocomplete_fields = ["diet_plan", "item"]
    readonly_fields = ["delivered_at", "created_at", "updated_at"]


@admin.register(KitchenOrder)
class KitchenOrderAdmin(admin.ModelAdmin):
    list_display = ["order_date", "meal_type", "item", "quantity", "is_finalized"]
    list_filter = ["order_date", "meal_type", "is_finalized"]
    autocomplete_fields = ["item"]
