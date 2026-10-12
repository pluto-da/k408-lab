# 前后对比拼图：上 / 左「改前 v18」，下 / 右「改后 v19」
import os
from PIL import Image, ImageDraw, ImageFont
D = "/workspace/work/v19"
def F(sz):
    for f in ["/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc", "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc"]:
        if os.path.exists(f):
            return ImageFont.truetype(f, sz)
    return None
font = F(22)
pairs = [
    ("tablet-tlb", "tablet-02-tlb", "平板横屏 1210×680 · 第 2 站 查快表 TLB"),
    ("tablet-l1", "tablet-08-l1", "平板横屏 1210×680 · 第 8 站 L1 比较标记"),
    ("tablet-l2", "tablet-09-l2", "平板横屏 1210×680 · 第 9 站 L2"),
    ("phone-tlb", "phone-02-tlb", "手机竖屏 393×732 · 第 2 站 TLB"),
    ("phone-l1", "phone-08-l1", "手机竖屏 393×732 · 第 8 站 L1"),
    ("phone-l2", "phone-09-l2", "手机竖屏 393×732 · 第 9 站 L2"),
    ("phone-land-tlb", "phone-land-02-tlb", "手机横屏 852×273 · 第 2 站 TLB"),
    ("phone-land-l1", "phone-land-08-l1", "手机横屏 852×273 · 第 8 站 L1"),
    ("desktop-tlb", "desktop-02-tlb", "电脑 1366×640 · 第 2 站 TLB"),
    ("desktop-l1", "desktop-08-l1", "电脑 1366×640 · 第 8 站 L1"),
    ("desktop-l2", "desktop-09-l2", "电脑 1366×640 · 第 9 站 L2"),
    ("tablet-portrait-tlb", "tablet-portrait-02-tlb", "平板竖屏 820×1060 · 第 2 站 TLB"),
    ("desktop-xl-tlb", "desktop-xl-02-tlb", "大屏 1920×960 · 第 2 站 TLB"),
]
for k, f, title in pairs:
    a, b = os.path.join(D, "before", f + ".png"), os.path.join(D, "after", f + ".png")
    if not (os.path.exists(a) and os.path.exists(b)):
        print("skip", k); continue
    A, B = Image.open(a).convert("RGB"), Image.open(b).convert("RGB")
    side = A.width < 900
    gap, top = 16, 44
    W = A.width + B.width + gap if side else max(A.width, B.width)
    H = (max(A.height, B.height) + top) if side else A.height + B.height + 2 * top + gap
    o = Image.new("RGB", (W, H), "#ffffff"); g = ImageDraw.Draw(o)
    if side:
        o.paste(A, (0, top)); o.paste(B, (A.width + gap, top))
        g.text((8, 8), "改前 v18", fill="#b42318", font=font); g.text((A.width + gap + 8, 8), "改后 v19 · " + title, fill="#067647", font=font)
    else:
        g.text((8, 8), "改前 v18 · " + title, fill="#b42318", font=font); o.paste(A, (0, top))
        y = top + A.height + gap; g.text((8, y + 8), "改后 v19", fill="#067647", font=font); o.paste(B, (0, y + top))
    o.save(os.path.join(D, "cmp-" + k + ".png")); print("ok", k, o.size)

# 结算卡（改后）：平板 / 电脑 / 手机竖屏 / 手机横屏 拼成一张
items = [("tablet-summary", "平板横屏 1210×680"), ("desktop-summary", "电脑 1366×640"), ("phone-summary", "手机竖屏 393×732"), ("phone-land-summary", "手机横屏 852×273")]
ims = [(Image.open(os.path.join(D, "after", f + ".png")).convert("RGB"), t) for f, t in items if os.path.exists(os.path.join(D, "after", f + ".png"))]
if ims:
    top, gap = 40, 16
    row1 = [x for x in ims if x[0].width >= 900]
    row2 = [x for x in ims if x[0].width < 900]
    W = max(sum(i.width for i, _ in row1) + gap * (len(row1) - 1), sum(i.width for i, _ in row2) + gap * (len(row2) - 1))
    h1 = max([i.height for i, _ in row1] or [0]) + top
    h2 = max([i.height for i, _ in row2] or [0]) + top
    o = Image.new("RGB", (W, 56 + h1 + gap + h2), "#ffffff"); g = ImageDraw.Draw(o)
    g.text((8, 8), "改后 v19 · 结算卡（旅程小结）", fill="#067647", font=F(26))
    x, y = 0, 56
    for im, t in row1:
        g.text((x + 8, y + 6), t, fill="#344054", font=font); o.paste(im, (x, y + top)); x += im.width + gap
    x, y = 0, 56 + h1 + gap
    for im, t in row2:
        g.text((x + 8, y + 6), t, fill="#344054", font=font); o.paste(im, (x, y + top)); x += im.width + gap
    o.save(os.path.join(D, "summary.png")); print("ok summary", o.size)
