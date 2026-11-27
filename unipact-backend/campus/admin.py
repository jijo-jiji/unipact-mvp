from django.contrib import admin

from .models import OrgUnit, PilotAccess, RoleAssignment, StaffProfile


@admin.register(OrgUnit)
class OrgUnitAdmin(admin.ModelAdmin):
    list_display = ('name', 'short_name', 'kind', 'sector', 'parent', 'is_active')
    list_filter = ('kind', 'sector', 'is_active')
    search_fields = ('name', 'short_name')
    autocomplete_fields = ('parent',)


@admin.register(StaffProfile)
class StaffProfileAdmin(admin.ModelAdmin):
    list_display = ('full_name', 'user', 'title', 'home_unit')
    search_fields = ('full_name', 'user__email', 'staff_id')
    autocomplete_fields = ('home_unit',)
    raw_id_fields = ('user',)


@admin.register(RoleAssignment)
class RoleAssignmentAdmin(admin.ModelAdmin):
    list_display = ('user', 'role', 'unit', 'position', 'session', 'starts_on', 'ends_on', 'ended_at')
    list_filter = ('role', 'unit__kind')
    search_fields = ('user__email', 'unit__name', 'position')
    autocomplete_fields = ('unit',)
    raw_id_fields = ('user', 'assigned_by')


@admin.register(PilotAccess)
class PilotAccessAdmin(admin.ModelAdmin):
    list_display = ('email', 'campus', 'note', 'added_by', 'created_at')
    list_filter = ('campus',)
    search_fields = ('email', 'note')
