from django.contrib import admin

from .models import Profile


@admin.register(Profile)
class ProfileAdmin(admin.ModelAdmin):
    list_display = ("user", "goal")
    search_fields = ("user__username",)
    raw_id_fields = ("user",)
