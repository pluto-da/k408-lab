#!/bin/bash
export PATH=$PATH
cd /workspace/fullstack-408
B=$(ls -d node_modules/.pnpm/@embedded-postgres+linux-arm64*/node_modules/@embedded-postgres/linux-arm64/native/bin)
D=$(mktemp -d)
$B/initdb -D $D -U pg --auth=trust >/dev/null 2>&1
$B/pg_ctl -D $D -o "-p 16997 -k /tmp" -l $D/log start >/dev/null; sleep 2
export DATABASE_URL=postgresql://pg@127.0.0.1:16997/postgres JWT_SECRET=e2e-secret-e2e-secret-e2e-secret-1234 LOG_LEVEL=warn AUTH_RATE_LIMIT_MAX=100
(cd apps/api && pnpm exec prisma migrate deploy >/dev/null 2>&1 && echo migrated)
(cd apps/api && setsid node dist/server.js > /tmp/api.log 2>&1 < /dev/null &)
(cd apps/web && setsid pnpm exec vite preview --port 4173 --strictPort > /tmp/web.log 2>&1 < /dev/null &)
sleep 4
curl -s localhost:3000/api/health; echo
CHROMIUM_PATH=/usr/bin/chromium NODE_PATH=/tmp/pw/node_modules timeout 300 node scripts/e2e-smoke.cjs http://localhost:4173 /tmp/shots
echo "e2e rc=$?"
kill $(pgrep -f "node dist/server.js") $(pgrep -f "vite preview") 2>/dev/null
$B/pg_ctl -D $D stop >/dev/null; rm -rf $D
