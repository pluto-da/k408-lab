#!/bin/sh
set -e
# 启动前执行数据库迁移（幂等）。
echo "[api] 执行数据库迁移…"
./node_modules/.bin/prisma migrate deploy
echo "[api] 启动服务"
exec node dist/server.js
