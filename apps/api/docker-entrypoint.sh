#!/bin/sh
set -e
# 启动前执行数据库迁移（幂等）。题库、流程等种子数据由服务启动时自动同步。
echo "[api] 执行数据库迁移…"
./node_modules/.bin/prisma migrate deploy
echo "[api] 启动服务"
exec node dist/server.js
