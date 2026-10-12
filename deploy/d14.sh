# v20 deploy. 用法：python3 up.py && sed "s/__BUILD__/v20-xxxx/" d14.sh | python3 rx.py
# 构建在后台（setsid）串行进行：先 api、再 caddy（自定义 Caddy 编译约 20 分钟），日志 /root/d14.log，完成后写 D14_DONE <code>。
set -e; cd /opt/k408
TS=$(date +%Y%m%d%H%M%S)
# 1. 回滚准备：当前镜像打 v19 标签，源码与 .env 备份
docker tag k408-web:latest k408-web:v19 2>/dev/null || true
docker tag k408-api:latest k408-api:v19 2>/dev/null || true
tar czf /root/k408-src-v19-$TS.tgz --exclude=node_modules -C /opt/k408 . 
cp -a .env /root/k408.env.v19-$TS
echo "backup: /root/k408-src-v19-$TS.tgz /root/k408.env.v19-$TS"
# 2. 换源码：先删掉旧的源码目录（旧版实验室源码曾在 apps/web/public/legacy，解压不会删除旧文件），保留 .env
rm -rf apps packages deploy scripts
tar xzf /root/k408.tgz -C /opt/k408
find . -not -path "*/node_modules/*" \( -name .git -o -name "README.md" -o -name "CONTRIBUTING.md" -o -name "TODO.md" -o -iname "*.pdf" -o -iname "*outline*" -o -name "*.map" \) -prune -exec rm -rf {} + 2>/dev/null || true
test ! -e apps/web/public/legacy
# 3. .env：构建号、Go 模块代理（国内编译 Caddy 插件）
sed -i 's/^BUILD_ID=.*/BUILD_ID=__BUILD__/' .env
grep -q '^GOPROXY=' .env || echo 'GOPROXY=https://goproxy.cn,direct' >> .env
chmod 600 .env
grep -E '^(BUILD_ID|GOPROXY)=' .env
# 4. 后台串行构建 → 修 Caddy 数据卷属主（容器改为 uid 10001 运行）→ 启动
setsid -f sh -c '
  cd /opt/k408
  { docker compose build api && echo API_BUILT && docker compose build caddy && echo CADDY_BUILT \
    && docker run --rm -v k408_caddy_data:/d -v k408_caddy_config:/c --entrypoint sh postgres:16-alpine -c "chown -R 10001:10001 /d /c" && echo CHOWN_OK \
    && docker compose up -d && echo UP_OK; } > /root/d14.log 2>&1
  echo D14_DONE $? >> /root/d14.log' < /dev/null > /dev/null 2>&1
echo started
