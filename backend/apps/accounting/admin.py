from django.contrib import admin

from .models import Account, JournalEntry, JournalLine


@admin.register(Account)
class AccountAdmin(admin.ModelAdmin):
    list_display = ("code", "name", "account_type", "is_postable",
                     "is_active", "parent", "hospital")
    list_filter = ("account_type", "is_postable", "is_active", "hospital")
    search_fields = ("code", "name", "description")
    raw_id_fields = ("parent", "created_by")
    ordering = ("code",)


class JournalLineInline(admin.TabularInline):
    model = JournalLine
    extra = 0
    fields = ("account", "debit", "credit", "narration")
    raw_id_fields = ("account",)


@admin.register(JournalEntry)
class JournalEntryAdmin(admin.ModelAdmin):
    list_display = ("entry_number", "entry_date", "narration", "status",
                     "posted_at", "is_locked", "hospital")
    list_filter = ("status", "is_locked", "hospital")
    search_fields = ("entry_number", "narration", "reference")
    raw_id_fields = ("posted_by", "created_by")
    inlines = [JournalLineInline]
    date_hierarchy = "entry_date"
    ordering = ("-entry_date", "-id")
    readonly_fields = ("posted_at", "posted_by", "created_at", "updated_at")


@admin.register(JournalLine)
class JournalLineAdmin(admin.ModelAdmin):
    list_display = ("entry", "account", "debit", "credit", "hospital")
    list_filter = ("account__account_type", "hospital")
    search_fields = ("account__code", "account__name",
                      "entry__entry_number", "narration")
    raw_id_fields = ("entry", "account", "created_by")
