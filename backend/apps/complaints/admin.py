from django.contrib import admin
from .models import TicketCategory, Ticket, TicketComment, NPSResponse


@admin.register(TicketCategory)
class TicketCategoryAdmin(admin.ModelAdmin):
    list_display = ["code", "name", "default_priority",
                    "target_resolution_hours", "is_active"]
    list_filter = ["is_active", "default_priority"]
    search_fields = ["code", "name"]


class TicketCommentInline(admin.TabularInline):
    model = TicketComment
    extra = 0
    fields = ["author_name", "comment", "is_internal", "is_status_change", "created_at"]
    readonly_fields = ["created_at"]


@admin.register(Ticket)
class TicketAdmin(admin.ModelAdmin):
    list_display = ["code", "title", "category", "status", "priority",
                    "reporter_name", "assigned_to", "is_sla_breached", "created_at"]
    list_filter = ["status", "priority", "category", "is_sla_breached"]
    search_fields = ["code", "title", "reporter_name", "reporter_phone"]
    readonly_fields = ["code", "created_at", "updated_at", "resolved_at", "closed_at"]
    inlines = [TicketCommentInline]


@admin.register(TicketComment)
class TicketCommentAdmin(admin.ModelAdmin):
    list_display = ["ticket", "author_name", "is_internal", "created_at"]
    list_filter = ["is_internal", "is_status_change"]


@admin.register(NPSResponse)
class NPSResponseAdmin(admin.ModelAdmin):
    list_display = ["reporter_name", "score", "category", "related_department",
                    "related_visit_date", "created_at"]
    list_filter = ["score", "related_department"]
    search_fields = ["reporter_name", "reporter_phone", "feedback"]
