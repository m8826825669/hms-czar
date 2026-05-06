#!/usr/bin/env bash
set -e

# Wait for Postgres
echo "Waiting for Postgres at ${POSTGRES_HOST:-db}:${POSTGRES_PORT:-5432}..."
until python -c "
import socket, sys
s = socket.socket()
s.settimeout(2)
try:
    s.connect(('${POSTGRES_HOST:-db}', int('${POSTGRES_PORT:-5432}')))
    sys.exit(0)
except Exception:
    sys.exit(1)
"; do
  sleep 1
done
echo "Postgres is up."

# Migrate, collectstatic
python manage.py migrate --noinput
python manage.py collectstatic --noinput || true

# Default command: daphne (handles HTTP + WebSocket)
exec "$@"
