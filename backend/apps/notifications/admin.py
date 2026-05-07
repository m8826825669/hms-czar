from django.contrib import admin
from .models import NotificationLog, NotificationTemplate


@admin.register(NotificationTemplate)
class NotificationTemplateAdmin(admin.ModelAdmin):
    list_display = ("code", "name", "channel", "is_active", "hospital")
    list_filter = ("channel", "is_active")
    search_fields = ("code", "name", "body")


@admin.register(NotificationLog)
class NotificationLogAdmin(admin.ModelAdmin):
    list_display = ("created_at", "channel", "to_address", "status",
                    "provider", "related_object_type", "related_object_id")
    list_filter = ("channel", "status", "provider")
    search_fields = ("to_address", "body", "provider_message_id")
    readonly_fields = [f.name for f in NotificationLog._meta.fields]
    date_hierarchy = "created_at"
