"""
Configuración de Django para el backend de alv-website.

Todas las variables de entorno están documentadas en backend/.env.example
(desarrollo) y en .env.example de la raíz (Docker / producción).
"""

import os
import secrets
from pathlib import Path

import dj_database_url
from django.core.exceptions import ImproperlyConfigured
from dotenv import load_dotenv

# BASE_DIR = carpeta backend/
BASE_DIR = Path(__file__).resolve().parent.parent

# Carga backend/.env si existe (en Docker/producción se usan variables del contenedor)
load_dotenv(BASE_DIR / ".env")


def env_bool(name: str, default: str = "False") -> bool:
    return os.environ.get(name, default).lower() in ("true", "1", "yes")


def env_list(name: str, default: str = "") -> list[str]:
    return [item.strip() for item in os.environ.get(name, default).split(",") if item.strip()]


def env_int(name: str, default: int) -> int:
    return int(os.environ.get(name, default))


DEBUG = env_bool("DEBUG")

# En producción la llave es obligatoria: sin ella cada proceso tendría una distinta
# y cualquier dato firmado (sesiones del admin, tokens de reset) dejaría de ser válido.
SECRET_KEY = os.environ.get("DJANGO_SECRET_KEY")
if not SECRET_KEY:
    if not DEBUG:
        raise ImproperlyConfigured("Define DJANGO_SECRET_KEY (ver .env.example).")
    SECRET_KEY = secrets.token_urlsafe(50)

ALLOWED_HOSTS = env_list("ALLOWED_HOSTS", "localhost,127.0.0.1")


# --- Aplicaciones ---

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "rest_framework",
    "rest_framework.authtoken",
    "corsheaders",
    "accounts",
    "migajas",
    "friends",
]

MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

if not DEBUG:
    # Sirve los estáticos del admin en producción sin Nginx
    MIDDLEWARE.insert(2, "whitenoise.middleware.WhiteNoiseMiddleware")

ROOT_URLCONF = "config.urls"

# Ruta del panel de administración. En producción usa una difícil de adivinar
# (p. ej. "panel-7f3k9/") para que los bots no lo encuentren.
ADMIN_URL = os.environ.get("ADMIN_URL", "admin/").strip("/") + "/"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "config.wsgi.application"


# --- Base de datos ---
# Producción/Docker: DATABASE_URL (PostgreSQL). Local: SQLite en backend/db.sqlite3.

DATABASE_URL = os.environ.get("DATABASE_URL")

if DATABASE_URL:
    DATABASES = {
        "default": dj_database_url.parse(
            DATABASE_URL,
            conn_max_age=60,
            conn_health_checks=True,
            ssl_require=env_bool("DATABASE_SSL", "True"),
        )
    }
    if DATABASES["default"]["ENGINE"] == "django.db.backends.postgresql":
        DATABASES["default"].setdefault("OPTIONS", {}).update(
            {
                "connect_timeout": 5,
                # Ninguna consulta puede tardar más de 10 s (evita que una consulta pesada tumbe el servidor)
                "options": f"-c statement_timeout={env_int('DATABASE_STATEMENT_TIMEOUT_MS', 10_000)}",
            }
        )
else:
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.sqlite3",
            "NAME": BASE_DIR / "db.sqlite3",
        }
    }


# --- Caché (contadores del límite de peticiones) ---
# Con varios procesos de gunicorn el contador debe ser compartido (Redis);
# en memoria cada proceso contaría por separado y el límite no se aplicaría.

REDIS_URL = os.environ.get("REDIS_URL")
if REDIS_URL:
    CACHES = {
        "default": {
            "BACKEND": "django.core.cache.backends.redis.RedisCache",
            "LOCATION": REDIS_URL,
            "OPTIONS": {"socket_connect_timeout": 2, "socket_timeout": 2},
        }
    }
else:
    CACHES = {"default": {"BACKEND": "django.core.cache.backends.locmem.LocMemCache"}}


# --- Contraseñas ---
# Django nunca guarda contraseñas en texto plano: usa PBKDF2-SHA256 con sal
# aleatoria por usuario. Los validadores aplican reglas mínimas de seguridad.

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator", "OPTIONS": {"min_length": 8}},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

