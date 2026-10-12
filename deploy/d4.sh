set -e; cd /opt/k408
tar xzf /root/k408.tgz -C /opt/k408
sed -i 's/^BUILD_ID=.*/BUILD_ID=v10-3330c2f/' .env
docker compose up -d --build 2>&1 | tail -3; sleep 12
for p in / /lab /pc /api/health; do echo "$p $(curl -s -o /dev/null -w %{http_code} http://localhost$p)"; done
