set -e
cat > /usr/local/sbin/k408-db-backup.sh <<'SH'
#!/bin/sh
# k408 数据库每日备份：pg_dump 自定义格式（已压缩），保留 7 天，文件权限 600
set -eu
umask 077
D=/var/backups/k408
mkdir -p "$D"; chmod 700 "$D"
F="$D/k408-$(date +%Y%m%d-%H%M%S).dump"
cd /opt/k408
docker compose exec -T postgres sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc -Z 6' > "$F.part"
mv "$F.part" "$F"; chmod 600 "$F"
find "$D" -name 'k408-*.dump' -mtime +6 -delete
echo "$(date '+%F %T') backup ok $F $(stat -c %s "$F") bytes"
SH
chmod 700 /usr/local/sbin/k408-db-backup.sh
cat > /etc/cron.d/k408-db-backup <<'CRON'
# k408 数据库每日备份（服务器时区 Asia/Shanghai，凌晨 3:30）
30 3 * * * root /usr/local/sbin/k408-db-backup.sh >> /var/log/k408-db-backup.log 2>&1
CRON
chmod 644 /etc/cron.d/k408-db-backup
/usr/local/sbin/k408-db-backup.sh
ls -l /var/backups/k408
