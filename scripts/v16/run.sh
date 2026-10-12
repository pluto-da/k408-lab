#!/bin/bash
# usage: run.sh <secs> cmd...   (serves apps/web/dist on 4178 for the duration)
T=$1; shift
cd /workspace/fullstack-408/apps/web
pkill -f "vite preview --port 4178" 2>/dev/null
timeout $((T+5)) npx vite preview --port 4178 --strictPort --host 127.0.0.1 > /tmp/p16.log 2>&1 &
for i in $(seq 1 30); do curl -s -o /dev/null 127.0.0.1:4178 && break; sleep 0.5; done
cd /workspace/work/v16 && timeout $T "$@"
