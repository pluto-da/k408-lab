#!/bin/sh
cd /workspace/fullstack-408/apps/web
RIDE_OUT=/workspace/work/v19/audit node scripts/ride-audit.cjs http://127.0.0.1:4182 > /workspace/work/v19/audit.log 2>&1
echo "AUDIT_EXIT $?" >> /workspace/work/v19/audit.log
