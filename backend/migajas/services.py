from django.contrib.auth import get_user_model
from django.db import transaction
from django.db.models import Sum
from django.utils import timezone

from accounts.models import get_goal, sync_goal_reached

from .models import CrumbRequest, Interaction


class GoalReached(Exception):
    """Se intentó sumar migajas a alguien que ya llegó a su meta."""


def clamp(value: int, goal: int) -> int:
    return min(goal, max(0, value))


def raw_total(user) -> int:
    return Interaction.objects.filter(user=user).aggregate(total=Sum("crumbs"))["total"] or 0


def user_total(user, goal: int | None = None) -> int:
    """Total visible del usuario, siempre entre 0 y su meta."""
    return clamp(raw_total(user), goal or get_goal(user))


@transaction.atomic
def record_interactions(user, items: list[dict]) -> list[Interaction]:
    """
    Guarda varias interacciones del usuario en una sola transacción.

    Bloquea la fila del usuario para que dos peticiones simultáneas no lean
    el mismo total y lo dejen inconsistente. Cada interacción guarda el delta
    real aplicado, de modo que el total nunca sale del rango [0, meta del usuario].
    """
    get_user_model().objects.select_for_update().only("pk").get(pk=user.pk)

    goal = get_goal(user)
    current = raw_total(user)

    # Meta llena: no se puede sumar nada más (quitar sí se permite)
    adds_crumbs = any(
        Interaction(type=item["type"], count_or_duration=item["count_or_duration"]).calculate_crumbs() > 0
        for item in items
    )
    if adds_crumbs and clamp(current, goal) >= goal:
        raise GoalReached
    created = []
    for item in items:
        batch_quantity = item.get("batch_quantity", 1)
        interaction = Interaction(
            user=user,
            type=item["type"],
            count_or_duration=item["count_or_duration"],
            reason=(item.get("reason") or "").strip(),
            gift_from=item.get("gift_from"),
        )
        intended_delta = interaction.calculate_crumbs() * batch_quantity
        target = clamp(clamp(current, goal) + intended_delta, goal)
        interaction.crumbs = target - current
        interaction.save()
        current = target
        created.append(interaction)
    sync_goal_reached(user, current, goal)
    return created


MAX_PENDING_PER_SENDER = 10


@transaction.atomic
def resolve_crumb_request(crumb_request_id: int, recipient, accept: bool):
    """
    Acepta o rechaza una solicitud. Bloquea la fila para que un doble clic
    (o dos pestañas) no sume las migajas dos veces.
    Devuelve la solicitud, o None si no existe / no es del usuario / ya se resolvió.
    """
    crumb_request = (
        CrumbRequest.objects.select_for_update()
        .filter(pk=crumb_request_id, recipient=recipient, status=CrumbRequest.PENDING)
        .first()
    )
    if crumb_request is None:
        return None

    if accept:
        record_interactions(
            recipient,
            [
                {
                    "type": Interaction.GIFT,
                    "count_or_duration": crumb_request.crumbs,
                    "reason": crumb_request.reason,
                    "gift_from": crumb_request.sender,
                }
            ],
        )
        crumb_request.status = CrumbRequest.ACCEPTED
    else:
        crumb_request.status = CrumbRequest.REJECTED
    crumb_request.resolved_at = timezone.now()
    crumb_request.save(update_fields=["status", "resolved_at"])
    return crumb_request
