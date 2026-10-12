# Frame-accurate compositor: shots (stills with Ken Burns / timestamped frame sequences) + titles + burned subtitles.
# usage: python3 compose.py <timeline.json> <out_video_noaudio.mp4> [start_frame end_frame]
import json, sys, os, math, glob, subprocess
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter

FONT_B = "/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc"
FONT_R = "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc"
_fc = {}
def font(sz, bold=True):
    k = (sz, bold)
    if k not in _fc: _fc[k] = ImageFont.truetype(FONT_B if bold else FONT_R, sz, index=2)
    return _fc[k]

TL = json.load(open(sys.argv[1])); OUT = sys.argv[2]
W, H, FPS = TL["w"], TL["h"], TL["fps"]
shots = TL["shots"]; subs = TL.get("subs", []); texts = TL.get("texts", [])
total = sum(s["dur"] for s in shots)
# shot start times; each shot (except first) crossfades in over its "xf" seconds overlapping previous end
t = 0.0
for s in shots:
    s["t0"] = t; t += s["dur"]
NF = int(round(total * FPS))
f0 = int(sys.argv[3]) if len(sys.argv) > 3 else 0
f1 = int(sys.argv[4]) if len(sys.argv) > 4 else NF

def ease(x): x = min(max(x, 0.0), 1.0); return x * x * (3 - 2 * x)

_img = {}
def load(path):
    if path not in _img:
        _img[path] = Image.open(path).convert("RGB")
        if len(_img) > 120: _img.pop(next(iter(_img)))
    return _img[path]

def seq_frames(src):
    if "_seq" not in src:
        idxf = os.path.join(src["dir"], "index.json")
        if os.path.exists(idxf):
            fr = json.load(open(idxf)); ts = [x[1] - fr[0][1] for x in fr]; fs = [x[0] for x in fr]
        else:
            fs = sorted(glob.glob(os.path.join(src["dir"], "*.jpg")))
            mt = [os.path.getmtime(f) for f in fs]; ts = [m - mt[0] for m in mt]
        a, b = src.get("i0", 0), src.get("i1", len(fs))
        fs, ts = fs[a:b], ts[a:b]; ts = [x - ts[0] for x in ts]
        if src.get("uniform"): ts = [i * src["uniform"] for i in range(len(fs))]
        src["_seq"] = (fs, ts)
    return src["_seq"]

def source_image(src, lt):
    """return PIL image of the source at local time lt (seconds)"""
    if src["type"] == "still":
        return load(src["path"])
    fs, ts = seq_frames(src)
    st = lt * src.get("speed", 1.0) + src.get("offset", 0.0)
    if src.get("loop") and ts[-1] > 0: st = st % (ts[-1] + 0.6)
    i = max(0, np.searchsorted(ts, st, side="right") - 1)
    if i >= len(fs) - 1: return load(fs[-1])
    bw = src.get("blend", 0.0)
    if bw <= 0: return load(fs[i])
    nxt = ts[i + 1]; seg = nxt - ts[i]; bw = min(bw, seg)
    a = (st - (nxt - bw)) / bw
    if a <= 0: return load(fs[i])
    return Image.blend(load(fs[i]), load(fs[i + 1]), ease(a))

def render_layer(L, lt, dur):
    src = L["src"]; im = source_image(src, lt)
    # crop rect animates from c0 to c1 (x,y,w,h in source pixels)
    c0 = L.get("c0") or [0, 0, im.width, im.height]; c1 = L.get("c1") or c0
    p = ease(lt / dur) if L.get("ease", True) else min(max(lt / dur, 0), 1)
    c = [c0[k] + (c1[k] - c0[k]) * p for k in range(4)]
    box = L.get("box") or [0, 0, W, H]  # destination x,y,w,h
    bw, bh = int(box[2]), int(box[3])
    sx = c[2] / bw; sy = c[3] / bh
    out = im.transform((bw, bh), Image.AFFINE, (sx, 0, c[0], 0, sy, c[1]), resample=Image.BICUBIC if sx < 1.2 else Image.BILINEAR)
    if sx > 1.6:  # strong downscale: antialias with a reduce first
        out = im.crop(tuple(int(v) for v in (c[0], c[1], c[0] + c[2], c[1] + c[3]))).resize((bw, bh), Image.LANCZOS)
    return out, box

def rounded_mask(w, h, r):
    m = Image.new("L", (w, h), 0); ImageDraw.Draw(m).rounded_rectangle([0, 0, w - 1, h - 1], r, fill=255); return m

