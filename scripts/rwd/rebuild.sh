#!/bin/bash
cd /workspace/fullstack-408/apps/web
for p in $(ps -eo pid,args | grep "[v]ite preview --port 4176" | awk '{print $1}'); do kill $p; done
timeout 110 npx vite build --outDir /workspace/work/rwd/dist-after --emptyOutDir > /workspace/work/rwd/build.log 2>&1 || { tail -20 /workspace/work/rwd/build.log; exit 1; }
tail -1 /workspace/work/rwd/build.log
setsid nohup npx vite preview --port 4176 --host 127.0.0.1 --outDir /workspace/work/rwd/dist-after --strictPort > /workspace/work/rwd/prev-after.log 2>&1 < /dev/null &
sleep 3; curl -s -o /dev/null -w "preview %{http_code}\n" http://127.0.0.1:4176/lab
