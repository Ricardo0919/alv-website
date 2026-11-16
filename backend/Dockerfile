# ---------------------------------------------------------------------------
# Backend Django (API) — imagen de producción
# ---------------------------------------------------------------------------
FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app

# Dependencias primero (se cachean mientras requirements.txt no cambie)
COPY requirements.txt .
RUN pip install -r requirements.txt

COPY . .

# Archivos estáticos del panel de administración (los sirve WhiteNoise)
RUN DJANGO_SECRET_KEY=solo-para-build DEBUG=False python manage.py collectstatic --noinput

# Nunca correr como root dentro del contenedor
RUN useradd --system --no-create-home --uid 10001 app
USER app

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
    CMD python -c "import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:8000/api/health/', timeout=4).status == 200 else 1)"

# 1) Aplica migraciones pendientes  2) Arranca gunicorn
#   --max-requests reinicia cada worker cada ~1000 peticiones (evita que la RAM crezca)
#   --timeout corta peticiones colgadas (protege contra clientes lentos)
CMD ["sh", "-c", "python manage.py migrate --noinput && exec gunicorn config.wsgi:application --bind 0.0.0.0:8000 --workers ${WEB_CONCURRENCY:-2} --threads 2 --max-requests 1000 --max-requests-jitter 100 --timeout 30 --graceful-timeout 20 --forwarded-allow-ips='*' --access-logfile -"]
