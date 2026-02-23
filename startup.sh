#!/bin/sh
# startup.sh - Entrypoint script that ensures /app/data is properly set up
# This runs before the Next.js server starts on Railway

set -e

DATA_DIR="/app"
DB_FILE="/app/tickets.db"

echo "=== GSS Management Hub Startup ==="
echo "Working directory: $DATA_DIR"

# Check if the DB file is on a persistent volume (or the directory containing it)
if df "$DB_FILE" 2>/dev/null | grep -q "overlay" || df "$DATA_DIR" | grep -q "overlay"; then
  echo "⚠️  WARNING: Database location is on overlay filesystem (ephemeral)"
  echo "   Please ensure a Railway volume is mounted at /app/tickets.db"
else
  echo "✅ Database location is on a persistent filesystem"
fi

echo "DB path: $DB_FILE"
if [ -f "$DB_FILE" ]; then
  echo "✅ Database file exists ($(du -sh "$DB_FILE" | cut -f1))"
else
  echo "ℹ️  Database will be created on first request"
fi

echo "=== Starting Next.js server ==="
exec node server.js
