from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from accounts.models import set_goal
from migajas.services import record_interactions

from .models import Friendship

User = get_user_model()


def give(user, crumbs):
    record_interactions(user, [{"type": "CALL", "count_or_duration": 10, "batch_quantity": crumbs // 5}])


class FriendshipTests(APITestCase):
    def setUp(self):
        cache.clear()
        self.ana = User.objects.create_user("ana", password="x-Segura-123")
        self.beto = User.objects.create_user("beto", password="x-Segura-123")
        self.caro = User.objects.create_user("caro", password="x-Segura-123")

    def as_user(self, user):
        self.client.force_authenticate(user)

    def send(self, frm, to_username):
        self.as_user(frm)
        return self.client.post(reverse("friend-requests"), {"username": to_username}, format="json")

    def status_between(self, me, other):
        self.as_user(me)
        return self.client.get(reverse("friend-status", args=[other.username])).data["status"]

    def leaderboard_names(self, user):
        self.as_user(user)
        return [e["username"] for e in self.client.get(reverse("friends-leaderboard")).data]

    def test_request_must_be_accepted_to_be_friends(self):
        request_id = self.send(self.ana, "BETO").data["id"]
        self.assertEqual(self.status_between(self.ana, self.beto), "pending_sent")
        self.assertEqual(self.status_between(self.beto, self.ana), "pending_received")
        self.assertEqual(self.leaderboard_names(self.ana), ["ana"])  # aún no son amigos

        self.as_user(self.beto)
        self.assertEqual(self.client.get(reverse("crumb-request-pending-count")).data["friend_requests"], 1)
        response = self.client.post(reverse("friend-request-action", args=[request_id, "accept"]))
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        # Mutuo: ambos se ven
        self.assertEqual(self.status_between(self.ana, self.beto), "friends")
        self.assertEqual(sorted(self.leaderboard_names(self.ana)), ["ana", "beto"])
        self.assertEqual(sorted(self.leaderboard_names(self.beto)), ["ana", "beto"])

    def test_crossed_requests_become_friends_automatically(self):
        self.send(self.ana, "beto")
        response = self.send(self.beto, "ana")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["status"], "ACCEPTED")
        self.assertEqual(Friendship.objects.count(), 1)

    def test_invalid_requests(self):
        self.assertEqual(self.send(self.ana, "ana").status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(self.send(self.ana, "nadie").status_code, status.HTTP_404_NOT_FOUND)
        self.send(self.ana, "beto")
        self.assertEqual(self.send(self.ana, "beto").status_code, status.HTTP_400_BAD_REQUEST)

    def test_only_recipient_can_accept_and_sender_can_cancel(self):
        request_id = self.send(self.ana, "beto").data["id"]
        for user in (self.ana, self.caro):
            self.as_user(user)
            response = self.client.post(reverse("friend-request-action", args=[request_id, "accept"]))
            self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

        self.as_user(self.ana)
        self.assertEqual(
            self.client.delete(reverse("friend-request-detail", args=[request_id])).status_code,
            status.HTTP_204_NO_CONTENT,
        )
        self.assertFalse(Friendship.objects.exists())

    def test_reject_and_unfriend(self):
        request_id = self.send(self.ana, "beto").data["id"]
        self.as_user(self.beto)
        self.client.post(reverse("friend-request-action", args=[request_id, "reject"]))
        self.assertEqual(self.status_between(self.ana, self.beto), "none")

        request_id = self.send(self.ana, "beto").data["id"]  # se puede volver a intentar
        self.as_user(self.beto)
        self.client.post(reverse("friend-request-action", args=[request_id, "accept"]))
        self.assertEqual(
            self.client.delete(reverse("friend-detail", args=["ana"])).status_code, status.HTTP_204_NO_CONTENT
        )
        self.assertEqual(self.leaderboard_names(self.ana), ["ana"])

    def test_leaderboard_ranks_by_who_reached_goal_first_then_percent(self):
        for other in (self.beto, self.caro):
            request_id = self.send(self.ana, other.username).data["id"]
            self.as_user(other)
            self.client.post(reverse("friend-request-action", args=[request_id, "accept"]))

        set_goal(self.ana, 100)
        set_goal(self.beto, 50)
        set_goal(self.caro, 1000)
        give(self.beto, 50)  # beto llega primero a su meta (100 %)
        give(self.ana, 100)  # ana llega después (100 %)
        give(self.caro, 900)  # caro lleva más migajas pero solo 90 %

        self.as_user(self.ana)
        board = self.client.get(reverse("friends-leaderboard")).data
        self.assertEqual([e["username"] for e in board], ["beto", "ana", "caro"])
        self.assertEqual([e["rank"] for e in board], [1, 2, 3])
        self.assertIsNotNone(board[0]["goal_reached_at"])
        self.assertIsNone(board[2]["goal_reached_at"])
        self.assertTrue(board[1]["is_me"])

    def test_requires_login(self):
        self.client.force_authenticate(None)
        self.assertEqual(self.client.get(reverse("friends-leaderboard")).status_code, status.HTTP_401_UNAUTHORIZED)
