set -e
B=$(cat /root/hardening-backup-latest)
cat > /etc/ssh/sshd_config.d/00-k408-hardening.conf <<'CONF'
# k408 加固（v20）：只允许密钥登录；root 只能用密钥；限制尝试次数。回滚：删除本文件后 systemctl reload ssh
PasswordAuthentication no
KbdInteractiveAuthentication no
PermitRootLogin prohibit-password
PubkeyAuthentication yes
MaxAuthTries 3
LoginGraceTime 30
PermitEmptyPasswords no
X11Forwarding no
CONF
chmod 644 /etc/ssh/sshd_config.d/00-k408-hardening.conf
if sshd -t; then systemctl reload ssh && echo SSH_RELOADED; else rm -f /etc/ssh/sshd_config.d/00-k408-hardening.conf; echo SSHD_TEST_FAILED_ROLLED_BACK; exit 1; fi
sshd -T | grep -Ei "^(passwordauthentication|permitrootlogin|kbdinteractiveauthentication|maxauthtries|pubkeyauthentication) "
