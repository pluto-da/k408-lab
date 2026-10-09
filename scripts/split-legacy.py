#!/usr/bin/env python3
"""把旧版单页 index.html 拆成 apps/web/public/legacy/ 下的独立文件（一次性迁移工具）。

注意：拆分后在 js/ 中手工加入了学习事件钩子（LAB_EMIT，见 js/00-bridge.js 及各文件中
“LAB_EMIT” 处）和按 GLB 文件加载主板模型的改动；另外手工删除了流程答题模式
（生成的 js/11-play.js、manifest 中对应条目、body.html 里的 data-play 按钮及 legacy-03.css 中的相关样式）。
重新运行本脚本会覆盖这些改动，需要重新打补丁。

用法: python3 scripts/split-legacy.py <旧站目录> <GLB 文件>
输出:
  legacy/body.html            页面主体（去掉 script/style）
  legacy/css/*.css            内联样式与原有样式表
  legacy/js/NN-*.js           内联脚本，保持原顺序
  legacy/vendor/*.js          第三方库（本地文件）
  legacy/assets/motherboard.glb
  legacy/manifest.json        加载顺序
"""
import json, os, re, shutil, sys

src_dir, glb = sys.argv[1], sys.argv[2]
out = os.path.join(os.path.dirname(__file__), "..", "apps", "web", "public", "legacy")
out = os.path.abspath(out)
for d in ("css", "js", "vendor", "assets"):
    os.makedirs(os.path.join(out, d), exist_ok=True)

html = open(os.path.join(src_dir, "index.html"), encoding="utf-8").read()
head, body = html.split("<body>", 1)
body = body.rsplit("</body>", 1)[0]

# 注意：这是最初拆分旧版单页时用的一次性脚本。public/legacy 之后已有多处手工修改与压缩
#（模型压缩、移除无用样式与已下线模块等），重新运行会覆盖这些修改，仅作留档。
css = ["css/hark.css"]
for f in ("hark.css",):
    shutil.copy(os.path.join(src_dir, f), os.path.join(out, "css", f))

n_style = 0
def save_style(text):
    global n_style
    n_style += 1
    name = f"css/legacy-{n_style:02d}.css"
    open(os.path.join(out, name), "w", encoding="utf-8").write(text.strip() + "\n")
    css.append(name)

for m in re.finditer(r"<style>(.*?)</style>", head, re.S):
    save_style(m.group(1))

VENDOR = {"three.min.js", "OrbitControls.js", "GLTFLoader.js", "RoomEnvironment.js"}
NAMES = ["x408-data", "chapters", "shared", "hero", "explode", "flow", "hero-extras", "lab", None, "graph", "play"]  # None：已下线的模块，不再输出
scripts, n_js = [], 0
pos = 0
token = re.compile(r"<script(?: src=\"([^\"]+)\")?>(.*?)</script>|<style>(.*?)</style>", re.S)
clean = []
for m in token.finditer(body):
    clean.append(body[pos:m.start()])
    pos = m.end()
    if m.group(3) is not None:
        save_style(m.group(3)); continue
    src, code = m.group(1), m.group(2)
    if src:
        if src == "motherboard-data.js":
            continue  # 改为直接加载 GLB 文件
        if src in VENDOR:
            shutil.copy(os.path.join(src_dir, src), os.path.join(out, "vendor", src))
            scripts.append("vendor/" + src)
        elif src == "hark.js":
            shutil.copy(os.path.join(src_dir, src), os.path.join(out, "js", "00-hark.js"))
            scripts.append("js/00-hark.js")
        else:
            raise SystemExit("unknown script " + src)
    else:
        name = NAMES[n_js] if n_js < len(NAMES) else f"part{n_js}"
        n_js += 1
        if name is None:
            continue
        fn = f"js/{n_js:02d}-{name}.js"
        open(os.path.join(out, fn), "w", encoding="utf-8").write(code.strip("\n") + "\n")
        scripts.append(fn)
clean.append(body[pos:])
body_html = re.sub(r"\n\s*\n+", "\n", "".join(clean)).strip() + "\n"
open(os.path.join(out, "body.html"), "w", encoding="utf-8").write(body_html)
shutil.copy(glb, os.path.join(out, "assets", "motherboard.glb"))
json.dump({"css": css, "scripts": scripts, "glb": "assets/motherboard.glb"},
          open(os.path.join(out, "manifest.json"), "w"), ensure_ascii=False, indent=2)
print(json.dumps({"css": css, "scripts": scripts}, indent=1))
