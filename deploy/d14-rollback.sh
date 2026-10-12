# 回滚到 v19：恢复源码与 .env，镜像换回 v19 标签，不重新构建直接启动。用法：sed "s/__TS__/<备份时间戳>/" d14-rollback.sh | python3 rx.py
set -e; cd /opt/k408
rm -rf apps packages deploy scripts docker-compose.yml
tar xzf /root/k408-src-v19-__TS__.tgz -C /opt/k408
cp -a /root/k408.env.v19-__TS__ .env
docker tag k408-web:v19 k408-web:latest
docker tag k408-api:v19 k408-api:latest
docker compose up -d --no-build --force-recreate
sleep 10; docker compose ps --format "{{.Name}} {{.Status}}"
for p in / /lab /pc /api/health; do echo "$p $(curl -s -o /dev/null -w %{http_code} http://localhost$p)"; done
