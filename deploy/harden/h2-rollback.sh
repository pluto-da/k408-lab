rm -f /etc/ssh/sshd_config.d/00-k408-hardening.conf; sshd -t && systemctl reload ssh; echo SSH_ROLLED_BACK
