#!/bin/bash
# usage: render.sh v|h [chunks]   (run in background) -> promo-9x16.mp4 / promo-16x9.mp4
V=$1; K=${2:-3}
cd /workspace/work/promo
python3 build_timeline.py $V > build/tl-$V.log && python3 mix.py $V > build/mix-$V.log 2>&1 || { echo "mix failed"; exit 1; }
NF=$(python3 -c "import json;t=json.load(open('build/timeline-$V.json'));print(int(round(t['total']*30)))")
rm -f build/chunk-$V-*.mp4
for i in $(seq 0 $((K-1))); do a=$((NF*i/K)); b=$((NF*(i+1)/K)); python3 compose.py build/timeline-$V.json build/chunk-$V-$i.mp4 $a $b > build/chunk-$V-$i.log 2>&1 & done; wait
: > build/list-$V.txt; for i in $(seq 0 $((K-1))); do echo "file 'chunk-$V-$i.mp4'" >> build/list-$V.txt; done
OUT=promo-9x16.mp4; [ "$V" = h ] && OUT=promo-16x9.mp4
ffmpeg -y -loglevel error -f concat -safe 0 -i build/list-$V.txt -i build/audio-$V.wav -map 0:v -map 1:a -c:v copy -c:a aac -b:a 192k -ar 48000 -shortest -movflags +faststart /tmp/$OUT && cp /tmp/$OUT $OUT && echo "RENDER DONE $OUT" || echo "RENDER FAILED"
