#!/bin/bash
# 线上敏感词扫描：抓取线上页面、主 bundle、全部 assets 分块与 /legacy/manifest.json 列出的全部文件（用 curl），
# 再用 scripts/check-sources.mjs 的同一套 RULES 扫描下载目录。
set -u
BASE=${1:-http://154.8.183.93}
OUT=${2:-/tmp/live19}
rm -rf "$OUT"; mkdir -p "$OUT/pages" "$OUT/assets" "$OUT/legacy"
UA="Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/124 Safari/537.36"
get() { curl -s -A "$UA" --max-time 60 -o "$2" -w "%{http_code}" "$1"; }
n=0
for p in / /lab /pc /pc?ride=access /login /register /terms /privacy /robots.txt /manifest.webmanifest; do
  f="$OUT/pages/$(echo "$p" | tr '/?=' '___')"; case "$p" in *.txt) f="$f.txt";; *.webmanifest) f="$f.webmanifest";; *) f="$f.html";; esac
  c=$(get "$BASE$p" "$f"); echo "page $p $c"; n=$((n+1))
done
# 主 bundle 与全部分块：从 index.html 起，递归找 /assets/ 引用
grep -oE '/assets/[A-Za-z0-9._-]+\.(js|css)' "$OUT/pages/_.html" | sort -u > "$OUT/queue.txt"
touch "$OUT/seen.txt"
while [ -s "$OUT/queue.txt" ]; do
  a=$(head -1 "$OUT/queue.txt"); sed -i 1d "$OUT/queue.txt"
  grep -qxF "$a" "$OUT/seen.txt" && continue
  echo "$a" >> "$OUT/seen.txt"
  f="$OUT/assets/$(basename "$a")"
  c=$(get "$BASE$a" "$f"); n=$((n+1))
  [ "$c" != "200" ] && echo "asset $a $c"
  grep -oE '(/assets/|\./|assets/)[A-Za-z0-9._-]+\.(js|css)' "$f" 2>/dev/null | sed -E 's#^(\./|assets/|/assets/)#/assets/#' | sort -u | while read -r x; do grep -qxF "$x" "$OUT/seen.txt" || echo "$x" >> "$OUT/queue.txt"; done
done
echo "assets: $(wc -l < "$OUT/seen.txt")"
# legacy：manifest.json 列出的全部文件
c=$(get "$BASE/legacy/manifest.json" "$OUT/legacy/manifest.json"); echo "legacy manifest $c"; n=$((n+1))
python3 - "$OUT/legacy/manifest.json" > "$OUT/legacy-list.txt" <<'PY'
import json, sys
d = json.load(open(sys.argv[1]))
out = set()
def walk(x):
    if isinstance(x, str):
        if "/" in x or "." in x:
            out.add(x)
    elif isinstance(x, list):
        for y in x: walk(y)
    elif isinstance(x, dict):
        for y in x.values(): walk(y)
walk(d)
for p in sorted(out):
    p = p.lstrip("./").lstrip("/")
    if p.startswith("legacy/"): p = p[7:]
    if any(p.lower().endswith(e) for e in (".js", ".css", ".html", ".json", ".svg", ".txt", ".mjs", ".xml", ".md", ".webmanifest", ".glb", ".png", ".jpg", ".jpeg", ".webp", ".woff2", ".ktx2", ".bin", ".hdr", ".wasm", ".sog")):
        print(p)
PY
fail=0; ln=0
while read -r p; do
  [ -z "$p" ] && continue
  ln=$((ln+1)); mkdir -p "$OUT/legacy/$(dirname "$p")"
  c=$(get "$BASE/legacy/$p" "$OUT/legacy/$p"); n=$((n+1))
  [ "$c" != "200" ] && { echo "legacy $p $c"; fail=$((fail+1)); }
done < "$OUT/legacy-list.txt"
echo "legacy files listed: $ln, non-200: $fail"
echo "downloaded total: $n"
cd /workspace/fullstack-408 && node scripts/check-sources.mjs "$OUT"
