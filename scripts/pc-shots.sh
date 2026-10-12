#!/bin/bash
cd /workspace/work
i=0
for p in "$@"; do
  i=$((i+1))
  timeout 600 node pc-shot.cjs "${BASE:-http://127.0.0.1:4180/pc?dpr=1&debug}" /workspace/work/pc-shots "$p" > "/tmp/shot_$i.log" 2>&1
done
echo done > /tmp/shots_done
