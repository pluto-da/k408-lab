#!/bin/sh
# 沙盒重启后系统包会丢失：重新安装浏览器、中文字体与 paramiko
which chromium >/dev/null 2>&1 || { sudo apt-get update -qq >/dev/null 2>&1; sudo DEBIAN_FRONTEND=noninteractive apt-get install -y -qq chromium fonts-noto-cjk >/dev/null 2>&1; }
python3 -c "import paramiko" 2>/dev/null || pip install -q paramiko 2>/dev/null || pip install -q --break-system-packages paramiko
which chromium && python3 -c "import paramiko; print('paramiko ok')"
