#!/usr/bin/env bash
# Build step for Render/Railway: install dependencies and collect admin static files.
set -o errexit

pip install --upgrade pip
pip install -r requirements.txt
python manage.py collectstatic --noinput
python manage.py migrate --noinput
