# Changelog

## v5.0.0 (2026-11-15)
- ✅ Estructura separada: `backend/` y `frontend/` como proyectos independientes
- ✅ Cuentas de usuario: registro, inicio y cierre de sesión (token)
- ✅ Contraseñas con hash PBKDF2, validación de contraseñas y límite de intentos
- ✅ Migajas y estadísticas independientes por usuario
- ✅ Registro en lote en una sola transacción (arregla totales incorrectos por peticiones en paralelo)
- ✅ Comando `asignar_migajas` para migrar datos anteriores
- ✅ Perfil público `/u/<usuario>` para compartir (solo lectura)
- ✅ Regalar migajas a otros con razón; el dueño acepta o rechaza en Notificaciones
- ✅ Mostrar/ocultar contraseña en login y registro
- ✅ Meta ajustable por usuario (por defecto 80,000)
- ✅ Amigos con solicitud mutua y tablero de quién llega primero a su meta
- ✅ Regalar migajas con un selector de cantidad y teclado numérico
- 🎨 Barra superior rediseñada con íconos consistentes
- ✅ Registrar con número + teclado fijo, sumar o quitar, con razón opcional
- ✅ Historial de movimientos con razón y quién regaló
- 🎨 Diseño adaptado a celular, tablet y computadora; íconos en lugar de emojis
- 📱 Instalable como app (PWA) con el ícono del favicon
- ✅ Ya no se puede sumar ni regalar al llegar a la meta (mensajes para cada caso)
- 🎨 Notificaciones deslizables y confirmaciones propias en lugar de alert/confirm del navegador
- 🐳 Docker: Dockerfiles de backend y frontend, docker-compose con PostgreSQL, Redis y respaldos
- 🛡️ Seguridad: Django 5.2 LTS y Next.js 16.4.6 (sin vulnerabilidades conocidas), límite de peticiones
  compartido en Redis, sesiones que caducan, cabeceras CSP, admin en ruta secreta, redirección abierta corregida
- 🐛 requirements.txt tenía dos paquetes en una misma línea (rompía la instalación)
- ✅ Next.js reenvía `/api` al backend: funciona desde otros dispositivos de la red local
- ⚡ Fondo sin filtros `blur` ni animaciones continuas (menos uso de GPU/RAM en móviles)
- 🐛 Toques en móvil ya no cuentan doble; el modo turbo ya no deja intervalos activos

## v4.1.1 (2026-01-24)
- Rescue version tag for record.

## v2.1.0 (2026-01-19)
- ✅ Reorganización completa del proyecto
- ✅ Nueva estructura `src/` para código fuente
- ✅ Scripts consolidados en `scripts/`
- ✅ Documentación movida a `docs/`
- ✅ Agregado `.env.example`

## v2.0.0 (2026-01-19)
- ✅ Migración a PostgreSQL (AWS RDS)
- ✅ Mejoras de seguridad en Django

## v1.0.0
- 🚀 Versión inicial
