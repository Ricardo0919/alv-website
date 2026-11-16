from django.conf import settings
from django.db import models


class Friendship(models.Model):
    """
    Solicitud de amistad de from_user a to_user. Al aceptarse (ACCEPTED) la
    amistad es mutua: ambos se ven en su tablero. Rechazar, cancelar o dejar
    de ser amigos borra la fila.
    """

    PENDING = "PENDING"
    ACCEPTED = "ACCEPTED"
    STATUSES = [(PENDING, "Pendiente"), (ACCEPTED, "Aceptada")]

    from_user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="friendships_sent")
    to_user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="friendships_received")
    status = models.CharField(max_length=10, choices=STATUSES, default=PENDING)
    created_at = models.DateTimeField(auto_now_add=True)
    accepted_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["from_user", "to_user"], name="friends_unique_pair"),
            models.CheckConstraint(condition=~models.Q(from_user=models.F("to_user")), name="friends_not_self"),
        ]
        indexes = [models.Index(fields=["to_user", "status"], name="friends_inbox_idx")]

    def __str__(self):
        return f"{self.from_user} → {self.to_user} ({self.status})"
