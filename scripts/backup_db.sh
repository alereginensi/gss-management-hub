#!/bin/bash

# Database Backup Script for GSS Management Hub
# Creates daily backups of tickets.db with timestamp

# Configuration
DB_FILE="tickets.db"
BACKUP_DIR="backups"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="${BACKUP_DIR}/tickets_${TIMESTAMP}.db"
LOG_FILE="${BACKUP_DIR}/backup.log"

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

# Log function
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# Check if database exists
if [ ! -f "$DB_FILE" ]; then
    log "ERROR: Database file $DB_FILE not found!"
    exit 1
fi

# Create backup
log "Starting backup..."
cp "$DB_FILE" "$BACKUP_FILE"

if [ $? -eq 0 ]; then
    # Get file size
    SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
    log "SUCCESS: Backup created - $BACKUP_FILE (Size: $SIZE)"
    
    # Count total backups
    BACKUP_COUNT=$(ls -1 "$BACKUP_DIR"/tickets_*.db 2>/dev/null | wc -l)
    log "Total backups: $BACKUP_COUNT"
    
    exit 0
else
    log "ERROR: Backup failed!"
    exit 1
fi
