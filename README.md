# 🍞 Proyecto alv-website

![Version](https://img.shields.io/badge/version-5.0.0-blue)
![Django](https://img.shields.io/badge/Django-5.2_LTS-green)
![Next.js](https://img.shields.io/badge/Next.js-16-black)

Una aplicación web para seguir el rastro de las "migajas".
**Objetivo**: recolectar 80,000 migajas 🎯 — cada usuario tiene su propia cuenta y su propio progreso.

## 📁 Estructura

```
alv-website/
├── backend/               # API Django (proyecto independiente)
│   ├── config/            # settings, urls, wsgi
│   ├── accounts/          # registro, login, logout, perfil
│   ├── migajas/           # interacciones, estadísticas y regalos de migajas
│   ├── friends/           # amistades y tablero
│   ├── manage.py
│   ├── requirements.txt
│   └── .env.example
├── frontend/              # App Next.js (proyecto independiente)
│   ├── app/               # páginas: /, /log, /login, /register, /u/[usuario], /notificaciones, /amigos, /ajustes, /historial
│   ├── components/
│   ├── lib/               # cliente de API y contexto de sesión
│   └── .env.example
├── scripts/               # utilidades de servidor
└── docs/
```

## 🚀 Correr en local

Abre dos terminales.

**Backend** (http://127.0.0.1:8000)
```bash
cd backend
python -m venv .venv
.venv\Scripts\activate          # Windows  (Linux/Mac: source .venv/bin/activate)
pip install -r requirements.txt
copy .env.example .env          # Linux/Mac: cp .env.example .env
python manage.py migrate
python manage.py runserver
```

**Frontend** (http://localhost:3000)
```bash
cd frontend
npm install
copy .env.example .env.local    # Linux/Mac: cp .env.example .env.local
npm run dev
```

Pruebas del backend: `cd backend && python manage.py test`

### Abrirlo desde otro dispositivo (misma red WiFi)

No hace falta un proxy extra: Next.js reenvía `/api` al backend (con `NEXT_PUBLIC_API_URL` vacío en `frontend/.env.local`).

```bash
cd frontend
npm run dev -- -H 0.0.0.0
```

Abre `http://IP_DE_TU_LAPTOP:3000` en el otro dispositivo (la IP sale con `ipconfig`). El backend se queda en `127.0.0.1:8000`.
Si no carga, permite Node.js en el Firewall de Windows para redes privadas.

## 🔐 Usuarios y seguridad

- Las contraseñas **nunca se guardan en texto plano**: Django usa PBKDF2-SHA256 con sal aleatoria (600,000 iteraciones).
- Reglas de contraseña: mínimo 8 caracteres, no solo números, no contraseñas comunes ni parecidas al usuario.
- Login y registro limitados a 10 intentos por minuto (anti fuerza bruta).
- Autenticación por token (`Authorization: Token <token>`); cerrar sesión revoca el token.
- Solo el dueño (con sesión iniciada) puede registrar migajas en su cuenta.
- Otros usuarios pueden **regalarte migajas** con una razón obligatoria; solo se suman si tú las aceptas en 🔔 Notificaciones.
- Cada usuario tiene un link público `/u/<usuario>` para compartir: otros ven su progreso, pero no pueden modificarlo.

### Migrar migajas anteriores a usuarios

Las migajas creadas antes de esta versión no tienen dueño. Después de crear tu cuenta en la app:

```bash
cd backend
python manage.py asignar_migajas <tu_usuario>
```

## 🌐 API

| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/api/auth/register/` | Crear cuenta → `{token, user}` |
| POST | `/api/auth/login/` | Iniciar sesión → `{token, user}` |
| POST | `/api/auth/logout/` | Cerrar sesión (revoca el token) |
| GET | `/api/auth/me/` | Usuario actual |
| GET | `/api/stats/` | Total, meta y porcentaje del usuario |
| GET | `/api/interactions/` | Historial del usuario con razones (paginado) |
| POST | `/api/interactions/batch/` | Registrar migajas `{type: ADD/REMOVAL, count_or_duration, reason}` en una transacción |
| GET | `/api/users/<usuario>/` | Perfil público de solo lectura (sin auth) |
| PATCH | `/api/auth/me/` | Cambiar la meta `{goal}` (por defecto 80,000) |
| POST | `/api/users/<usuario>/requests/` | Regalar migajas `{crumbs, reason}` (máximo: la meta de quien recibe) |
| GET | `/api/requests/?status=PENDING` | Mis notificaciones (solicitudes recibidas) |
| GET | `/api/requests/pending-count/` | Número de solicitudes pendientes |
| POST | `/api/requests/<id>/accept/` · `/reject/` | Aceptar o rechazar una solicitud |
| GET | `/api/friends/` | Tablero: tú y tus amigos, por quién llegó primero a su meta |
| GET/POST | `/api/friends/requests/` | Ver / enviar solicitudes de amistad |
| POST | `/api/friends/requests/<id>/accept/` · `/reject/` | Responder solicitud |
| DELETE | `/api/friends/<usuario>/` | Dejar de ser amigos |
| GET | `/api/health/` | Estado del servidor (sin auth) |

## 🎮 Reglas de Migajas

| Tipo | Condición | Migajas |
|------|-----------|---------|
| 💬 Conversación | 5+ mensajes | +1 |
| 📞 Llamada | 5+ minutos | +5 |
| 📞 Llamada | < 5 minutos | +1 |
| ➖ Quitar | Manual | -N |

El total de cada usuario siempre se mantiene entre 0 y su meta (80,000 por defecto, ajustable en ⚙️ Ajustes).

## 📱 Instalar como app

La web es una PWA: en Chrome aparece **Instalar app** (computadora) o **Agregar a pantalla de inicio** (Android/iPhone), con el ícono del bolillo.
Chrome solo lo permite en **HTTPS** o en `localhost` (no en `http://IP:3000` de la red local).
Los íconos están en `frontend/public/icons/` y `frontend/app/apple-icon.png`.

## 🐳 Despliegue con Docker (VPS)

```bash
git clone <repo> && cd alv-website
cp .env.example .env        # llena DOMAIN, POSTGRES_PASSWORD, DJANGO_SECRET_KEY, ADMIN_URL
docker compose up -d --build
docker compose ps           # todos deben decir "healthy"
```

| Servicio | Qué es | Puerto en el servidor |
|----------|--------|----------------------|
| `frontend` | Next.js | `127.0.0.1:3030` |
| `backend` | Django + gunicorn (aplica migraciones al arrancar) | `127.0.0.1:8030` |
| `db` | PostgreSQL 17 (solo red interna) | — |
| `redis` | Contador del límite de peticiones (sin disco) | — |
| `db-backup` | `pg_dump` diario/semanal/mensual en el volumen `db_backups` | — |

Luego configura Nginx con [`deploy/nginx/migajero.conf`](deploy/nginx/migajero.conf) y HTTPS con `certbot`.

- **Actualizar:** `git pull && docker compose up -d --build`
- **Logs:** `docker compose logs -f backend`
- **Panel admin** (no se publica): `ssh -L 8030:127.0.0.1:8030 usuario@vps` → `http://localhost:8030/<ADMIN_URL>`
- **Crear admin:** `docker compose exec backend python manage.py createsuperuser`
- **Restaurar respaldo:** `docker compose exec db-backup ls /backups/daily`

## 🛡️ Seguridad

- Sin SQL escrito a mano: todo pasa por el ORM de Django (consultas parametrizadas, sin inyección SQL).
- Límite de peticiones en dos capas: Nginx (por IP) y Django/DRF con contador en Redis (login 10/min, API general, regalos y amistades por hora).
- Sesiones (tokens) que caducan a los 30 días; cerrar sesión las revoca.
- Cabeceras de seguridad: CSP, `X-Frame-Options`, `nosniff`, `Referrer-Policy`, HSTS.
- Cuerpos de petición limitados (256 KB), consultas a la base con tiempo máximo (10 s), timeouts en gunicorn y Nginx.
- Contenedores sin root, PostgreSQL sin puerto público, panel admin en ruta secreta y solo por túnel SSH.
- Dependencias sin vulnerabilidades conocidas: `pip-audit -r backend/requirements.txt` y `npm audit --omit=dev`.

## ☁️ Despliegue

- **Frontend (Netlify)**: `netlify.toml` ya apunta a `frontend/`. Variable: `NEXT_PUBLIC_API_URL`.
- **Backend (Render)**: Root Directory `backend`, build `./build.sh`, start `gunicorn config.wsgi:application` (o usa el `Procfile`). Variables: `DJANGO_SECRET_KEY`, `DATABASE_URL`, `ALLOWED_HOSTS`, `DEBUG=False`, `CORS_ALLOWED_ORIGINS`, `CSRF_TRUSTED_ORIGINS`, `REDIS_URL`.

## 📋 Changelog

Ver [CHANGELOG.md](CHANGELOG.md).
