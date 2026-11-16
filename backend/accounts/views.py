from django.contrib.auth.models import update_last_login
from rest_framework import permissions, status
from rest_framework.authtoken.models import Token

from .authentication import issue_token
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from .models import set_goal
from .serializers import LoginSerializer, RegisterSerializer, SettingsSerializer, UserSerializer


def _auth_response(user, http_status=status.HTTP_200_OK):
    token = issue_token(user)
    return Response({"token": token.key, "user": UserSerializer(user).data}, status=http_status)


class RegisterView(APIView):
    permission_classes = [permissions.AllowAny]
    authentication_classes = []
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "auth"

    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        return _auth_response(user, status.HTTP_201_CREATED)


class LoginView(APIView):
    permission_classes = [permissions.AllowAny]
    authentication_classes = []
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "auth"

    def post(self, request):
        serializer = LoginSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        user = serializer.validated_data["user"]
        update_last_login(None, user)
        return _auth_response(user)


class LogoutView(APIView):
    def post(self, request):
        # Invalida el token: cualquier sesión abierta con él deja de funcionar
        Token.objects.filter(user=request.user).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class MeView(APIView):
    """GET: datos del usuario. PATCH {"goal": n}: cambiar la meta."""

    def get(self, request):
        return Response(UserSerializer(request.user).data)

    def patch(self, request):
        serializer = SettingsSerializer(data=request.data, context={"user": request.user})
        serializer.is_valid(raise_exception=True)
        set_goal(request.user, serializer.validated_data["goal"])
        return Response(UserSerializer(request.user).data)
