#!/usr/bin/env bash
# Build del backend (Render: Root Directory = backend)
set -o errexit

pip install -r requirements.txt
python manage.py collectstatic --noinput
python manage.py migrate
