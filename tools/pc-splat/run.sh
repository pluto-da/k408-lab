#!/usr/bin/env bash
# Rebuild every /pc model from scratch: textures -> Blender model + bake -> SOG + manifest.
# Needs: blender (4.x, headless), a python3 with numpy/Pillow/scipy for Blender and for textures.py
#        (set PYTHON=/usr/bin/python3 if your default python lacks Pillow), node 20+.
# Takes ~4 min on 2 CPU cores. Output: apps/web/src/pc/assets/*.sog and apps/web/src/pc/manifest.json
set -euo pipefail
cd "$(dirname "$0")"
mkdir -p build
"${PYTHON:-python3}" textures.py
[ -d node_modules ] || npm install --no-audit --no-fund
blender -b -P build.py -- exterior "$@" > build/exterior.log 2>&1 &
( for p in cpu ram ssd hdd; do blender -b -P build.py -- interior "$p" > "build/$p.log" 2>&1; done ) &
wait
( for p in gpu psu; do blender -b -P build.py -- interior "$p" > "build/$p.log" 2>&1; done ) &
( for p in nic board; do blender -b -P build.py -- interior "$p" > "build/$p.log" 2>&1; done ) &
wait
grep -h "\[bake\]" build/*.log
node pack.mjs
