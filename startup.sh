#!/bin/sh
# startup.sh - Entrypoint script that ensures /app/data is properly set up
# This runs before the Next.js server starts on Railway

set -e

DATA_DIR="/app/data"
DB_FILE="$DATA_DIR/tickets.db"

echo "=== GSS Management Hub Startup ==="
echo "DATA_DIR: $DATA_DIR"

# Ensure /app/data directory exists (in case volume isn't mounted)
mkdir -p "$DATA_DIR" 2>/dev/null || true

# Check if the volume is properly mounted
if df "$DATA_DIR" | grep -q "overlay"; then
  echo "⚠️  WARNING: /app/data is on overlay filesystem (ephemeral - data will be lost on redeploy)"
  echo "   Please configure a Railway volume mounted at /app/data"
else
  echo "✅ /app/data is on a persistent filesystem"
fi

echo "DB path: $DB_FILE"
if [ -f "$DB_FILE" ]; then
  echo "✅ Database file exists ($(du -sh "$DB_FILE" | cut -f1))"
else
  echo "ℹ️  Database will be created on first request"
fi

echo "=== Starting Next.js server ==="
exec node server.js
