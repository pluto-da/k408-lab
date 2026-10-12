# 前后对比拼图：左「改前（v17）」右「改后（v18）」
import sys, os
from PIL import Image, ImageDraw, ImageFont
D = "/workspace/work/v18"
font = None
for f in ["/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc", "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc"]:
    if os.path.exists(f):
        font = ImageFont.truetype(f, 22); break
pairs = [("tablet-tlb", "平板横屏 1210×680 · 第 2 站 TLB"), ("tablet-l1", "平板横屏 1210×680 · L1 站"), ("phone-tlb", "手机竖屏 393×732 · 第 2 站 TLB"), ("phone-l1", "手机竖屏 393×732 · L1 站"),
         ("phone-land-tlb", "手机横屏 852×273 · 第 2 站 TLB"), ("phone-land-l1", "手机横屏 852×273 · L1 站"), ("desktop-tlb", "电脑 1366×648 · 第 2 站 TLB"), ("desktop-l1", "电脑 1366×648 · L1 站")]
for k, title in pairs:
    a, b = os.path.join(D, "before", k + ".png"), os.path.join(D, k + ".png")
    if not (os.path.exists(a) and os.path.exists(b)): print("skip", k); continue
    A, B = Image.open(a).convert("RGB"), Image.open(b).convert("RGB")
    side = A.width < 900
    gap, top = 16, 44
    W = A.width + B.width + gap if side else max(A.width, B.width)
    H = (max(A.height, B.height) + top) if side else A.height + B.height + 2 * top + gap
    o = Image.new("RGB", (W, H), "#ffffff"); g = ImageDraw.Draw(o)
    if side:
        o.paste(A, (0, top)); o.paste(B, (A.width + gap, top))
        g.text((8, 8), "改前 v17 · " + title, fill="#b42318", font=font); g.text((A.width + gap + 8, 8), "改后 v18", fill="#067647", font=font)
    else:
        g.text((8, 8), "改前 v17 · " + title, fill="#b42318", font=font); o.paste(A, (0, top))
        y = top + A.height + gap; g.text((8, y + 8), "改后 v18", fill="#067647", font=font); o.paste(B, (0, y + top))
    o.save(os.path.join(D, "cmp-" + k + ".png")); print("ok", k, o.size)
