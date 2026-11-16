from django.contrib.auth import authenticate, get_user_model
from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers

from .models import MAX_GOAL, get_goal

User = get_user_model()


class UserSerializer(serializers.ModelSerializer):
    goal = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ("id", "username", "email", "date_joined", "goal")
        read_only_fields = fields

    def get_goal(self, user) -> int:
        return get_goal(user)


class SettingsSerializer(serializers.Serializer):
    goal = serializers.IntegerField(
        min_value=1,
        max_value=MAX_GOAL,
        error_messages={"min_value": "La meta debe ser al menos 1.", "max_value": f"La meta máxima es {MAX_GOAL:,}."},
    )

    def validate_goal(self, value):
        # Bajar la meta por debajo de lo acumulado recortaría migajas ya ganadas
        from migajas.services import raw_total

        current = raw_total(self.context["user"])
        if value < current:
            raise serializers.ValidationError(f"Ya llevas {current:,} migajas; la meta debe ser al menos esa cantidad.")
        return value


class RegisterSerializer(serializers.Serializer):
    # Empieza con letra o número (evita nombres raros como "..." en las URLs /u/<usuario>)
    username = serializers.RegexField(
        r"^[^\W_][\w.@+-]{2,29}$",
        error_messages={
            "invalid": "El usuario debe tener de 3 a 30 caracteres, empezar con letra o número y usar solo letras, números y . @ + - _",
        },
    )
    email = serializers.EmailField(required=False, allow_blank=True)
    password = serializers.CharField(write_only=True, trim_whitespace=False, max_length=128)

    def validate_username(self, value):
        if User.objects.filter(username__iexact=value).exists():
            raise serializers.ValidationError("Ese nombre de usuario ya existe.")
        return value

    def validate(self, attrs):
        # Aplica los AUTH_PASSWORD_VALIDATORS (longitud, contraseñas comunes, etc.)
        candidate = User(username=attrs["username"], email=attrs.get("email", ""))
        try:
            validate_password(attrs["password"], user=candidate)
        except Exception as exc:  # django.core.exceptions.ValidationError
            raise serializers.ValidationError({"password": list(getattr(exc, "messages", [str(exc)]))})
        return attrs

    def create(self, validated_data):
        # create_user guarda la contraseña con hash (nunca en texto plano)
        return User.objects.create_user(
            username=validated_data["username"],
            email=validated_data.get("email", ""),
            password=validated_data["password"],
        )


class LoginSerializer(serializers.Serializer):
    username = serializers.CharField()
    password = serializers.CharField(write_only=True, trim_whitespace=False)

    def validate(self, attrs):
        # Permite iniciar sesión sin importar mayúsculas en el usuario
        match = User.objects.filter(username__iexact=attrs["username"]).only("username").first()
        username = match.username if match else attrs["username"]
        user = authenticate(self.context.get("request"), username=username, password=attrs["password"])
        if user is None:
            raise serializers.ValidationError("Usuario o contraseña incorrectos.")
        attrs["user"] = user
        return attrs
