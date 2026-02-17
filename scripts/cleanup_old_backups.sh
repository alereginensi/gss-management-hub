#!/bin/bash

# Backup Cleanup Script for GSS Management Hub
# Keeps last 30 daily backups + 1 per month for older backups

# Configuration
BACKUP_DIR="backups"
LOG_FILE="${BACKUP_DIR}/backup.log"
KEEP_DAYS=30

# Log function
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

log "Starting backup cleanup..."

# Count backups before cleanup
BEFORE_COUNT=$(ls -1 "$BACKUP_DIR"/tickets_*.db 2>/dev/null | wc -l)
log "Backups before cleanup: $BEFORE_COUNT"

# Delete backups older than KEEP_DAYS, except one per month
find "$BACKUP_DIR" -name "tickets_*.db" -type f -mtime +$KEEP_DAYS | while read -r backup; do
    # Extract year and month from filename
    FILENAME=$(basename "$backup")
    YEAR_MONTH=$(echo "$FILENAME" | sed 's/tickets_\([0-9]\{6\}\).*/\1/')
    
    # Check if we already have a backup for this month
    MONTHLY_BACKUP="${BACKUP_DIR}/monthly_${YEAR_MONTH}.db"
    
    if [ ! -f "$MONTHLY_BACKUP" ]; then
        # Keep this as the monthly backup
        mv "$backup" "$MONTHLY_BACKUP"
        log "Kept monthly backup: $MONTHLY_BACKUP"
    else
        # Delete this backup
        rm "$backup"
        log "Deleted old backup: $backup"
    fi
done

# Count backups after cleanup
AFTER_COUNT=$(ls -1 "$BACKUP_DIR"/tickets_*.db "$BACKUP_DIR"/monthly_*.db 2>/dev/null | wc -l)
DELETED=$((BEFORE_COUNT - AFTER_COUNT))

log "Cleanup complete. Deleted: $DELETED backups. Remaining: $AFTER_COUNT"
