# Frontend — El Migajero (Next.js)

```bash
npm install
cp .env.example .env.local   # NEXT_PUBLIC_API_URL = URL del backend
npm run dev                  # http://localhost:3000
```

- `npm run build` / `npm start` — producción
- `npm run lint` — ESLint

Páginas: `/login`, `/register`, `/` (progreso) y `/log` (registrar). Las dos últimas requieren sesión.
El token se guarda en `localStorage` y se envía en el header `Authorization`.
