#!/usr/bin/env bash
# Rebuild every /pc model from scratch: textures -> Blender model + Cycles AO bake -> GLB -> meshopt GLB + WebP + manifest.
# Needs: blender (4.x, headless), a python3 with numpy/Pillow (set PYTHON=/usr/bin/python3 if your default python lacks them), node 20+.
# Takes ~6 min on 2 CPU cores. Output: apps/web/src/pc/assets/* and apps/web/src/pc/manifest.json
# Optional: PREVIEW=1 also renders Cycles studio previews into build/preview/.
set -euo pipefail
cd "$(dirname "$0")"
mkdir -p build
"${PYTHON:-python3}" textures.py
[ -d node_modules ] || npm install --no-audit --no-fund
P=${PREVIEW:+--preview}
blender -b -P build.py -- exterior --samples 32 --lmax 2.5 $P > build/exterior.log 2>&1 &
( for p in cpu ram ssd hdd; do blender -b -P build.py -- interior "$p" --samples 32 --lmax 2 $P > "build/$p.log" 2>&1; done ) &
wait
( for p in gpu psu; do blender -b -P build.py -- interior "$p" --samples 32 --lmax 2 $P > "build/$p.log" 2>&1; done ) &
( for p in nic board; do blender -b -P build.py -- interior "$p" --samples 32 --lmax 2 $P > "build/$p.log" 2>&1; done ) &
wait
cat build/exterior.log build/{cpu,ram,ssd,hdd,gpu,psu,nic,board}.log | grep -h "\[glb\]" || true
PYTHON="${PYTHON:-python3}" node pack.mjs
