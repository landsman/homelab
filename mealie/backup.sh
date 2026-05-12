#!/bin/sh
set -e

BACKUP_DIR="/backup"
KEEP_DAYS=14

DATE=$(date +%Y%m%d_%H%M%S)
FILE="$BACKUP_DIR/mealie-backup-$DATE.tar.gz"

echo "[$(date)] Starting backup..."
tar czf "$FILE" -C /data .
echo "[$(date)] Backup saved: $FILE"

find "$BACKUP_DIR" -name "mealie-*.tar.gz" -mtime +$KEEP_DAYS -delete
echo "[$(date)] Old backups pruned (kept last $KEEP_DAYS days)"
