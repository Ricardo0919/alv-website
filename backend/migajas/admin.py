from django.contrib import admin

from .models import CrumbRequest, Interaction


@admin.register(Interaction)
class InteractionAdmin(admin.ModelAdmin):
    list_display = ("id", "user", "type", "count_or_duration", "crumbs", "created_at")
    list_filter = ("type",)
    search_fields = ("user__username",)
    list_select_related = ("user",)
    raw_id_fields = ("user",)


@admin.register(CrumbRequest)
class CrumbRequestAdmin(admin.ModelAdmin):
    list_display = ("id", "sender", "recipient", "crumbs", "status", "created_at")
    list_filter = ("status",)
    search_fields = ("sender__username", "recipient__username", "reason")
    list_select_related = ("sender", "recipient")
    raw_id_fields = ("sender", "recipient")
