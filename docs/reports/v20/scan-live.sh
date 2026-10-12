#!/bin/bash
# v20 线上敏感词扫描：
#  1. curl 抓取页面、从 index.html 递归抓全部 /assets/ 分块；
#  2. 从分块里找出哈希命名的旧版模块清单（legacy/<hash>.json），按清单抓全部文件（含编码文字表 .bin）；
#  3. 用 scripts/check-sources.mjs 扫描下载目录（会按清单密钥解码文字表、解码混淆字符串数组后再扫）；
#  4. 用浏览器渲染各页面（实验室逐个打开实验、图解、性质），导出渲染后的全部文字再扫一遍。
# 用法：scan-live.sh [BASE] [OUT]
set -u
BASE=${1:-http://154.8.183.93}
OUT=${2:-/tmp/live20}
rm -rf "$OUT"; mkdir -p "$OUT/pages" "$OUT/assets" "$OUT/legacy" "$OUT/rendered"
UA="Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"
get() { curl -s -A "$UA" -e "$BASE/" --max-time 60 -o "$2" -w "%{http_code}" "$1"; }
n=0
for p in / /lab /pc /pc?ride=access /login /register /terms /privacy /robots.txt /manifest.webmanifest; do
  f="$OUT/pages/$(echo "$p" | tr '/?=' '___')"; case "$p" in *.txt) f="$f.txt";; *.webmanifest) f="$f.webmanifest";; *) f="$f.html";; esac
  c=$(get "$BASE$p" "$f"); echo "page $p $c"; n=$((n+1))
done
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
# 旧版模块清单：分块里 "<10 位十六进制>.json" 形式的常量
MAN=$(grep -ohE '"[0-9a-f]{10}\.json"' "$OUT"/assets/*.js | tr -d '"' | sort -u | head -1)
echo "legacy manifest: ${MAN:-未找到}"
fail=0; ln=0
if [ -n "$MAN" ]; then
  c=$(get "$BASE/legacy/$MAN" "$OUT/legacy/$MAN"); echo "legacy manifest $c"; n=$((n+1))
  for p in $(grep -oE '[0-9a-f]{10}\.(js|css|html|bin|glb)' "$OUT/legacy/$MAN" | sort -u); do
    ln=$((ln+1)); c=$(get "$BASE/legacy/$p" "$OUT/legacy/$p"); n=$((n+1))
    [ "$c" != "200" ] && { echo "legacy $p $c"; fail=$((fail+1)); }
  done
fi
echo "legacy files listed: $ln, non-200: $fail"
echo "downloaded total: $n"
cd /workspace/fullstack-408 && node scripts/check-sources.mjs "$OUT/pages" "$OUT/assets" "$OUT/legacy"; R1=$?
echo "--- 渲染后文字"
node /workspace/work/v20/render-text.cjs "$BASE" "$OUT/rendered"; R0=$?
node scripts/check-sources.mjs "$OUT/rendered"; R2=$?
echo "SCAN_RESULT files=$R1 rendered=$R2 render_exit=$R0"
