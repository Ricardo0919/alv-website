from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

User = get_user_model()
PASSWORD = "Bolillo-Seguro-2026"


class AuthTests(APITestCase):
    def setUp(self):
        cache.clear()  # reinicia el límite de intentos entre pruebas

    def register(self, username="serrucho", password=PASSWORD, **extra):
        return self.client.post(
            reverse("register"), {"username": username, "password": password, **extra}, format="json"
        )

    def test_register_returns_token_and_hashes_password(self):
        response = self.register(email="s@example.com")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertIn("token", response.data)
        self.assertEqual(response.data["user"]["username"], "serrucho")
        self.assertNotIn("password", response.data["user"])

        user = User.objects.get(username="serrucho")
        self.assertNotEqual(user.password, PASSWORD)
        self.assertTrue(user.password.startswith("pbkdf2_sha256$"))
        self.assertTrue(user.check_password(PASSWORD))

    def test_register_rejects_weak_password(self):
        response = self.register(password="12345678")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("password", response.data)
        self.assertFalse(User.objects.exists())

    def test_register_rejects_duplicate_username_case_insensitive(self):
        self.register("Serrucho")
        response = self.register("serrucho")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(User.objects.count(), 1)

    def test_login_with_correct_and_wrong_password(self):
        self.register()
        ok = self.client.post(reverse("login"), {"username": "SERRUCHO", "password": PASSWORD}, format="json")
        self.assertEqual(ok.status_code, status.HTTP_200_OK)
        self.assertIn("token", ok.data)

        bad = self.client.post(reverse("login"), {"username": "serrucho", "password": "otra"}, format="json")
        self.assertEqual(bad.status_code, status.HTTP_400_BAD_REQUEST)

    def test_me_requires_token_and_logout_revokes_it(self):
        token = self.register().data["token"]
        self.assertEqual(self.client.get(reverse("me")).status_code, status.HTTP_401_UNAUTHORIZED)

        self.client.credentials(HTTP_AUTHORIZATION=f"Token {token}")
        self.assertEqual(self.client.get(reverse("me")).data["username"], "serrucho")

        self.assertEqual(self.client.post(reverse("logout")).status_code, status.HTTP_204_NO_CONTENT)
        self.assertEqual(self.client.get(reverse("me")).status_code, status.HTTP_401_UNAUTHORIZED)

    def test_login_is_rate_limited(self):
        for _ in range(10):
            self.client.post(reverse("login"), {"username": "x", "password": "y"}, format="json")
        response = self.client.post(reverse("login"), {"username": "x", "password": "y"}, format="json")
        self.assertEqual(response.status_code, status.HTTP_429_TOO_MANY_REQUESTS)


class TokenExpiryTests(APITestCase):
    def setUp(self):
        cache.clear()

    def test_expired_token_is_rejected_and_login_issues_a_new_one(self):
        from datetime import timedelta

        from django.utils import timezone
        from rest_framework.authtoken.models import Token

        old_key = self.client.post(
            reverse("register"), {"username": "viejo", "password": PASSWORD}, format="json"
        ).data["token"]
        Token.objects.filter(key=old_key).update(created=timezone.now() - timedelta(days=31))

        self.client.credentials(HTTP_AUTHORIZATION=f"Token {old_key}")
        response = self.client.get(reverse("me"))
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

        self.client.credentials()
        new_key = self.client.post(reverse("login"), {"username": "viejo", "password": PASSWORD}, format="json").data["token"]
        self.assertNotEqual(new_key, old_key)
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {new_key}")
        self.assertEqual(self.client.get(reverse("me")).status_code, status.HTTP_200_OK)

    def test_username_must_start_with_letter_or_number(self):
        for bad in ("...", "_abc", ".hola", "-x1"):
            response = self.client.post(reverse("register"), {"username": bad, "password": PASSWORD}, format="json")
            self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST, bad)

    def test_rejects_non_json_and_oversized_bodies(self):
        response = self.client.post(reverse("login"), "username=a&password=b", content_type="application/x-www-form-urlencoded")
        self.assertEqual(response.status_code, status.HTTP_415_UNSUPPORTED_MEDIA_TYPE)
        big = {"username": "a", "password": "x" * (300 * 1024)}
        response = self.client.post(reverse("login"), big, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
