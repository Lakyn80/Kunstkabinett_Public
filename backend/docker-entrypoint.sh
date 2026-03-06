#!/bin/bash
set -e

echo "=== Waiting for database to be ready ==="
python3 << EOF
import os
import sys
import time
from sqlalchemy import create_engine, text
from sqlalchemy.exc import OperationalError

database_url = os.environ.get("DATABASE_URL", "")
if not database_url:
    print("ERROR: DATABASE_URL not set")
    sys.exit(1)

# Remove +psycopg2 from URL for connection testing
test_url = database_url.replace("+psycopg2", "")

max_retries = 30
retry_count = 0

while retry_count < max_retries:
    try:
        engine = create_engine(test_url, pool_pre_ping=True, connect_args={"connect_timeout": 2})
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        print("Database is ready!")
        break
    except OperationalError as e:
        retry_count += 1
        if retry_count >= max_retries:
            print(f"ERROR: Could not connect to database after {max_retries} retries")
            sys.exit(1)
        print(f"Database is unavailable - sleeping (attempt {retry_count}/{max_retries})")
        time.sleep(2)
EOF

echo "=== Running Alembic migrations ==="
# Ensure DATABASE_URL is set for alembic
if [ -z "$DATABASE_URL" ]; then
    echo "ERROR: DATABASE_URL environment variable is not set"
    exit 1
fi

echo "Using DATABASE_URL: ${DATABASE_URL%%@*}@***"  # Mask password in logs
alembic upgrade head

echo "=== Seeding dev admin user (if ENV=dev) ==="
python3 - <<'PY'
from app.services.dev_utils import ensure_dev_admin

ensure_dev_admin()
PY

echo "=== Starting application ==="
exec "$@"
