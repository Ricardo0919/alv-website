from django.contrib.auth import get_user_model
from django.db import transaction
from django.db.models import F, IntegerField, Q, Sum, Value
from django.db.models.functions import Coalesce
from django.utils import timezone

from accounts.models import DEFAULT_GOAL

from .models import Friendship

User = get_user_model()


class FriendshipError(Exception):
    pass


def between(a, b):
    """Relación entre dos usuarios, en cualquier dirección."""
    return Friendship.objects.filter(Q(from_user=a, to_user=b) | Q(from_user=b, to_user=a))


def friend_ids(user) -> list[int]:
    accepted = Friendship.objects.filter(status=Friendship.ACCEPTED)
    sent = accepted.filter(from_user=user).values_list("to_user_id", flat=True)
    received = accepted.filter(to_user=user).values_list("from_user_id", flat=True)
    return [*sent, *received]


def relationship(me, other) -> dict:
    """Estado visto desde `me`: self, friends, pending_sent, pending_received o none."""
    if me.pk == other.pk:
        return {"status": "self", "request_id": None}
    friendship = between(me, other).first()
    if friendship is None:
        return {"status": "none", "request_id": None}
    if friendship.status == Friendship.ACCEPTED:
        return {"status": "friends", "request_id": friendship.pk}
    status = "pending_sent" if friendship.from_user_id == me.pk else "pending_received"
    return {"status": status, "request_id": friendship.pk}


@transaction.atomic
def send_request(me, other) -> Friendship:
    """
    Envía una solicitud. Si el otro ya me había enviado una, se acepta
    automáticamente (los dos quieren ser amigos).
    """
    if me.pk == other.pk:
        raise FriendshipError("No puedes agregarte a ti mismo.")

    existing = between(me, other).select_for_update().first()
    if existing is not None:
        if existing.status == Friendship.ACCEPTED:
            raise FriendshipError(f"{other.username} y tú ya son amigos.")
        if existing.from_user_id == me.pk:
            raise FriendshipError(f"Ya le enviaste una solicitud a {other.username}.")
        return accept(existing)

    return Friendship.objects.create(from_user=me, to_user=other)


def accept(friendship: Friendship) -> Friendship:
    friendship.status = Friendship.ACCEPTED
    friendship.accepted_at = timezone.now()
    friendship.save(update_fields=["status", "accepted_at"])
    return friendship


def leaderboard(user) -> list[dict]:
    """
    Tablero: el usuario y sus amigos, ordenados por quién va ganando.
      1) Quienes ya llegaron a su meta, en orden de llegada.
      2) El resto por porcentaje de su meta (cada quien puede tener una meta distinta).
    Una sola consulta con agregados (sin una consulta por amigo).
    """
    rows = (
        User.objects.filter(pk__in=[user.pk, *friend_ids(user)], is_active=True)
        .annotate(
            raw_total=Coalesce(Sum("interactions__crumbs"), Value(0), output_field=IntegerField()),
            goal=Coalesce(F("profile__goal"), Value(DEFAULT_GOAL), output_field=IntegerField()),
            reached_at=F("profile__goal_reached_at"),
        )
        .values("username", "raw_total", "goal", "reached_at")
    )

    entries = []
    for row in rows:
        goal = row["goal"] or DEFAULT_GOAL
        total = min(goal, max(0, row["raw_total"]))
        entries.append(
            {
                "username": row["username"],
                "total_crumbs": total,
                "goal": goal,
                "percent": total / goal * 100,
                "goal_reached_at": row["reached_at"] if total >= goal else None,
                "is_me": row["username"] == user.username,
            }
        )

    now = timezone.now()
    entries.sort(
        key=lambda e: (
            e["goal_reached_at"] is None,
            e["goal_reached_at"] or now,
            -e["percent"],
            -e["total_crumbs"],
            e["username"].lower(),
        )
    )
    for position, entry in enumerate(entries, start=1):
        entry["rank"] = position
    return entries
