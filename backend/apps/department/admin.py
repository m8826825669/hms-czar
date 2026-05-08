from django.contrib import admin
from .models import Department


@admin.register(Department)
class DepartmentAdmin(admin.ModelAdmin):
    list_display = ("code", "name", "type", "head_doctor", "is_active", "sort_order")
    list_filter = ("type", "is_active")
    search_fields = ("code", "name")
    autocomplete_fields = ("head_doctor",)
