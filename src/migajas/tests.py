from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from .models import Interaction


class InteractionBatchCreateTests(APITestCase):
    def test_conversation_batch_quantity_creates_aggregated_crumbs(self):
        response = self.client.post(
            reverse('interaction-list'),
            {
                'type': 'CONVERSATION',
                'count_or_duration': 5,
                'batch_quantity': 30,
            },
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        interaction = Interaction.objects.get()
        self.assertEqual(interaction.crumbs, 30)
        self.assertEqual(interaction.count_or_duration, 5)

    def test_deep_calls_batch_quantity_multiplies_by_five(self):
        response = self.client.post(
            reverse('interaction-list'),
            {
                'type': 'CALL',
                'count_or_duration': 10,
                'batch_quantity': 500,
            },
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        interaction = Interaction.objects.get()
        self.assertEqual(interaction.crumbs, 2500)

    def test_removal_request_respects_zero_floor(self):
        response = self.client.post(
            reverse('interaction-list'),
            {
                'type': 'REMOVAL',
                'count_or_duration': 12,
            },
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        interaction = Interaction.objects.get()
        self.assertEqual(interaction.crumbs, 0)
