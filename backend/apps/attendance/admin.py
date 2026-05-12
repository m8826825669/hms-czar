from django.contrib import admin
from .models import Shift, Holiday, ShiftRoster, AttendanceLog, DailyAttendance, Overtime


@admin.register(Shift)
class ShiftAdmin(admin.ModelAdmin):
    list_display = ["code", "name", "start_time", "end_time",
                     "work_hours", "is_night_shift", "is_active"]


@admin.register(Holiday)
class HolidayAdmin(admin.ModelAdmin):
    list_display = ["date", "name", "is_optional"]


@admin.register(ShiftRoster)
class ShiftRosterAdmin(admin.ModelAdmin):
    list_display = ["employee", "shift", "work_date", "is_off_day"]
    list_filter = ["work_date", "shift"]
    raw_id_fields = ["employee", "shift"]


@admin.register(AttendanceLog)
class AttendanceLogAdmin(admin.ModelAdmin):
    list_display = ["employee", "punch_time", "punch_type", "source"]
    list_filter = ["punch_type", "source"]
    raw_id_fields = ["employee"]


@admin.register(DailyAttendance)
class DailyAttendanceAdmin(admin.ModelAdmin):
    list_display = ["employee", "work_date", "status",
                     "check_in_time", "check_out_time", "hours_worked"]
    list_filter = ["status", "work_date"]
    raw_id_fields = ["employee"]


@admin.register(Overtime)
class OvertimeAdmin(admin.ModelAdmin):
    list_display = ["employee", "work_date", "hours", "status"]
    list_filter = ["status"]
    raw_id_fields = ["employee", "approved_by"]
