from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import (
    CrumbRequestViewSet,
    InteractionViewSet,
    PublicProfileView,
    SendCrumbRequestView,
    StatsView,
)

router = DefaultRouter()
router.register(r"interactions", InteractionViewSet, basename="interaction")
router.register(r"requests", CrumbRequestViewSet, basename="crumb-request")

urlpatterns = [
    path("", include(router.urls)),
    path("stats/", StatsView.as_view(), name="stats"),
    path("users/<str:username>/", PublicProfileView.as_view(), name="public-profile"),
    path("users/<str:username>/requests/", SendCrumbRequestView.as_view(), name="send-crumb-request"),
]
