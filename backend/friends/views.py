from django.contrib.auth import get_user_model
from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from .models import Friendship
from .serializers import FriendRequestSerializer, SendFriendRequestSerializer
from .services import FriendshipError, accept, between, leaderboard, relationship, send_request

User = get_user_model()


def _get_user(username):
    return get_object_or_404(User, username__iexact=username, is_active=True)


class LeaderboardView(APIView):
    """GET /api/friends/ — tablero con el usuario y sus amigos."""

    def get(self, request):
        return Response(leaderboard(request.user))


class FriendDetailView(APIView):
    """DELETE /api/friends/<usuario>/ — dejar de ser amigos."""

    def delete(self, request, username):
        other = _get_user(username)
        deleted, _ = between(request.user, other).filter(status=Friendship.ACCEPTED).delete()
        if not deleted:
            return Response({"detail": "No son amigos."}, status=status.HTTP_404_NOT_FOUND)
        return Response(status=status.HTTP_204_NO_CONTENT)


class RelationshipView(APIView):
    """GET /api/friends/status/<usuario>/ — para mostrar el botón correcto en un perfil."""

    def get(self, request, username):
        return Response(relationship(request.user, _get_user(username)))


class FriendRequestsView(APIView):
    """
    GET  /api/friends/requests/  — solicitudes pendientes recibidas y enviadas.
    POST /api/friends/requests/  {"username": "..."} — enviar solicitud.
    """

    throttle_scope = "friend_requests"

    def get_throttles(self):
        # Límite general siempre; el envío además tiene su propio límite por hora
        throttles = super().get_throttles()
        return [*throttles, ScopedRateThrottle()] if self.request.method == "POST" else throttles

    def get(self, request):
        pending = (
            Friendship.objects.filter(status=Friendship.PENDING)
            .select_related("from_user", "to_user")
            .order_by("-created_at")
        )
        # Tope de resultados: la respuesta nunca crece sin límite
        return Response(
            {
                "received": FriendRequestSerializer(pending.filter(to_user=request.user)[:100], many=True).data,
                "sent": FriendRequestSerializer(pending.filter(from_user=request.user)[:100], many=True).data,
            }
        )

    def post(self, request):
        serializer = SendFriendRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        other = _get_user(serializer.validated_data["username"])
        try:
            friendship = send_request(request.user, other)
        except FriendshipError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(FriendRequestSerializer(friendship).data, status=status.HTTP_201_CREATED)


class FriendRequestActionView(APIView):
    """
    POST   /api/friends/requests/<id>/accept/  — aceptar (solo quien la recibe)
    POST   /api/friends/requests/<id>/reject/  — rechazar (solo quien la recibe)
    DELETE /api/friends/requests/<id>/         — cancelar (solo quien la envió)
    """

    def post(self, request, pk, action=None):
        if action not in ("accept", "reject"):
            return Response(status=status.HTTP_404_NOT_FOUND)
        friendship = get_object_or_404(Friendship, pk=pk, to_user=request.user, status=Friendship.PENDING)
        if action == "accept":
            return Response(FriendRequestSerializer(accept(friendship)).data)
        friendship.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    def delete(self, request, pk, action=None):
        if action is not None:
            return Response(status=status.HTTP_405_METHOD_NOT_ALLOWED)
        friendship = get_object_or_404(Friendship, pk=pk, from_user=request.user, status=Friendship.PENDING)
        friendship.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
