#!/bin/bash

# Database Restore Script for GSS Management Hub
# Restores tickets.db from a selected backup

# Configuration
DB_FILE="tickets.db"
BACKUP_DIR="backups"
LOG_FILE="${BACKUP_DIR}/backup.log"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Log function
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

echo -e "${YELLOW}=== GSS Management Hub - Database Restore ===${NC}\n"

# Check if backup directory exists
if [ ! -d "$BACKUP_DIR" ]; then
    echo -e "${RED}ERROR: Backup directory not found!${NC}"
    exit 1
fi

# List available backups
BACKUPS=($(ls -1t "$BACKUP_DIR"/tickets_*.db 2>/dev/null))

if [ ${#BACKUPS[@]} -eq 0 ]; then
    echo -e "${RED}No backups found in $BACKUP_DIR${NC}"
    exit 1
fi

echo "Available backups:"
echo ""

for i in "${!BACKUPS[@]}"; do
    BACKUP_FILE="${BACKUPS[$i]}"
    FILENAME=$(basename "$BACKUP_FILE")
    # Extract date from filename (format: tickets_YYYYMMDD_HHMMSS.db)
    DATE_STR=$(echo "$FILENAME" | sed 's/tickets_\([0-9]\{8\}\)_\([0-9]\{6\}\)\.db/\1 \2/')
    DATE_FORMATTED=$(date -d "${DATE_STR:0:8} ${DATE_STR:9:2}:${DATE_STR:11:2}:${DATE_STR:13:2}" '+%Y-%m-%d %H:%M:%S' 2>/dev/null || echo "$DATE_STR")
    SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
    
    echo -e "${GREEN}[$i]${NC} $DATE_FORMATTED (Size: $SIZE)"
done

echo ""
read -p "Enter backup number to restore (or 'q' to quit): " SELECTION

if [ "$SELECTION" = "q" ]; then
    echo "Restore cancelled."
    exit 0
fi

# Validate selection
if ! [[ "$SELECTION" =~ ^[0-9]+$ ]] || [ "$SELECTION" -ge ${#BACKUPS[@]} ]; then
    echo -e "${RED}Invalid selection!${NC}"
    exit 1
fi

SELECTED_BACKUP="${BACKUPS[$SELECTION]}"
echo ""
echo -e "${YELLOW}You selected: $(basename "$SELECTED_BACKUP")${NC}"
echo ""
read -p "Are you sure you want to restore this backup? (yes/no): " CONFIRM

if [ "$CONFIRM" != "yes" ]; then
    echo "Restore cancelled."
    exit 0
fi

# Create safety backup of current database
SAFETY_BACKUP="${BACKUP_DIR}/tickets_before_restore_$(date +"%Y%m%d_%H%M%S").db"
if [ -f "$DB_FILE" ]; then
    log "Creating safety backup: $SAFETY_BACKUP"
    cp "$DB_FILE" "$SAFETY_BACKUP"
fi

# Restore the backup
log "Restoring backup: $SELECTED_BACKUP"
cp "$SELECTED_BACKUP" "$DB_FILE"

if [ $? -eq 0 ]; then
    echo -e "${GREEN}SUCCESS: Database restored successfully!${NC}"
    log "SUCCESS: Database restored from $SELECTED_BACKUP"
    echo ""
    echo -e "${YELLOW}IMPORTANT: Restart your application to use the restored database.${NC}"
    exit 0
else
    echo -e "${RED}ERROR: Restore failed!${NC}"
    log "ERROR: Failed to restore from $SELECTED_BACKUP"
    exit 1
fi
