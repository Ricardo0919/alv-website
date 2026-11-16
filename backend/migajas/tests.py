from io import StringIO

from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from accounts.models import DEFAULT_GOAL as GOAL

from .models import Interaction

User = get_user_model()


class InteractionTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user("ana", password="x-Segura-123")
        self.other = User.objects.create_user("beto", password="x-Segura-123")
        self.client.force_authenticate(self.user)

    def post(self, payload):
        return self.client.post(reverse("interaction-list"), payload, format="json")

    def total(self):
        return self.client.get(reverse("stats")).data["total_crumbs"]

    def test_requires_authentication(self):
        self.client.force_authenticate(None)
        self.assertEqual(self.client.get(reverse("stats")).status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertEqual(
            self.post({"type": "CALL", "count_or_duration": 10}).status_code, status.HTTP_401_UNAUTHORIZED
        )

    def test_conversation_batch_quantity(self):
        response = self.post({"type": "CONVERSATION", "count_or_duration": 5, "batch_quantity": 30})
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        interaction = Interaction.objects.get()
        self.assertEqual(interaction.crumbs, 30)
        self.assertEqual(interaction.user, self.user)

    def test_deep_calls_multiply_by_five(self):
        self.post({"type": "CALL", "count_or_duration": 10, "batch_quantity": 500})
        self.assertEqual(self.total(), 2500)

    def test_removal_respects_zero_floor(self):
        self.post({"type": "REMOVAL", "count_or_duration": 12})
        self.assertEqual(Interaction.objects.get().crumbs, 0)
        self.assertEqual(self.total(), 0)

    def test_total_never_exceeds_goal(self):
        self.post({"type": "CALL", "count_or_duration": 10, "batch_quantity": GOAL})
        self.assertEqual(self.total(), GOAL)
        self.post({"type": "REMOVAL", "count_or_duration": 1000})
        self.assertEqual(self.total(), GOAL - 1000)

    def test_batch_endpoint_is_applied_in_order(self):
        response = self.client.post(
            reverse("interaction-batch"),
            {
                "items": [
                    {"type": "CONVERSATION", "count_or_duration": 5, "batch_quantity": 3},
                    {"type": "CALL", "count_or_duration": 1, "batch_quantity": 2},
                    {"type": "CALL", "count_or_duration": 10, "batch_quantity": 4},
                    {"type": "REMOVAL", "count_or_duration": 7},
                ]
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["total_crumbs"], 3 + 2 + 20 - 7)
        self.assertEqual(self.total(), 18)

    def test_users_data_is_isolated(self):
        self.post({"type": "CALL", "count_or_duration": 10, "batch_quantity": 10})  # ana: 50
        Interaction.objects.create(user=self.other, type="CALL", count_or_duration=10)  # beto: 5

        self.assertEqual(self.total(), 50)
        listed = self.client.get(reverse("interaction-list")).data["results"]
        self.assertEqual(len(listed), 1)

        beto_item = Interaction.objects.get(user=self.other)
        detail = self.client.get(reverse("interaction-detail", args=[beto_item.pk]))
        self.assertEqual(detail.status_code, status.HTTP_404_NOT_FOUND)

        self.client.force_authenticate(self.other)
        self.assertEqual(self.total(), 5)

    def test_cannot_delete_or_edit_history(self):
        self.post({"type": "CALL", "count_or_duration": 10})
        url = reverse("interaction-detail", args=[Interaction.objects.get().pk])
        self.assertEqual(self.client.delete(url).status_code, status.HTTP_405_METHOD_NOT_ALLOWED)
        self.assertEqual(
            self.client.put(url, {"type": "CALL", "count_or_duration": 1}, format="json").status_code,
            status.HTTP_405_METHOD_NOT_ALLOWED,
        )

    def test_rejects_negative_values(self):
        response = self.post({"type": "REMOVAL", "count_or_duration": -50})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_assign_legacy_interactions_command(self):
        Interaction.objects.create(type="CALL", count_or_duration=10)  # sin dueño
        call_command("asignar_migajas", "ANA", stdout=StringIO())
        self.assertEqual(self.total(), 5)


class PublicProfileTests(APITestCase):
    def setUp(self):
        self.owner = User.objects.create_user("Serrucho", password="x-Segura-123")
        self.visitor = User.objects.create_user("visitante", password="x-Segura-123")
        Interaction.objects.create(user=self.owner, type="CALL", count_or_duration=10)  # 5 migajas
        self.url = reverse("public-profile", args=["serrucho"])

    def test_anyone_can_view_profile_without_login(self):
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["username"], "Serrucho")
        self.assertEqual(response.data["total_crumbs"], 5)
        self.assertNotIn("email", response.data)

    def test_invalid_token_does_not_block_public_view(self):
        self.client.credentials(HTTP_AUTHORIZATION="Token invalido")
        self.assertEqual(self.client.get(self.url).status_code, status.HTTP_200_OK)

    def test_unknown_user_returns_404(self):
        response = self.client.get(reverse("public-profile", args=["nadie"]))
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_public_profile_is_read_only(self):
        self.client.force_authenticate(self.visitor)
        for method in ("post", "put", "patch", "delete"):
            response = getattr(self.client, method)(self.url, {"crumbs": 100}, format="json")
            self.assertEqual(response.status_code, status.HTTP_405_METHOD_NOT_ALLOWED, method)
        self.assertEqual(self.client.get(self.url).data["total_crumbs"], 5)

    def test_visitor_logging_crumbs_only_affects_own_account(self):
        self.client.force_authenticate(self.visitor)
        self.client.post(
            reverse("interaction-list"),
            {"type": "CALL", "count_or_duration": 10, "batch_quantity": 100, "user": self.owner.pk},
            format="json",
        )
        self.assertEqual(self.client.get(self.url).data["total_crumbs"], 5)
        self.assertEqual(self.client.get(reverse("stats")).data["total_crumbs"], 500)


class CrumbRequestTests(APITestCase):
    def setUp(self):
        from django.core.cache import cache

        cache.clear()
        self.owner = User.objects.create_user("serrucho", password="x-Segura-123")
        self.friend = User.objects.create_user("amiga", password="x-Segura-123")
        self.stranger = User.objects.create_user("extrano", password="x-Segura-123")
        self.send_url = reverse("send-crumb-request", args=["Serrucho"])
        self.gift = {"crumbs": 13, "reason": "Por la llamada de ayer"}

    def send(self, payload=None, as_user=None):
        self.client.force_authenticate(as_user or self.friend)
        return self.client.post(self.send_url, payload or self.gift, format="json")

    def owner_total(self):
        return self.client.get(reverse("public-profile", args=["serrucho"])).data["total_crumbs"]

    def test_send_request_does_not_add_crumbs_until_accepted(self):
        response = self.send()
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["crumbs"], 13)
        self.assertEqual(response.data["sender"], "amiga")
        self.assertEqual(response.data["status"], "PENDING")
        self.assertEqual(self.owner_total(), 0)

    def test_requires_login_and_reason(self):
        self.client.force_authenticate(None)
        self.assertEqual(self.client.post(self.send_url, self.gift, format="json").status_code, 401)
        response = self.send({**self.gift, "reason": ""})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("reason", response.data)

    def test_rejects_invalid_amounts_and_self_gifts(self):
        for crumbs in (0, -50, 10_000_001):
            response = self.send({"crumbs": crumbs, "reason": "jaja"})
            self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST, crumbs)
            self.assertIn("crumbs", response.data)
        self.assertEqual(self.send(as_user=self.owner).status_code, status.HTTP_400_BAD_REQUEST)

    def test_cannot_log_gift_type_directly(self):
        self.client.force_authenticate(self.owner)
        response = self.client.post(
            reverse("interaction-list"), {"type": "GIFT", "count_or_duration": 500}, format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(self.owner_total(), 0)

    def test_owner_sees_and_accepts_request(self):
        request_id = self.send().data["id"]
        self.client.force_authenticate(self.owner)

        self.assertEqual(self.client.get(reverse("crumb-request-pending-count")).data["pending"], 1)
        inbox = self.client.get(reverse("crumb-request-list"), {"status": "PENDING"}).data["results"]
        self.assertEqual(inbox[0]["reason"], "Por la llamada de ayer")

        response = self.client.post(reverse("crumb-request-accept", args=[request_id]))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["total_crumbs"], 13)
        self.assertEqual(self.owner_total(), 13)
        gift = Interaction.objects.get(user=self.owner)
        self.assertEqual((gift.type, gift.crumbs), ("GIFT", 13))
        self.assertEqual(self.client.get(reverse("crumb-request-pending-count")).data["pending"], 0)

        # Aceptar dos veces no suma doble
        again = self.client.post(reverse("crumb-request-accept", args=[request_id]))
        self.assertEqual(again.status_code, status.HTTP_404_NOT_FOUND)
        self.assertEqual(self.owner_total(), 13)

    def test_owner_rejects_request(self):
        request_id = self.send().data["id"]
        self.client.force_authenticate(self.owner)
        response = self.client.post(reverse("crumb-request-reject", args=[request_id]))
        self.assertEqual(response.data["request"]["status"], "REJECTED")
        self.assertEqual(self.owner_total(), 0)

    def test_only_recipient_can_see_or_resolve(self):
        request_id = self.send().data["id"]
        for user in (self.friend, self.stranger):
            self.client.force_authenticate(user)
            self.assertEqual(self.client.get(reverse("crumb-request-list")).data["results"], [])
            self.assertEqual(
                self.client.post(reverse("crumb-request-accept", args=[request_id])).status_code,
                status.HTTP_404_NOT_FOUND,
            )
        self.assertEqual(self.owner_total(), 0)

    def test_limits_pending_requests_per_sender(self):
        from .services import MAX_PENDING_PER_SENDER

        for _ in range(MAX_PENDING_PER_SENDER):
            self.assertEqual(self.send().status_code, status.HTTP_201_CREATED)
        self.assertEqual(self.send().status_code, status.HTTP_400_BAD_REQUEST)


class GoalTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user("ana", password="x-Segura-123")
        self.client.force_authenticate(self.user)

    def set_goal(self, goal):
        return self.client.patch(reverse("me"), {"goal": goal}, format="json")

    def stats(self):
        return self.client.get(reverse("stats")).data

    def test_default_goal_is_80000(self):
        self.assertEqual(self.stats()["goal"], GOAL)
        self.assertEqual(self.client.get(reverse("me")).data["goal"], GOAL)

    def test_user_can_change_goal_and_it_applies_everywhere(self):
        response = self.set_goal(1000)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["goal"], 1000)

        self.client.post(
            reverse("interaction-list"), {"type": "CALL", "count_or_duration": 10, "batch_quantity": 500}, format="json"
        )
        stats = self.stats()
        self.assertEqual((stats["total_crumbs"], stats["goal"], stats["percent"]), (1000, 1000, 100.0))
        self.assertEqual(self.client.get(reverse("public-profile", args=["ana"])).data["goal"], 1000)

    def test_goal_can_go_above_80000(self):
        self.set_goal(1_000_000)
        self.client.post(
            reverse("interaction-list"), {"type": "CALL", "count_or_duration": 10, "batch_quantity": 100_000}, format="json"
        )
        self.assertEqual(self.stats()["total_crumbs"], 500_000)

    def test_goal_validation(self):
        for bad in (0, -5, 10_000_001):
            self.assertEqual(self.set_goal(bad).status_code, status.HTTP_400_BAD_REQUEST, bad)

    def test_cannot_lower_goal_below_current_total(self):
        self.client.post(
            reverse("interaction-list"), {"type": "CALL", "count_or_duration": 10, "batch_quantity": 100}, format="json"
        )  # 500
        response = self.set_goal(400)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("goal", response.data)
        self.assertEqual(self.set_goal(500).status_code, status.HTTP_200_OK)
        self.assertEqual(self.stats()["total_crumbs"], 500)

    def test_goal_requires_login(self):
        self.client.force_authenticate(None)
        self.assertEqual(self.set_goal(100).status_code, status.HTTP_401_UNAUTHORIZED)