def render_shot(s, lt):
    if s.get("endcard"): return render_endcard(lt, s["dur"])
    bg = s.get("bg", "#0b0f1a")
    canvas = Image.new("RGB", (W, H), bg)
    if s.get("bgimg"):
        b = s["bgimg"]; im, _ = render_layer({"src": b["src"], "c0": b.get("c0"), "c1": b.get("c1")}, lt, s["dur"])
        im = im.filter(ImageFilter.GaussianBlur(b.get("blur", 30)))
        im = Image.blend(im, Image.new("RGB", im.size, bg), b.get("dim", 0.55))
        canvas.paste(im, (0, 0))
    for L in s["layers"]:
        im, box = render_layer(L, lt, s["dur"])
        if L.get("radius"):
            r = L["radius"]
            if L.get("shadow"):
                sh = Image.new("L", (W, H), 0); ImageDraw.Draw(sh).rounded_rectangle([box[0], box[1] + 12, box[0] + box[2], box[1] + box[3] + 12], r, fill=150)
                sh = sh.filter(ImageFilter.GaussianBlur(24))
                canvas = Image.composite(Image.new("RGB", (W, H), "#000000"), canvas, sh)
            canvas.paste(im, (int(box[0]), int(box[1])), rounded_mask(im.width, im.height, r))
        else:
            canvas.paste(im, (int(box[0]), int(box[1])))
    return canvas

def draw_text_block(img, lines, cx, y, size, color, bold=True, box_alpha=0, pad=(28, 16), maxw=None, anchor_center=True, line_gap=1.32, box_color=(10, 14, 26), stroke=0, radius=18):
    d = ImageDraw.Draw(img, "RGBA"); f = font(size, bold)
    widths = [d.textlength(l, font=f) for l in lines]
    lh = int(size * line_gap); tw = max(widths) if widths else 0; th = lh * len(lines)
    if box_alpha:
        x0 = cx - tw / 2 - pad[0]; y0 = y - pad[1]
        d.rounded_rectangle([x0, y0, cx + tw / 2 + pad[0], y + th + pad[1] - (lh - size) * 0.6], radius, fill=box_color + (int(255 * box_alpha),))
    for i, l in enumerate(lines):
        x = cx - widths[i] / 2 if anchor_center else cx
        d.text((x, y + i * lh - size * 0.12), l, font=f, fill=color, stroke_width=stroke, stroke_fill=(0, 0, 0, 200))
    return th

def render_endcard(lt, dur):
    img = Image.new("RGB", (W, H), "#0a0d17")
    # soft radial glow
    yy, xx = np.mgrid[0:H, 0:W]
    cx, cy = W / 2, H * (0.46 if H > W else 0.47)
    r = np.sqrt(((xx - cx) / (W * 0.55)) ** 2 + ((yy - cy) / (H * 0.42)) ** 2)
    g = np.clip(1 - r, 0, 1) ** 2
    arr = np.array(img).astype(np.float32)
    arr += g[..., None] * np.array([40, 52, 110], np.float32)
    img = Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8))
    a1 = ease(lt / 0.5); a2 = ease((lt - 0.35) / 0.5); a3 = ease((lt - 0.7) / 0.5)
    layer = Image.new("RGBA", (W, H), (0, 0, 0, 0)); d = ImageDraw.Draw(layer)
    vert = H > W
    s_name, s_url, s_sub = (72, 116, 34) if vert else (64, 112, 32)
    y_name = (cy - 210) if vert else (cy - 170)
    # logo mark: rounded square with "408"
    mk = 92 if vert else 84
    def A(col, a): return col + (int(255 * a),)
    d.rounded_rectangle([cx - mk / 2, y_name - mk - 40 + (1 - a1) * 14, cx + mk / 2, y_name - 40 + (1 - a1) * 14], 22, fill=A((92, 122, 255), a1))
    f = font(34 if vert else 32); tw = d.textlength("408", font=f)
    d.text((cx - tw / 2, y_name - mk / 2 - 40 - 24 + (1 - a1) * 14), "408", font=f, fill=A((255, 255, 255), a1))
    f = font(s_name); tw = d.textlength("考研408 动画实验室", font=f)
    d.text((cx - tw / 2, y_name + (1 - a1) * 14), "考研408 动画实验室", font=f, fill=A((255, 255, 255), a1))
    f = font(s_url); url = "154.8.183.93"; tw = d.textlength(url, font=f)
    yu = y_name + s_name * 1.7 + (1 - a2) * 16
    d.text((cx - tw / 2, yu), url, font=f, fill=A((124, 155, 255), a2))
    f = font(s_sub, False); sub = "浏览器直接打开 · 免费 · 手机平板电脑都能用"; tw = d.textlength(sub, font=f)
    d.text((cx - tw / 2, yu + s_url * 1.45 + (1 - a3) * 10), sub, font=f, fill=A((200, 208, 230), a3))
    img.paste(layer, (0, 0), layer)
    return img

