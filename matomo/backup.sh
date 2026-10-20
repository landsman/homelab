#!/bin/sh
# Dumps the Matomo database and saves config.ini.php (salt + DB settings — a
# restore without it invalidates every login). Runs on the host, next to compose.yml.
set -eu

BACKUP_DIR="${BACKUP_DIR:-/home/containers/backup/matomo}"
KEEP_DAYS=14
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p "$BACKUP_DIR"
echo "[$(date)] Starting backup..."
docker compose exec -T db sh -c 'mariadb-dump --single-transaction -u root -p"$MARIADB_ROOT_PASSWORD" "$MARIADB_DATABASE"' \
  | gzip > "$BACKUP_DIR/matomo-db-$DATE.sql.gz"
docker compose cp app:/var/www/html/config/config.ini.php "$BACKUP_DIR/matomo-config-$DATE.ini.php"
echo "[$(date)] Backup saved: $BACKUP_DIR/matomo-*-$DATE.*"

find "$BACKUP_DIR" -name "matomo-*" -mtime +"$KEEP_DAYS" -delete
echo "[$(date)] Old backups pruned (kept last $KEEP_DAYS days)"
