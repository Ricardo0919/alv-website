from django.urls import path

from .views import (
    FriendDetailView,
    FriendRequestActionView,
    FriendRequestsView,
    LeaderboardView,
    RelationshipView,
)

urlpatterns = [
    path("", LeaderboardView.as_view(), name="friends-leaderboard"),
    path("requests/", FriendRequestsView.as_view(), name="friend-requests"),
    path("requests/<int:pk>/", FriendRequestActionView.as_view(), name="friend-request-detail"),
    path("requests/<int:pk>/<str:action>/", FriendRequestActionView.as_view(), name="friend-request-action"),
    path("status/<str:username>/", RelationshipView.as_view(), name="friend-status"),
    path("<str:username>/", FriendDetailView.as_view(), name="friend-detail"),
]
