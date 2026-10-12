#!/bin/sh
# 用法：run-site.sh <输出名> [额外环境变量...]，例如 SITE_FAST=1 run-site.sh site2
cd /workspace/fullstack-408/apps/web
OUTN=${1:-site}
SITE_OUT=/workspace/work/v20/$OUTN node scripts/site-audit.cjs ${SITE_BASE:-http://127.0.0.1:4192} > /workspace/work/v20/$OUTN.log 2>&1
echo "AUDIT_EXIT $?" >> /workspace/work/v20/$OUTN.log
