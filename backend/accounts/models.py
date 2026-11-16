from django.conf import settings
from django.db import models
from django.utils import timezone

DEFAULT_GOAL = 80_000
MAX_GOAL = 10_000_000


class Profile(models.Model):
    """Preferencias del usuario. Se crea al cambiar la meta por primera vez."""

    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="profile")
    goal = models.PositiveIntegerField(default=DEFAULT_GOAL)
    # Cuándo llegó a su meta (para el ranking de amigos: quién llegó primero)
    goal_reached_at = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        return f"{self.user} · meta {self.goal:,}"


def get_goal(user) -> int:
    """Meta del usuario (80,000 si nunca la ha cambiado). No crea filas al leer."""
    goal = Profile.objects.filter(user=user).values_list("goal", flat=True).first()
    return goal or DEFAULT_GOAL


def set_goal(user, goal: int) -> int:
    from migajas.services import raw_total

    Profile.objects.update_or_create(user=user, defaults={"goal": goal})
    sync_goal_reached(user, raw_total(user), goal)
    return goal


def sync_goal_reached(user, total: int, goal: int) -> None:
    """Marca la fecha al llegar a la meta y la borra si vuelve a quedar por debajo."""
    reached = total >= goal
    profile = Profile.objects.filter(user=user).first()
    if reached and (profile is None or profile.goal_reached_at is None):
        Profile.objects.update_or_create(user=user, defaults={"goal": goal, "goal_reached_at": timezone.now()})
    elif not reached and profile is not None and profile.goal_reached_at is not None:
        profile.goal_reached_at = None
        profile.save(update_fields=["goal_reached_at"])
