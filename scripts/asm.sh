cd /workspace/fullstack-408/tools/pc-model
for p in "$@"; do blender -b -P build.py -- interior $p --noglb --preview --samples 12 --asm > build/asm_$p.log 2>&1 & done; wait
