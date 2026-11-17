#!/bin/sh
set -e

BACKUP_DIR="/backup"
KEEP_DAYS=7

DATE=$(date +%Y%m%d_%H%M%S)
FILE="$BACKUP_DIR/forgejo-backup-$DATE.tar.gz"

echo "[$(date)] Starting backup..."
# repo-archive is a cache of source downloads Forgejo rebuilds on request; a crawler grew it
# to 38 GB in two days, and the backups of it filled the disk.
tar czf "$FILE" --exclude=./gitea/repo-archive -C /data .
echo "[$(date)] Backup saved: $FILE"

find "$BACKUP_DIR" -name "forgejo-backup-*.tar.gz" -mtime +$KEEP_DAYS -delete
echo "[$(date)] Old backups pruned (kept last $KEEP_DAYS days)"
