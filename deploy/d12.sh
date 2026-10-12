# v18 deploy (run: python3 up.py && python3 rx.py < d10.sh). Build runs detached via setsid (ssh session may drop); poll /root/d10.log for BUILD_DONE.
set -e; cd /opt/k408
tar xzf /root/k408.tgz -C /opt/k408
echo "--- removing dev docs / git / pdf / outline / source maps:"
find . -not -path "*/node_modules/*" \( -name .git -o -name "README.md" -o -name "CONTRIBUTING.md" -o -name "TODO.md" -o -iname "*.pdf" -o -iname "*outline*" -o -name "*.map" \) -print -exec rm -rf {} + 2>/dev/null || true
echo "---"
sed -i 's/^BUILD_ID=.*/BUILD_ID=v18-516667f/' .env
setsid -f sh -c 'docker compose up -d --build > /root/d10.log 2>&1; echo BUILD_DONE $? >> /root/d10.log' < /dev/null > /dev/null 2>&1
# afterwards (d10c.sh): container status, / /lab /pc /api/health codes, map counts in caddy /srv and api /app/dist, rm /root/k408.tgz
