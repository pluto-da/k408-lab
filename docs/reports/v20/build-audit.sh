#!/bin/sh
# 测试构建（带 __ride 检查接口）到 /tmp/rd-after，并在 4182 端口托管
cd /workspace/fullstack-408/apps/web
rm -rf /tmp/rd-after
RIDE_AUDIT=1 npx vite build --outDir /tmp/rd-after > /tmp/rd-after.log 2>&1
echo "BUILD_EXIT $?" >> /tmp/rd-after.log
pkill -f "csp-serve.cjs /tmp/rd-after" 2>/dev/null
cd /workspace/work && setsid nohup node csp-serve.cjs /tmp/rd-after 4182 > /tmp/srv4182.log 2>&1 &
