from django.conf import settings
from django.db import models


class Interaction(models.Model):
    CONVERSATION = "CONVERSATION"
    CALL = "CALL"
    REMOVAL = "REMOVAL"
    GIFT = "GIFT"
    ADD = "ADD"
    INTERACTION_TYPES = [
        (CONVERSATION, "Conversation"),
        (CALL, "Call"),
        (REMOVAL, "Removal"),
        (GIFT, "Gift"),
        (ADD, "Add"),
    ]

    # null=True solo para registros creados antes de que existieran usuarios.
    # Se asignan con: python manage.py asignar_migajas <usuario>
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="interactions",
        null=True,
        blank=True,
    )
    type = models.CharField(max_length=20, choices=INTERACTION_TYPES)
    # count_or_duration significa:
    # - número de mensajes si type es CONVERSATION
    # - minutos si type es CALL
    # - migajas a quitar si type es REMOVAL
    # - migajas regaladas si type es GIFT (solicitud aceptada de otro usuario)
    # - migajas a sumar si type es ADD (registro directo con número)
    count_or_duration = models.IntegerField()
    # Por qué se registró (opcional en registros propios, obligatorio en regalos)
    reason = models.CharField(max_length=280, blank=True, default="")
    # En regalos: quién las envió
    gift_from = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="+"
    )
    crumbs = models.IntegerField(editable=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [models.Index(fields=["user", "-created_at"], name="migajas_user_created_idx")]

    def save(self, *args, **kwargs):
        if self.crumbs is None:
            self.crumbs = self.calculate_crumbs()
        super().save(*args, **kwargs)

    def calculate_crumbs(self):
        if self.type == self.REMOVAL:
            return -abs(self.count_or_duration)
        if self.type in (self.GIFT, self.ADD):
            return abs(self.count_or_duration)
        if self.type == self.CONVERSATION:
            # 5+ mensajes = 1 migaja
            return 1 if self.count_or_duration >= 5 else 0
        if self.type == self.CALL:
            # 5+ minutos = 5 migajas, si no, 1
            return 5 if self.count_or_duration >= 5 else 1
        return 0

    def __str__(self):
        return f"{self.user} · {self.type} · {self.crumbs} migajas"


class CrumbRequest(models.Model):
    """
    Migajas que otro usuario quiere regalar. No cuentan hasta que el dueño
    de la cuenta (recipient) las acepta desde sus notificaciones.
    """

    PENDING = "PENDING"
    ACCEPTED = "ACCEPTED"
    REJECTED = "REJECTED"
    STATUSES = [(PENDING, "Pendiente"), (ACCEPTED, "Aceptada"), (REJECTED, "Rechazada")]

    recipient = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="received_crumb_requests"
    )
    sender = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="sent_crumb_requests"
    )
    crumbs = models.PositiveIntegerField(help_text="Migajas que se sumarían al aceptar")
    reason = models.CharField(max_length=280)
    status = models.CharField(max_length=10, choices=STATUSES, default=PENDING)
    created_at = models.DateTimeField(auto_now_add=True)
    resolved_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [models.Index(fields=["recipient", "status", "-created_at"], name="migajas_req_inbox_idx")]

    def __str__(self):
        return f"{self.sender} → {self.recipient}: {self.crumbs} ({self.status})"
