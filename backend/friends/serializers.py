from rest_framework import serializers

from .models import Friendship


class FriendRequestSerializer(serializers.ModelSerializer):
    from_user = serializers.CharField(source="from_user.username", read_only=True)
    to_user = serializers.CharField(source="to_user.username", read_only=True)

    class Meta:
        model = Friendship
        fields = ("id", "from_user", "to_user", "status", "created_at", "accepted_at")
        read_only_fields = fields


class SendFriendRequestSerializer(serializers.Serializer):
    username = serializers.CharField(max_length=150)
