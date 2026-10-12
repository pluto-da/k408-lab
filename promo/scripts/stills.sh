#!/bin/bash
# usage: stills.sh v|h t1 t2 ...  -> build/test/<v>-<t>.png
V=$1; shift
for t in "$@"; do f=$(python3 -c "print(int($t*30))"); python3 compose.py build/timeline-$V.json build/test/$V-$t.png $f >/dev/null & done; wait
