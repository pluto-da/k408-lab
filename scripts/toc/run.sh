#!/bin/bash
# usage: run.sh <timeout> node script args...
T=$1; shift
rm -rf /workspace/work/toc/dist-after/legacy && cp -r /workspace/fullstack-408/apps/web/public/legacy /workspace/work/toc/dist-after/legacy
cd /workspace/fullstack-408/apps/web
timeout $((T+8)) npx vite preview --outDir /workspace/work/toc/dist-after --port 4177 --strictPort > /tmp/prev.log 2>&1 &
for i in $(seq 1 20); do curl -s -o /dev/null localhost:4177 && break; sleep 0.5; done
cd /workspace/work/toc && timeout $T "$@"
