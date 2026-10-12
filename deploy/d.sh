set -e
cd /opt/k408
rm -rf apps packages deploy scripts tools
tar xzf /root/k408.tgz -C /opt/k408
sed -i 's/^BUILD_ID=.*/BUILD_ID=v8-dcc02e6/' .env #
docker compose up -d --build 2>&1 | tail -6
sleep 15; docker compose ps --format "{{.Name}} {{.Status}}"
docker compose logs api --tail 15 | grep -i -E "migrat|error" | tail -5
for p in / /pc /lab /terms /privacy /api/health /nope /legacy/manifest.json; do echo "$p $(curl -s -o /dev/null -w %{http_code} http://localhost$p)"; done
