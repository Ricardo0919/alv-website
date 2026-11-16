from django.contrib.auth import get_user_model
from django.shortcuts import get_object_or_404
from rest_framework import mixins, permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from accounts.models import get_goal

from .models import CrumbRequest, Interaction
from .serializers import (
    CrumbRequestCreateSerializer,
    CrumbRequestSerializer,
    InteractionBatchSerializer,
    InteractionSerializer,
)
from .services import (
    GoalReached,
    MAX_PENDING_PER_SENDER,
    record_interactions,
    resolve_crumb_request,
    user_total,
)


def goal_reached_response():
    return Response(
        {
            "detail": "¡Ya llegaste a tu meta! Ya no puedes sumar más migajas… ya no seas tan migajero.",
            "code": "goal_reached",
        },
        status=status.HTTP_400_BAD_REQUEST,
    )


class InteractionViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.CreateModelMixin,
    viewsets.GenericViewSet,
):
    """Historial de migajas del usuario autenticado (solo ve las suyas)."""

    serializer_class = InteractionSerializer

    def get_queryset(self):
        return Interaction.objects.filter(user=self.request.user).select_related("gift_from").order_by("-created_at")

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            [interaction] = record_interactions(request.user, [serializer.validated_data])
        except GoalReached:
            return goal_reached_response()
        return Response(self.get_serializer(interaction).data, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=["post"])
    def batch(self, request):
        """Registra varias interacciones de una vez (una sola transacción)."""
        serializer = InteractionBatchSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            created = record_interactions(request.user, serializer.validated_data["items"])
        except GoalReached:
            return goal_reached_response()
        return Response(
            {
                "created": InteractionSerializer(created, many=True).data,
                "total_crumbs": user_total(request.user),
            },
            status=status.HTTP_201_CREATED,
        )


def stats_payload(user):
    goal = get_goal(user)
    total = user_total(user, goal)
    return {"username": user.username, "total_crumbs": total, "goal": goal, "percent": total / goal * 100}


class StatsView(APIView):
    """Estadísticas del usuario autenticado."""

    def get(self, request):
        return Response(stats_payload(request.user))


class PublicProfileView(APIView):
    """
    Perfil público de solo lectura: cualquiera con el link puede ver el progreso.
    Solo acepta GET; para registrar migajas siempre se requiere sesión del dueño.
    """

    permission_classes = [permissions.AllowAny]
    authentication_classes = []  # un token inválido no debe impedir ver un perfil público
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "public"
    http_method_names = ["get", "head", "options"]

    def get(self, request, username):
        user = get_object_or_404(get_user_model(), username__iexact=username, is_active=True)
        return Response(stats_payload(user))


class SendCrumbRequestView(APIView):
    """
    POST /api/users/<usuario>/requests/  — regalar migajas a otro usuario.
    Requiere sesión. No suma nada hasta que el destinatario la acepta.
    """

    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "crumb_requests"

    def post(self, request, username):
        recipient = get_object_or_404(get_user_model(), username__iexact=username, is_active=True)
        if recipient == request.user:
            return Response(
                {"detail": "No puedes regalarte migajas a ti mismo; regístralas desde tu cuenta."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        pending = CrumbRequest.objects.filter(
            sender=request.user, recipient=recipient, status=CrumbRequest.PENDING
        ).count()
        if pending >= MAX_PENDING_PER_SENDER:
            return Response(
                {"detail": f"Ya tienes {pending} solicitudes pendientes con {recipient.username}. Espera a que responda."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = CrumbRequestCreateSerializer(data=request.data, context={"recipient": recipient})
        serializer.is_valid(raise_exception=True)
        crumb_request = CrumbRequest.objects.create(
            recipient=recipient,
            sender=request.user,
            crumbs=serializer.validated_data["crumbs"],
            reason=serializer.validated_data["reason"],
        )
        return Response(CrumbRequestSerializer(crumb_request).data, status=status.HTTP_201_CREATED)


class CrumbRequestViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Notificaciones: solicitudes de migajas que me enviaron.
    GET ?status=PENDING|ACCEPTED|REJECTED para filtrar.
    """

    serializer_class = CrumbRequestSerializer

    def get_queryset(self):
        qs = CrumbRequest.objects.filter(recipient=self.request.user).select_related("sender", "recipient")
        wanted = self.request.query_params.get("status")
        if wanted in dict(CrumbRequest.STATUSES):
            qs = qs.filter(status=wanted)
        return qs

    @action(detail=False, methods=["get"], url_path="pending-count")
    def pending_count(self, request):
        # La campana cuenta regalos y solicitudes de amistad pendientes
        from friends.models import Friendship

        crumbs = CrumbRequest.objects.filter(recipient=request.user, status=CrumbRequest.PENDING).count()
        friends = Friendship.objects.filter(to_user=request.user, status=Friendship.PENDING).count()
        return Response({"pending": crumbs + friends, "crumb_requests": crumbs, "friend_requests": friends})

    def _resolve(self, request, pk, accept):
        try:
            crumb_request = resolve_crumb_request(pk, request.user, accept=accept)
        except GoalReached:
            return Response(
                {
                    "detail": "Ya llegaste a tu meta, ya no te caben más migajas. Puedes rechazar esta solicitud.",
                    "code": "goal_reached",
                },
                status=status.HTTP_400_BAD_REQUEST,
            )
        if crumb_request is None:
            return Response(
                {"detail": "La solicitud no existe o ya fue respondida."}, status=status.HTTP_404_NOT_FOUND
            )
        return Response(
            {"request": CrumbRequestSerializer(crumb_request).data, "total_crumbs": user_total(request.user)}
        )

    @action(detail=True, methods=["post"])
    def accept(self, request, pk=None):
        return self._resolve(request, pk, accept=True)

    @action(detail=True, methods=["post"])
    def reject(self, request, pk=None):
        return self._resolve(request, pk, accept=False)
