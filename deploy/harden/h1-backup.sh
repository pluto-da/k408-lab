set -e
TS=$(date +%Y%m%d%H%M%S); B=/root/hardening-backup-$TS; mkdir -p $B; chmod 700 $B
cp -a /etc/ssh $B/ssh
cp -a /etc/ufw $B/ufw 2>/dev/null || true
iptables-save > $B/iptables.rules; ip6tables-save > $B/ip6tables.rules
crontab -l > $B/root.crontab 2>/dev/null || true
cp -a /etc/cron.d $B/cron.d
echo "$B" > /root/hardening-backup-latest
echo BACKUP $B; ls $B
