# v20 修复部署（d14 的 Caddy 校验失败后）：不再打 v19 标签（v19 镜像标签与 /root/k408-src-v19-20261012182702.tgz 已在 d14 第一步备好）。
# 用法：python3 up.py && sed "s/__BUILD__/v20-xxxx/" d15.sh | python3 rx.py
set -e; cd /opt/k408
rm -rf apps packages deploy scripts
tar xzf /root/k408.tgz -C /opt/k408
find . -not -path "*/node_modules/*" \( -name .git -o -name "README.md" -o -name "CONTRIBUTING.md" -o -name "TODO.md" -o -iname "*.pdf" -o -iname "*outline*" -o -name "*.map" \) -prune -exec rm -rf {} + 2>/dev/null || true
test ! -e apps/web/public/legacy
sed -i 's/^BUILD_ID=.*/BUILD_ID=__BUILD__/' .env
chmod 600 .env
grep -E '^(BUILD_ID)=' .env
setsid -f sh -c '
  cd /opt/k408
  { docker compose build api && echo API_BUILT && docker compose build caddy && echo CADDY_BUILT \
    && docker run --rm -v k408_caddy_data:/d -v k408_caddy_config:/c --entrypoint sh postgres:16-alpine -c "chown -R 10001:10001 /d /c" && echo CHOWN_OK \
    && docker compose up -d && echo UP_OK; } > /root/d15.log 2>&1
  echo D15_DONE $? >> /root/d15.log' < /dev/null > /dev/null 2>&1
echo started
