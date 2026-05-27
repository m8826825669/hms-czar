from django.contrib import admin

from .models import Message, Bulletin, BulletinAcknowledgment


@admin.register(Message)
class MessageAdmin(admin.ModelAdmin):
    list_display = ("created_at", "sender", "recipient", "subject",
                     "priority", "read_at", "hospital")
    list_filter = ("priority", "hospital",
                    "is_archived_by_sender", "is_archived_by_recipient")
    search_fields = ("subject", "body", "sender__username", "recipient__username")
    raw_id_fields = ("sender", "recipient", "parent_message", "created_by")
    readonly_fields = ("read_at", "created_at", "updated_at")


@admin.register(Bulletin)
class BulletinAdmin(admin.ModelAdmin):
    list_display = ("created_at", "title", "author", "audience_type",
                     "category", "priority", "is_pinned",
                     "requires_acknowledgment", "hospital")
    list_filter = ("audience_type", "category", "priority", "is_pinned",
                    "requires_acknowledgment", "hospital")
    search_fields = ("title", "body", "author__username")
    raw_id_fields = ("author", "audience_department", "audience_ward",
                      "created_by")
    readonly_fields = ("created_at", "updated_at")
    date_hierarchy = "created_at"


@admin.register(BulletinAcknowledgment)
class BulletinAcknowledgmentAdmin(admin.ModelAdmin):
    list_display = ("acknowledged_at", "bulletin", "user", "hospital")
    list_filter = ("hospital",)
    search_fields = ("bulletin__title", "user__username", "note")
    raw_id_fields = ("bulletin", "user", "created_by")
    readonly_fields = ("acknowledged_at", "created_at", "updated_at")
    date_hierarchy = "acknowledged_at"
