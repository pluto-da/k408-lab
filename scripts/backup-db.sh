#!/bin/sh
# Postgres 备份：在仓库根目录执行 ./scripts/backup-db.sh
# 生成 backups/k408-YYYYmmdd-HHMMSS.sql.gz，并只保留最近 14 份。
set -eu
cd "$(dirname "$0")/.."
mkdir -p backups
STAMP=$(date +%Y%m%d-%H%M%S)
OUT="backups/k408-$STAMP.sql.gz"
docker compose exec -T postgres sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --no-owner --clean --if-exists' | gzip > "$OUT"
echo "已备份到 $OUT ($(du -h "$OUT" | cut -f1))"
ls -1t backups/k408-*.sql.gz | tail -n +15 | xargs -r rm --