def draw_chip(img, T, lt):
    a = min(ease(lt / 0.25), ease((T["_dur"] - lt) / 0.25))
    if a <= 0: return img
    big = T.get("big", False)
    layer = Image.new("RGBA", img.size, (0, 0, 0, 0)); d = ImageDraw.Draw(layer)
    fc = font(30); fh = font(64 if big else 50)
    x0, y0 = 72, 60 + (1 - ease(lt / 0.3)) * 10
    w = max(d.textlength(T["lines"][0], font=fc), d.textlength(T["head"], font=fh)) + 64
    hgt = 30 + 14 + (64 if big else 50) + 52
    d.rounded_rectangle([x0, y0, x0 + w, y0 + hgt], 22, fill=(10, 13, 24, 190))
    d.rectangle([x0 + 22, y0 + 30, x0 + 27, y0 + 58], fill=(124, 155, 255, 255))
    d.text((x0 + 40, y0 + 22), T["lines"][0], font=fc, fill=(124, 155, 255, 255))
    d.text((x0 + 32, y0 + 64), T["head"], font=fh, fill=(255, 255, 255, 255))
    if a < 1: layer.putalpha(layer.split()[3].point(lambda v: int(v * a)))
    img.paste(layer, (0, 0), layer)
    return img

def overlay_text(img, T, lt):
    if T.get("kind") == "chip": return draw_chip(img, T, lt)
    # T: {lines, x(center), y, size, color, start, end, box, kind, fade}
    a_in = ease((lt) / T.get("fade", 0.25)); a_out = ease((T["_dur"] - lt) / T.get("fade", 0.25))
    a = min(a_in, a_out)
    if a <= 0: return img
    layer = Image.new("RGBA", img.size, (0, 0, 0, 0))
    dy = (1 - a_in) * T.get("rise", 18)
    col = T.get("color", "#ffffff")
    if T.get("kind") == "endcard":
        pass
    draw_text_block(layer, T["lines"], T["x"], T["y"] + dy, T["size"], col, T.get("bold", True), T.get("box", 0), maxw=None, stroke=T.get("stroke", 0), radius=T.get("radius", 18), pad=tuple(T.get("pad", (28, 16))))
    if a < 1:
        al = layer.split()[3].point(lambda v: int(v * a)); layer.putalpha(al)
    img.paste(layer, (0, 0), layer)
    return img

def frame_at(fi):
    tt = fi / FPS
    # find current shot
    k = 0
    for i, s in enumerate(shots):
        if s["t0"] <= tt: k = i
    s = shots[k]; lt = tt - s["t0"]
    img = render_shot(s, lt)
    # crossfade from previous shot during first xf seconds of this shot
    xf = s.get("xf", 0)
    if k > 0 and xf > 0 and lt < xf:
        p = shots[k - 1]
        prev = render_shot(p, p["dur"] + lt)  # previous shot continues (layer time beyond its dur clamps via ease)
        img = Image.blend(prev, img, ease(lt / xf))
    if s.get("fadein") and lt < s["fadein"]:
        img = Image.blend(Image.new("RGB", (W, H), "#000000"), img, ease(lt / s["fadein"]))
    if s.get("fadeout") and s["dur"] - lt < s["fadeout"]:
        img = Image.blend(Image.new("RGB", (W, H), "#000000"), img, ease((s["dur"] - lt) / s["fadeout"]))
    for T in texts + subs:
        if T["start"] <= tt < T["end"]:
            T["_dur"] = T["end"] - T["start"]
            img = overlay_text(img, T, tt - T["start"])
    return img

cmd = ["ffmpeg", "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-",
       "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-pix_fmt", "yuv420p", "-profile:v", "high", "-r", str(FPS), OUT]
if OUT.endswith(".png"):
    frame_at(f0).save(OUT); print("saved still", OUT); sys.exit(0)
pp = subprocess.Popen(cmd, stdin=subprocess.PIPE)
for fi in range(f0, f1):
    pp.stdin.write(frame_at(fi).tobytes())
    if fi % 60 == 0: print("frame", fi, "/", f1, flush=True)
pp.stdin.close(); pp.wait()
print("done", OUT, f1 - f0, "frames")
