# Covers: cover-9x16.png (1080x1920) and cover-16x9.png (1920x1080) from real site captures + title text.
from PIL import Image, ImageDraw, ImageFilter, ImageFont
import numpy as np
FB = "/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc"; FR = "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc"
def f(sz, b=True): return ImageFont.truetype(FB if b else FR, sz, index=2)
ACC = (124, 155, 255)

def grad(img, top, bottom, y0, y1):
    a = np.array(img).astype(np.float32); H = a.shape[0]
    for y in range(H):
        t = 0 if y < y0 else 1 if y > y1 else (y - y0) / (y1 - y0)
        a[y] = a[y] * (1 - t * bottom) if bottom else a[y]
    return Image.fromarray(a.clip(0, 255).astype(np.uint8))

def center(d, text, y, font, fill, W):
    w = d.textlength(text, font=font); d.text(((W - w) / 2, y), text, font=font, fill=fill)

# ---- 9:16
W, H = 1080, 1920
bg = Image.new("RGB", (W, H), "#0a0d17")
st = Image.open("shots/ride2-d/st-01.png").crop((150, 40, 1250, 1059)).resize((1080, 1000), Image.LANCZOS)
bg.paste(st, (0, 560))
pc = Image.open("shots/pc-d/explode-100.png").crop((90, 50, 1190, 1069)).resize((540, 500), Image.LANCZOS)
# soft fade edges of the 3D frame into background
m = Image.new("L", (1080, 1000), 255); dm = ImageDraw.Draw(m)
for i in range(120):
    a = int(255 * i / 120); dm.rectangle([0, i, 1080, i], fill=a); dm.rectangle([0, 999 - i, 1080, 999 - i], fill=a)
base = Image.new("RGB", (W, H), "#0a0d17"); base.paste(st, (0, 560), m); bg = base
d = ImageDraw.Draw(bg)
center(d, "考研 408 · 计组 / 操作系统 / 数据结构 / 网络", 190, f(36, False), ACC, W)
center(d, "408，", 270, f(150), (255, 255, 255), W)
center(d, "拆开来学", 440, f(150), (255, 255, 255), W)
# bottom block (kept above platform UI zone)
d.rounded_rectangle([90, 1590, 990, 1690], 50, fill=(92, 122, 255))
center(d, "化身数据，亲自走一遍访存", 1610, f(46), (255, 255, 255), W)
center(d, "考研408 动画实验室 · 154.8.183.93", 1730, f(38, False), (210, 216, 236), W)
bg.save("cover-9x16.png")

# ---- 16:9
W, H = 1920, 1080
img = Image.new("RGB", (W, H), "#0a0d17")
pcim = Image.open("shots/pc-d/explode-100.png").crop((80, 170, 1240, 1010)).resize((1491, 1080), Image.LANCZOS)
m = Image.new("L", pcim.size, 255); dm = ImageDraw.Draw(m)
for i2 in range(560): dm.rectangle([i2, 0, i2, 1080], fill=int(255 * (i2 / 560) ** 1.6))
img.paste(pcim, (640, 0), m)
d = ImageDraw.Draw(img)
d.text((110, 190), "考研 408 动画实验室", font=f(44, False), fill=ACC)
d.text((104, 260), "408，", font=f(150), fill=(255, 255, 255))
d.text((104, 440), "拆开来学", font=f(150), fill=(255, 255, 255))
d.text((112, 655), "39 个动画实验 · 整机拆解 3D", font=f(42, False), fill=(215, 220, 238))
d.text((112, 715), "化身数据，第一人称走完一次访存", font=f(42, False), fill=(215, 220, 238))
d.rounded_rectangle([110, 810, 610, 900], 45, fill=(92, 122, 255))
tw = d.textlength("154.8.183.93", font=f(52)); d.text((360 - tw / 2, 818), "154.8.183.93", font=f(52), fill=(255, 255, 255))
d.text((640, 828), "免费 · 手机平板电脑都能用", font=f(38, False), fill=(215, 220, 238))
img.save("cover-16x9.png")
print("covers ok")
