cd /opt/k408; sleep 5
docker compose ps --format "{{.Name}} {{.Status}}"
for p in / /lab /pc /api/health; do echo "$p $(curl -s -o /dev/null -w %{http_code} http://localhost$p)"; done
grep ^BUILD_ID .env; curl -s localhost/api/health; echo
echo "maps in caddy /srv: $(docker compose exec -T caddy sh -c 'find /srv -name "*.map" | wc -l')"
echo "maps in api: $(docker compose exec -T api sh -c 'find /app/dist -name "*.map" | wc -l')"
docker compose exec -T caddy sh -c 'grep -c "1023px" /srv/legacy/css/legacy-16.css'
find / -xdev \( -path /proc -o -path /var/lib/docker -o -path "*/node_modules" \) -prune -o \( -path "/opt/k408/*" -a \( -name .git -o -iname "*.pdf" -o -name "*.map" -o -name "*.md" \) \) -print 2>/dev/null | head
rm -f /root/k408.tgz; ls /root
