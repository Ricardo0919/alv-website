from rest_framework import serializers

from accounts.models import MAX_GOAL, get_goal

from .models import CrumbRequest, Interaction


class InteractionSerializer(serializers.ModelSerializer):
    count_or_duration = serializers.IntegerField(min_value=0, max_value=MAX_GOAL)
    batch_quantity = serializers.IntegerField(
        write_only=True, required=False, min_value=1, max_value=MAX_GOAL, default=1
    )
    reason = serializers.CharField(max_length=280, required=False, allow_blank=True, default="")
    gift_from = serializers.CharField(source="gift_from.username", read_only=True, default=None)

    class Meta:
        model = Interaction
        fields = (
            "id",
            "type",
            "count_or_duration",
            "batch_quantity",
            "reason",
            "gift_from",
            "crumbs",
            "created_at",
        )
        read_only_fields = ("id", "crumbs", "created_at", "gift_from")

    def validate_type(self, value):
        # Los regalos solo entran aceptando una solicitud de otro usuario
        if value == Interaction.GIFT:
            raise serializers.ValidationError("Las migajas regaladas se reciben desde Notificaciones.")
        return value


class InteractionBatchSerializer(serializers.Serializer):
    items = InteractionSerializer(many=True, allow_empty=False, max_length=20)


class CrumbRequestCreateSerializer(serializers.Serializer):
    crumbs = serializers.IntegerField(
        min_value=1,
        max_value=MAX_GOAL,
        error_messages={"min_value": "Regala al menos 1 migaja.", "max_value": f"El máximo es {MAX_GOAL:,}."},
    )
    reason = serializers.CharField(max_length=280, trim_whitespace=True)

    def validate_crumbs(self, value):
        # No se puede regalar más de lo que le falta a quien recibe para su meta
        from .services import user_total

        recipient = self.context["recipient"]
        goal = get_goal(recipient)
        remaining = goal - user_total(recipient, goal)
        if remaining <= 0:
            raise serializers.ValidationError(
                f"{recipient.username} ya llenó su bolillo: llegó a su meta y no le caben más migajas. "
                "Guárdalas para alguien que sí las necesite."
            )
        if value > remaining:
            raise serializers.ValidationError(
                f"A {recipient.username} solo le faltan {remaining:,} migajas para su meta; no le regales de más."
            )
        return value

    def validate_reason(self, value):
        if len(value) < 3:
            raise serializers.ValidationError("Escribe una razón un poco más larga.")
        return value


class CrumbRequestSerializer(serializers.ModelSerializer):
    sender = serializers.CharField(source="sender.username", read_only=True)
    recipient = serializers.CharField(source="recipient.username", read_only=True)

    class Meta:
        model = CrumbRequest
        fields = ("id", "sender", "recipient", "crumbs", "reason", "status", "created_at", "resolved_at")
        read_only_fields = fields
