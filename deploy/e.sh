set -e
cd /opt/k408
grep -q '^CONTACT_EMAIL=' .env && sed -i 's/^CONTACT_EMAIL=.*/CONTACT_EMAIL=wda151050@gmail.com/' .env || echo 'CONTACT_EMAIL=wda151050@gmail.com' >> .env
docker compose up -d --build caddy 2>&1 | tail -2
sleep 8
for p in / /privacy /api/health; do echo "$p $(curl -s -o /dev/null -w %{http_code} http://localhost$p)"; done
grep -rl "wda151050@gmail.com" $(docker compose exec -T caddy sh -c 'ls -d /srv 2>/dev/null || ls -d /usr/share/caddy') 2>/dev/null | head -2 || true
docker compose exec -T caddy sh -c 'grep -rl wda151050 /srv /usr/share/caddy 2>/dev/null | head -2'