class GiftLimitTests(APITestCase):
    def setUp(self):
        from accounts.models import set_goal

        self.owner = User.objects.create_user("serrucho", password="x-Segura-123")
        self.friend = User.objects.create_user("amiga", password="x-Segura-123")
        set_goal(self.owner, 500)
        self.client.force_authenticate(self.friend)
        self.url = reverse("send-crumb-request", args=["serrucho"])

    def test_cannot_gift_more_than_recipient_goal(self):
        response = self.client.post(self.url, {"crumbs": 501, "reason": "mucho"}, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("crumbs", response.data)
        ok = self.client.post(self.url, {"crumbs": 500, "reason": "justo"}, format="json")
        self.assertEqual(ok.status_code, status.HTTP_201_CREATED)


class HistoryTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user("ana", password="x-Segura-123")
        self.friend = User.objects.create_user("beto", password="x-Segura-123")
        self.client.force_authenticate(self.user)

    def batch(self, items):
        return self.client.post(reverse("interaction-batch"), {"items": items}, format="json")

    def test_add_and_remove_with_reason_show_in_history(self):
        self.batch([{"type": "ADD", "count_or_duration": 1250, "reason": "  Llamada larga  "}])
        self.batch([{"type": "REMOVAL", "count_or_duration": 50}])

        history = self.client.get(reverse("interaction-list")).data["results"]
        self.assertEqual([(h["type"], h["crumbs"], h["reason"]) for h in history], [
            ("REMOVAL", -50, ""),
            ("ADD", 1250, "Llamada larga"),
        ])
        self.assertEqual(self.client.get(reverse("stats")).data["total_crumbs"], 1200)

    def test_reason_max_length(self):
        response = self.batch([{"type": "ADD", "count_or_duration": 1, "reason": "x" * 281}])
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_accepted_gift_keeps_reason_and_sender_in_history(self):
        self.client.force_authenticate(self.friend)
        request_id = self.client.post(
            reverse("send-crumb-request", args=["ana"]), {"crumbs": 30, "reason": "Por el pan"}, format="json"
        ).data["id"]
        self.client.force_authenticate(self.user)
        self.client.post(reverse("crumb-request-accept", args=[request_id]))

        [entry] = self.client.get(reverse("interaction-list")).data["results"]
        self.assertEqual((entry["type"], entry["crumbs"], entry["reason"], entry["gift_from"]), ("GIFT", 30, "Por el pan", "beto"))

    def test_history_is_private(self):
        self.batch([{"type": "ADD", "count_or_duration": 10, "reason": "secreto"}])
        self.client.force_authenticate(self.friend)
        self.assertEqual(self.client.get(reverse("interaction-list")).data["results"], [])


class GoalReachedTests(APITestCase):
    def setUp(self):
        from accounts.models import set_goal

        self.user = User.objects.create_user("ana", password="x-Segura-123")
        self.friend = User.objects.create_user("beto", password="x-Segura-123")
        set_goal(self.user, 100)
        self.client.force_authenticate(self.user)

    def batch(self, items):
        return self.client.post(reverse("interaction-batch"), {"items": items}, format="json")

    def test_cannot_add_when_goal_reached_but_can_remove(self):
        self.batch([{"type": "ADD", "count_or_duration": 100}])
        response = self.batch([{"type": "ADD", "count_or_duration": 1}])
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data["code"], "goal_reached")
        self.assertIn("migajero", response.data["detail"])

        self.assertEqual(self.batch([{"type": "REMOVAL", "count_or_duration": 10}]).status_code, 201)
        self.assertEqual(self.batch([{"type": "ADD", "count_or_duration": 10}]).status_code, 201)
        self.assertEqual(self.client.get(reverse("stats")).data["total_crumbs"], 100)

    def test_gift_limited_to_what_recipient_is_missing(self):
        self.batch([{"type": "ADD", "count_or_duration": 70}])  # le faltan 30
        self.client.force_authenticate(self.friend)
        url = reverse("send-crumb-request", args=["ana"])

        too_much = self.client.post(url, {"crumbs": 31, "reason": "mucho"}, format="json")
        self.assertEqual(too_much.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("solo le faltan 30", too_much.data["crumbs"][0])
        self.assertEqual(self.client.post(url, {"crumbs": 30, "reason": "justo"}, format="json").status_code, 201)

    def test_cannot_gift_to_someone_who_reached_goal(self):
        self.batch([{"type": "ADD", "count_or_duration": 100}])
        self.client.force_authenticate(self.friend)
        response = self.client.post(
            reverse("send-crumb-request", args=["ana"]), {"crumbs": 5, "reason": "toma"}, format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("ya llenó su bolillo", response.data["crumbs"][0])

    def test_accepting_gift_after_reaching_goal_is_blocked(self):
        self.client.force_authenticate(self.friend)
        request_id = self.client.post(
            reverse("send-crumb-request", args=["ana"]), {"crumbs": 50, "reason": "para ti"}, format="json"
        ).data["id"]
        self.client.force_authenticate(self.user)
        self.batch([{"type": "ADD", "count_or_duration": 100}])  # llega a la meta antes de aceptar

        response = self.client.post(reverse("crumb-request-accept", args=[request_id]))
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data["code"], "goal_reached")
        # Sigue pendiente: todavía la puede rechazar
        self.assertEqual(self.client.post(reverse("crumb-request-reject", args=[request_id])).status_code, 200)
