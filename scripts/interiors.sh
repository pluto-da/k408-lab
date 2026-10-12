cd /workspace/fullstack-408/tools/pc-model
( for p in cpu ram ssd hdd; do blender -b -P build.py -- interior "$p" --samples 32 --lmax 2 > "build/$p.log" 2>&1; done ) &
( for p in gpu psu; do blender -b -P build.py -- interior "$p" --samples 32 --lmax 2 > "build/$p.log" 2>&1; done ) &
wait
( for p in nic board; do blender -b -P build.py -- interior "$p" --samples 32 --lmax 2 > "build/$p.log" 2>&1; done )
grep -h "\[glb\]\|Traceback\|Error" build/{cpu,ram,ssd,hdd,gpu,psu,nic,board}.log
