#!/bin/sh
# startup.sh - Entrypoint script that ensures /app/data is properly set up
# This runs before the Next.js server starts on Railway

set -e

DATA_DIR="/app"
DB_FILE="/app/tickets.db"

echo "=== GSS Management Hub Startup ==="
echo "Current User ID: $(id)"
echo "Working directory: $(pwd)"

# Check if the DB file is on a persistent volume (or the directory containing it)
if df "$DB_FILE" 2>/dev/null | grep -q "overlay" || df "$DATA_DIR" | grep -q "overlay"; then
  echo "⚠️  WARNING: Database location is on overlay filesystem (ephemeral)"
  echo "   Please ensure a Railway volume is mounted accurately."
else
  echo "✅ Database location is on a persistent filesystem"
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

echo "=== Starting Next.js server ==="
exec node server.js