# Días que dura una sesión (token) antes de tener que iniciar sesión otra vez
TOKEN_TTL_DAYS = env_int("TOKEN_TTL_DAYS", 30)


# --- Django REST Framework ---

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "accounts.authentication.ExpiringTokenAuthentication",
    ],
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.IsAuthenticated",
    ],
    "DEFAULT_RENDERER_CLASSES": [
        "rest_framework.renderers.JSONRenderer",
    ],
    "DEFAULT_PARSER_CLASSES": [
        "rest_framework.parsers.JSONParser",
    ],
    "DEFAULT_PAGINATION_CLASS": "rest_framework.pagination.PageNumberPagination",
    "PAGE_SIZE": 50,
    # Límite general de peticiones (anti abuso / DoS) + límites específicos por endpoint
    "DEFAULT_THROTTLE_CLASSES": [
        "rest_framework.throttling.AnonRateThrottle",
        "rest_framework.throttling.UserRateThrottle",
    ],
    "DEFAULT_THROTTLE_RATES": {
        "anon": os.environ.get("THROTTLE_ANON", "120/min"),
        "user": os.environ.get("THROTTLE_USER", "600/min"),
        "auth": os.environ.get("THROTTLE_AUTH", "10/min"),
        "public": "60/min",
        "crumb_requests": "30/hour",
        "friend_requests": "30/hour",
    },
    # Detrás de Nginx: toma la IP real del cliente de X-Forwarded-For.
    # Sin esto, todos los usuarios compartirían el límite de la IP del proxy.
    "NUM_PROXIES": env_int("NUM_PROXIES", 0) or None,
}

if DEBUG:
    REST_FRAMEWORK["DEFAULT_RENDERER_CLASSES"].append("rest_framework.renderers.BrowsableAPIRenderer")

# La API solo recibe JSON pequeño: rechaza cuerpos grandes antes de procesarlos
DATA_UPLOAD_MAX_MEMORY_SIZE = 256 * 1024  # 256 KB


# --- Internacionalización ---

LANGUAGE_CODE = "es-mx"
TIME_ZONE = "America/Mexico_City"
USE_I18N = True
USE_TZ = True


# --- Archivos estáticos ---

STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
STORAGES = {
    "default": {"BACKEND": "django.core.files.storage.FileSystemStorage"},
    "staticfiles": {"BACKEND": "whitenoise.storage.CompressedStaticFilesStorage"},
}

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"


# --- CORS ---
# Con Docker + Nginx el frontend y la API comparten dominio y CORS no se usa.
# Solo hace falta si el frontend vive en otro dominio (p. ej. Netlify).
# La autenticación usa el header Authorization (no cookies): sin CORS_ALLOW_CREDENTIALS.

if DEBUG:
    CORS_ALLOW_ALL_ORIGINS = True
else:
    CORS_ALLOWED_ORIGINS = env_list("CORS_ALLOWED_ORIGINS")


# --- Logs (se ven con `docker compose logs backend`) ---

LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "handlers": {"console": {"class": "logging.StreamHandler"}},
    "root": {"handlers": ["console"], "level": "WARNING"},
    "loggers": {
        # Intentos de acceso con Host inválido, CSRF fallido, etc.
        "django.security": {"handlers": ["console"], "level": "WARNING", "propagate": False},
    },
}


# --- Seguridad en producción ---

if not DEBUG:
    # Nginx termina HTTPS y avisa con X-Forwarded-Proto
    SECURE_SSL_REDIRECT = False
    SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
    SESSION_COOKIE_SECURE = True
    SESSION_COOKIE_HTTPONLY = True
    CSRF_COOKIE_SECURE = True
    CSRF_TRUSTED_ORIGINS = env_list("CSRF_TRUSTED_ORIGINS")
    SECURE_CONTENT_TYPE_NOSNIFF = True
    SECURE_REFERRER_POLICY = "same-origin"
    X_FRAME_OPTIONS = "DENY"
    SECURE_HSTS_SECONDS = env_int("SECURE_HSTS_SECONDS", 31536000)
    SECURE_HSTS_INCLUDE_SUBDOMAINS = False
    SECURE_HSTS_PRELOAD = False
