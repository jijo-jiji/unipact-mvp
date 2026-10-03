from django.contrib import admin

from .models import AgreementAcceptance


@admin.register(AgreementAcceptance)
class AgreementAcceptanceAdmin(admin.ModelAdmin):
    """Read-only evidence of who accepted which agreement version, and when."""
    list_display = ('user', 'agreement', 'version', 'accepted_at')
    list_filter = ('agreement', 'version')
    search_fields = ('user__email',)
    readonly_fields = ('user', 'agreement', 'version', 'accepted_at')

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False
