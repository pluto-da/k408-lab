#!/bin/sh
# v20 测试构建：带 __ride 检查接口 + 完整保护（混淆、文字表），输出到持久目录，托管在 4192
cd /workspace/fullstack-408/apps/web
T=/workspace/work/v20/tb
rm -rf $T
RIDE_AUDIT=1 K408_FP_OUT=/workspace/work/v20/fingerprints-test.json npx vite build --outDir $T --emptyOutDir > /workspace/work/v20/tb.log 2>&1
echo "BUILD_EXIT $?" >> /workspace/work/v20/tb.log
for p in $(ps -eo pid,args | grep "csp-serve.cjs" | grep -v grep | awk '{print $1}'); do kill $p; done
cd /workspace/work && setsid nohup node csp-serve.cjs $T 4192 > /workspace/work/v20/srv4192.log 2>&1 &
