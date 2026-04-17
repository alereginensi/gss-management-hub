#!/bin/sh
# startup.sh - Entrypoint script that ensures /app/data is properly set up
# This runs before the Next.js server starts on Railway

set -e

DB_FILE="/app/data/tickets.db"
DATA_DIR="/app/data"

echo "=== GSS Management Hub Startup ==="
echo "Current User ID: $(id)"
echo "Working directory: $(pwd)"

# Create data directory if it doesn't exist
mkdir -p "$DATA_DIR"

# Check if the DB file is on a persistent volume (Only relevant for SQLite)
if [ -z "$DATABASE_URL" ]; then
  if mount | grep -q "$DATA_DIR"; then
    echo "✅ Database location ($DATA_DIR) is a MOUNTED volume"
  else
    echo "⚠️  WARNING: $DATA_DIR is NOT a mounted volume. Data will be LOST on redeploy (SQLite fallback)."
  fi
else
  echo "🐘 Using PostgreSQL (DATABASE_URL found). SQLite persistence is optional."
fi

echo "DB target path: $DB_FILE"

# List files with detailed permissions to help debug where the actual data is
echo "--- Directory & Permissions Audit ---"
ls -la /app
echo "------------------------------------"
if [ -d "$DB_FILE" ]; then
    echo "Files inside mount folder ($DB_FILE):"
    ls -la "$DB_FILE"
fi
echo "--------------------------"

if [ -f "$DB_FILE" ]; then
  echo "✅ Database file exists ($(du -sh "$DB_FILE" | cut -f1))"
else
  echo "ℹ️  Database will be created on first request"
fi

# Cron diario mitrabajo 08:00 America/Montevideo
if [ -f "/app/scripts/cron-mitrabajo.cjs" ]; then
  echo "=== Starting mitrabajo cron (background) ==="
  node /app/scripts/cron-mitrabajo.cjs &
else
  echo "⚠️  cron-mitrabajo.cjs no encontrado — descarga automática deshabilitada"
fi

echo "=== Starting Next.js server ==="
exec node server.js
