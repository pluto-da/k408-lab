set -e
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq >/dev/null 2>&1 || true
apt-get install -y -qq fail2ban >/dev/null
cat > /etc/fail2ban/jail.d/k408-sshd.local <<'CONF'
[sshd]
enabled = true
backend = systemd
port = ssh
maxretry = 5
findtime = 10m
bantime = 1h
bantime.increment = true
bantime.maxtime = 1w
CONF
systemctl enable --now fail2ban >/dev/null 2>&1
systemctl restart fail2ban; sleep 3
fail2ban-client status sshd
echo "--- unattended-upgrades"
systemctl is-enabled unattended-upgrades; systemctl is-active unattended-upgrades
cat /etc/apt/apt.conf.d/20auto-upgrades
grep -E '^\s*"\$\{distro_id\}:\$\{distro_codename\}-security' /etc/apt/apt.conf.d/50unattended-upgrades
unattended-upgrade --dry-run 2>&1 | tail -2
