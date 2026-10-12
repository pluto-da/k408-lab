# Build timeline JSON (shots, chapter titles, subtitles) + voice track for both formats from narration.json + measured TTS.
# usage: python3 build_timeline.py v|h
import json, subprocess, sys, os
from PIL import ImageFont
VER = sys.argv[1]
NAR = {sid: (txt, sub) for ver in ("v", "h") for sid, txt, sub in json.load(open("narration.json"))[ver]}
def tts_dur(sid):
    return float(subprocess.check_output(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", f"tts/{sid}.wav"]).decode())

R = "shots/ride2-d/"; SC = "shots/ride-d/sc"; PC = "shots/pc-d/"
LP = "shots/lab-p/"; LD = "shots/lab-d/"
ACC = "#7C9BFF"
FB = "/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc"

def still(p): return {"type": "still", "path": p}
def seq(d, **kw): s = {"type": "seq", "dir": d}; s.update(kw); return s

def wrap(text, size, maxw):
    f = ImageFont.truetype(FB, size, index=2)
    if f.getlength(text) <= maxw: return [text]
    import math
    n = math.ceil(f.getlength(text) / maxw)
    lines = []; rest = text
    for k in range(n - 1):
        target = f.getlength(rest) / (n - k)
        best, bi = 1e9, None
        for i in range(1, len(rest)):
            w = f.getlength(rest[:i])
            if w > maxw: break
            score = abs(w - target) - (400 if rest[i - 1] in "。？！" else 120 if rest[i - 1] in "，、：；·」" or rest[i - 1] == " " else 0)
            if rest[i] in "，。、：；？！）」”": score += 1000
            if score < best: best, bi = score, i
        lines.append(rest[:bi].strip()); rest = rest[bi:].strip()
    lines.append(rest)
    return lines

if VER == "v":
    W, H = 1080, 1920
    MB = [0, 300, 1080, 1000]  # media box: x,y,w,h
    def V(c0, c1=None): return {"c0": c0, "c1": c1 or c0, "box": MB}
    def bgimg(src, c0): return {"src": src, "c0": c0, "blur": 40, "dim": 0.84}
    # crop aspect for media box = 1.08
    SH = [
      # id, segments: list of (dur_fraction or fixed seconds, layer spec), chapter chip, headline
      ("V1", [(1.0, seq(SC, i0=24, i1=48, uniform=0.2, blend=0.19), [160, 40, 1100, 1019], [300, 200, 860, 796])], "考研 408", "背了十遍，还是想象不出来？"),
      ("V2", [(1.0, still("shots/home-p/full.png"), [0, 0, 1081, 1001], [0, 1150, 1081, 1001])], "考研408 动画实验室", "四门课，拆开来学"),
      ("V3", [(0.36, seq(LP + "sort-快速", speed=1.6, blend=0.2), [0, 35, 1081, 1001], [40, 70, 1001, 927]),
              (0.32, seq(LP + "paging", speed=1.5, blend=0.2), [0, 35, 1081, 1001], [40, 70, 1001, 927]),
              (0.32, seq(LP + "tcp", speed=2.2, blend=0.3, offset=0.5), [0, 35, 1081, 1001], [40, 70, 1001, 927])], "动画实验 · 39 个", "按一下，算法就动起来"),
      ("V4", [(0.55, still(PC + "overview.png"), [180, 40, 1100, 1019], [260, 110, 960, 889]),
              (0.45, still(PC + "explode-100.png"), [90, 50, 1100, 1019], [170, 110, 980, 907])], "整机拆解 3D", "一台能拆开的电脑"),
      ("V5", [(0.33, still(R + "st-02.png"), [130, 40, 1150, 1065], [160, 100, 1080, 1000]),
              (0.33, still(R + "st-05.png"), [110, 0, 1166, 1080], [150, 70, 1080, 1000]),
              (0.34, still(R + "st-08.png"), [180, 40, 1140, 1056], [230, 100, 1060, 981])], "化身数据 · 第一人称", "跟着一次访存走一遍"),
      ("V6", [(1.0, still("shots/ride2-p/summary.png"), "SUMV0", "SUMV1")], "结算卡", "每一站花了多少纳秒"),
      ("V7", [(1.0, still("shots/ride2-p/params.png"), "PARV0", "PARV1")], "参数可调 · 多端可用", "手机 · 平板 · 电脑，免费"),
      ("V8", [], None, None),
    ]
    SUB_SIZE, SUB_MAXW, SUB_Y, SUB_X = 50, 880, 1345, 510
else:
    W, H = 1920, 1080
    MB = [0, 0, 1920, 1080]
    def V(c0, c1=None): return {"c0": c0, "c1": c1 or c0, "box": MB}
    FULL = [0, 0, 1920, 1080]; Z3 = [60, 50, 1640, 923]  # zoom toward the 3D view
    LCARD = [0, 0, 1920, 1080]  # desktop lab card crop in 2880x1620 frames (16:9)
    SH = [
      ("H1", [(1.0, seq(SC, i0=18, i1=46, uniform=0.165, blend=0.16), FULL, [200, 140, 1280, 720])], "考研 408", "背了十遍，还是想象不出来？"),
      ("H2", [(1.0, seq(SC, i0=133, i1=162, uniform=0.27, blend=0.25), FULL, Z3)], None, None),
      ("H3", [(1.0, still("shots/home-d/full.png"), [0, 0, 1920, 1080], [0, 30, 1640, 923])], None, None),
      ("H4", [(1.0, still("shots/home-d/full.png"), [0, 720, 1920, 1080], [0, 1166, 1920, 1080])], None, None),
      ("H5", [(0.34, seq(LD + "sort-快速", speed=1.4, blend=0.18), LCARD, [60, 34, 1800, 1013]),
              (0.33, seq(LD + "paging", speed=1.3, blend=0.18), LCARD, [60, 34, 1800, 1013]),
              (0.33, seq(LD + "tcp", speed=1.1, blend=0.18, offset=1.0), "TCPC0", "TCPC1")], "动画实验 · 39 个", "单步、播放、改数据"),
      ("H6", [(0.4, still(PC + "overview.png"), FULL, Z3),
              (0.3, still(PC + "explode-100.png"), FULL, [100, 60, 1600, 900]),
              (0.3, still(PC + "open-CPU 与散热器-0.png"), [200, 60, 1500, 844], [380, 160, 1100, 619])], "整机拆解 3D", "一台能拆开的电脑"),
      ("H7", [(0.17, still(R + "st-01.png"), FULL, Z3),
              (0.23, seq(SC, i0=68, i1=100, uniform=0.075, blend=0.07), FULL, Z3),
              (0.2, still(R + "st-05.png"), FULL, Z3),
              (0.18, still(R + "st-07.png"), FULL, Z3),
              (0.22, still(R + "st-08.png"), FULL, Z3)], "化身数据 · 第一人称", "你就是那个虚拟地址"),
      ("H8", "SUMMARY", "结算卡", "每一站花了多少纳秒"),
      ("H9", "PARAMS", "参数可调", "改完重走一遍"),
      ("H10", "DEVICES", "多端可用", "手机 · 平板 · 电脑"),
      ("H11", [], None, None),
    ]
    SUB_SIZE, SUB_MAXW, SUB_Y, SUB_X = 46, 1500, 958, 960

CROPS = json.load(open("crops.json")) if os.path.exists("crops.json") else {}
shots, texts, subs, voice = [], [], [], []
t = 0.0
LEAD = 0.30; TAIL = 0.45
for sid, segs, chip, head in SH:
    d = tts_dur(sid)
    total = LEAD + d + TAIL
    if sid in ("V8", "H11"): total = LEAD + d + 1.6
    if sid in ("V1", "H1"): total = 0.25 + d + 0.4
    vstart = t + (0.25 if sid in ("V1", "H1") else LEAD)
    voice.append([sid, round(vstart, 3)])
    # subtitles: split by \n into chunks, proportional to chars
    sub = NAR[sid][1]
    if sub:
        chunks = [c.strip() for c in sub.split("\n") if c.strip()]
        n = sum(len(c) for c in chunks); ct = vstart
        for c in chunks:
            cd = d * len(c) / n
            subs.append({"lines": wrap(c, SUB_SIZE, SUB_MAXW), "x": SUB_X, "y": SUB_Y, "size": SUB_SIZE, "color": "#ffffff", "box": 0.62,
                         "start": round(ct, 3), "end": round(ct + cd + (0.0 if c is not chunks[-1] else 0.25), 3), "fade": 0.12, "rise": 0, "pad": [26, 14], "radius": 16})
            ct += cd
    # media shots
    if sid in ("V8", "H11"):
        shots.append({"id": sid, "dur": round(total, 3), "xf": 0.45, "endcard": True, "layers": [], "bg": "#0a0d17", "fadeout": 0.6})
    elif segs == "SUMMARY":
        shots.append({"id": sid, "dur": round(total, 3), "xf": 0.35, "bg": "#0e1322",
                      "bgimg": {"src": still(R + "summary.png"), "c0": [0, 0, 1920, 1080], "blur": 18, "dim": 0.55},
                      "layers": [{"src": still("shots/ride2-p/summary.png"), "c0": [24, 40, 1032, 1606], "c1": [44, 80, 992, 1543], "box": [684, 50, 552, 860], "radius": 26, "shadow": True}]})
    elif segs == "PARAMS":
        shots.append({"id": sid, "dur": round(total, 3), "xf": 0.35, "bg": "#0e1322",
                      "bgimg": {"src": still(R + "st-08.png"), "c0": [0, 0, 1920, 1080], "blur": 24, "dim": 0.6},
                      "layers": [{"src": still("shots/ride2-p/params.png"), "c0": [20, 560, 1040, 1656], "c1": [40, 640, 1000, 1592], "box": [690, 50, 540, 860], "radius": 26, "shadow": True}]})
    elif segs == "DEVICES":
        shots.append({"id": sid, "dur": round(total, 3), "xf": 0.35, "bg": "#0e1322", "devices": True,
                      "layers": [
                          {"src": still("shots/home-d/top.png"), "c0": [0, 0, 1920, 1080], "c1": [40, 22, 1840, 1035], "box": [150, 210, 1120, 630], "radius": 18, "shadow": True},
                          {"src": still("shots/home-p/top.png"), "c0": [0, 0, 1081, 2343], "c1": [0, 0, 1081, 2343], "box": [1390, 120, 380, 823], "radius": 36, "shadow": True}]})
    else:
        acc = 0.0
        for k, (frac, src, c0, c1) in enumerate(segs):
            sd = total * frac
            c0 = CROPS.get(c0, c0) if isinstance(c0, str) else c0
            c1 = CROPS.get(c1, c1) if isinstance(c1, str) else c1
            lay = {"src": src, "c0": c0, "c1": c1, "box": MB}
            sh = {"id": f"{sid}.{k}", "dur": round(sd, 3), "layers": [lay], "xf": 0.3 if (k == 0 and sid not in ("V1", "H1")) else (0.0 if sid in ("V5", "H7") else 0.25)}
            if VER == "v":
                sh["bgimg"] = bgimg(src, c0)
            if VER == "h" and sid == "H5":  # lab card on blurred backdrop
                sh["bgimg"] = {"src": src, "c0": c0, "blur": 36, "dim": 0.55}
                lay["box"] = [340, 200, 1300, 732]; lay["radius"] = 20; lay["shadow"] = True
            shots.append(sh)
    # chapter chip + headline
    if chip and VER == "v":
        big = sid == "V1"
        texts.append({"lines": [chip], "x": 510, "y": 128, "size": 34, "color": ACC, "start": round(t + 0.05, 3), "end": round(t + total - 0.05, 3), "fade": 0.2, "rise": 10})
        texts.append({"lines": wrap(head, 64 if not big else 70, 900), "x": 510, "y": 182, "size": 64 if not big else 70, "color": "#ffffff", "start": round(t + 0.1, 3), "end": round(t + total - 0.05, 3), "fade": 0.22, "rise": 16})
    if chip and VER == "h":
        texts.append({"lines": [chip], "x": 0, "y": 0, "size": 30, "color": ACC, "start": round(t + 0.1, 3), "end": round(t + total - 0.1, 3), "fade": 0.2, "rise": 0, "kind": "chip", "head": head, "big": sid == "H1"})
    t += total

TL = {"w": W, "h": H, "fps": 30, "shots": shots, "texts": texts, "subs": subs, "voice": voice, "total": round(t, 3), "ver": VER}
json.dump(TL, open(f"build/timeline-{VER}.json", "w"), ensure_ascii=False, indent=1)
print(VER, "total", round(t, 2), "shots", len(shots))
for s in shots: print(" ", s["id"], s["dur"])
