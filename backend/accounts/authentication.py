from datetime import timedelta

from django.conf import settings
from django.utils import timezone
from rest_framework.authentication import TokenAuthentication
from rest_framework.authtoken.models import Token
from rest_framework.exceptions import AuthenticationFailed


def token_expired(token: Token) -> bool:
    return token.created < timezone.now() - timedelta(days=settings.TOKEN_TTL_DAYS)


def issue_token(user) -> Token:
    """Devuelve el token vigente del usuario o crea uno nuevo si caducó."""
    token, created = Token.objects.get_or_create(user=user)
    if not created and token_expired(token):
        token.delete()
        token = Token.objects.create(user=user)
    return token


class ExpiringTokenAuthentication(TokenAuthentication):
    """Igual que TokenAuthentication, pero el token caduca tras TOKEN_TTL_DAYS días."""

    def authenticate_credentials(self, key):
        user, token = super().authenticate_credentials(key)
        if token_expired(token):
            token.delete()
            raise AuthenticationFailed("Tu sesión expiró. Inicia sesión de nuevo.")
        return user, token
