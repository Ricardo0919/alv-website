from rest_framework import serializers
from .models import Interaction

class InteractionSerializer(serializers.ModelSerializer):
    batch_quantity = serializers.IntegerField(write_only=True, required=False, min_value=1, default=1)

    class Meta:
        model = Interaction
        fields = '__all__'
        read_only_fields = ('crumbs', 'created_at')

    def create(self, validated_data):
        validated_data.pop('batch_quantity', 1)
        return super().create(validated_data)

    def update(self, instance, validated_data):
        validated_data.pop('batch_quantity', 1)
        return super().update(instance, validated_data)
