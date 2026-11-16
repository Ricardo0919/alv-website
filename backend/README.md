# Backend — API Django

```bash
python -m venv .venv
.venv\Scripts\activate        # Linux/Mac: source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
python manage.py migrate
python manage.py runserver    # http://127.0.0.1:8000
```

- `python manage.py test` — pruebas
- `python manage.py createsuperuser` — acceso a `/admin/`
- `python manage.py asignar_migajas <usuario>` — asigna migajas sin dueño (de versiones anteriores)

Sin `DATABASE_URL` usa SQLite (`db.sqlite3`). Ver `.env.example` para todas las variables.
