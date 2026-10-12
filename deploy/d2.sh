set -e; cd /opt/k408
tar xzf /root/k408.tgz -C /opt/k408
rm -f /opt/k408/apps/web/public/legacy/css/hark.css
rm -f /opt/k408/apps/web/public/legacy/js/00-hark.js
sed -i 's/^BUILD_ID=.*/BUILD_ID=v8-dcc02e6/' .env
docker compose up -d --build 2>&1 | tail -4; sleep 12; docker compose ps --format "{{.Name}} {{.Status}}"
for p in / /lab /pc /terms /privacy /api/health /legacy/manifest.json /nope; do echo "$p $(curl -s -o /dev/null -w %{http_code} http://localhost$p)"; done
