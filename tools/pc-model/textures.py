"""Procedural textures for the PC model (PCB traces, die floorplan, platter tracks, labels).

Run with the system python (needs Pillow + numpy):  python3 tools/pc-model/textures.py
Writes PNGs into tools/pc-model/build/tex/ (used by Blender) and tileable finish maps. All artwork is original and generated here.
"""
import math
import os
import random

from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "build", "tex")
os.makedirs(OUT, exist_ok=True)

FONT_DIR = "/usr/share/fonts/truetype/dejavu/"


def font(size, bold=False, mono=False):
    name = "DejaVuSansMono" if mono else "DejaVuSans"
    if bold:
        name += "-Bold"
    return ImageFont.truetype(FONT_DIR + name + ".ttf", size)


def save(img, name):
    img.save(os.path.join(OUT, name))
    print("tex", name, img.size)


# ---------------------------------------------------------------- motherboard
def motherboard():
    # board: 244 mm (x, from rear I/O edge toward front) x 305 mm (y, from bottom up)
    S = 8  # px per mm
    W, H = 244 * S, 305 * S
    img = Image.new("RGB", (W, H), (25, 29, 35))
    d = ImageDraw.Draw(img)
    rnd = random.Random(7)

    def P(x, y):  # mm (origin bottom-left) -> px
        return (x * S, (305 - y) * S)

    def rect(x0, y0, x1, y1, **kw):
        a, b = P(x0, y1), P(x1, y0)
        d.rectangle([a, b], **kw)

    def text(x, y, s, size=2.4, fill=(214, 216, 210), anchor="lm", bold=False):
        d.text(P(x, y), s, font=font(int(size * S), bold=bold), fill=fill, anchor=anchor)

    trace = (40, 47, 56)
    trace_hi = (52, 62, 74)
    # subtle ground pour texture
    for _ in range(9000):
        x, y = rnd.uniform(0, 244), rnd.uniform(0, 305)
        d.point(P(x, y), fill=(24, 27, 32))
    # generic meandering traces everywhere (background routing)
    for _ in range(420):
        x, y = rnd.uniform(5, 240), rnd.uniform(5, 300)
        pts = [P(x, y)]
        for _ in range(rnd.randint(2, 5)):
            if rnd.random() < 0.5:
                x += rnd.uniform(-30, 30)
            else:
                y += rnd.uniform(-30, 30)
            x = min(max(x, 3), 241)
            y = min(max(y, 3), 302)
            pts.append(P(x, y))
        d.line(pts, fill=trace, width=max(2, int(0.25 * S)))
        d.ellipse([pts[-1][0] - 4, pts[-1][1] - 4, pts[-1][0] + 4, pts[-1][1] + 4], fill=(70, 66, 50))

    # CPU socket at (95, 225); DIMMs at x=150..180, y 160..300
    cpu = (95, 225)
    # memory bus: dense parallel bundle CPU -> DIMMs
    for i in range(36):
        y0 = 205 + i * 1.15
        x_mid = 128 + (i % 6) * 0.6
        pts = [P(cpu[0] + 24, y0), P(x_mid, y0), P(x_mid + 6, 170 + i * 3.4), P(186, 170 + i * 3.4)]
        d.line(pts, fill=trace_hi, width=int(0.32 * S))
    # PCIe x16 lanes: CPU -> slot at y=130 (traces go down)
    for i in range(24):
        x0 = 72 + i * 1.2
        d.line([P(x0, 205), P(x0, 160), P(40 + i * 3.2, 140), P(40 + i * 3.2, 134)], fill=trace_hi, width=int(0.3 * S))
    # M.2 lanes: CPU -> M.2 at y=152 region
    for i in range(8):
        y = 196 - i * 1.3
        d.line([P(110, y), P(126 + i * 1.2, y), P(126 + i * 1.2, 158)], fill=trace_hi, width=int(0.3 * S))
    # DMI: CPU -> chipset (170, 70)
    for i in range(10):
        x0 = 112 + i * 1.3
        d.line([P(x0, 205), P(x0, 150), P(160 + i * 1.6, 112), P(160 + i * 1.6, 92)], fill=trace_hi, width=int(0.3 * S))
    # chipset -> SATA (front edge, y 40..90)
    for i in range(10):
        y = 60 + i * 2.5
        d.line([P(190, 70 + (i - 5) * 1.2), P(212, y), P(232, y)], fill=trace_hi, width=int(0.3 * S))
    # chipset -> lower x1 slot (NIC)
    for i in range(4):
        d.line([P(150, 64 + i * 1.3), P(110, 54 + i * 1.3), P(70, 54 + i * 1.3)], fill=trace_hi, width=int(0.3 * S))

    # vias
    for _ in range(2600):
        x, y = rnd.uniform(4, 240), rnd.uniform(4, 301)
        c = P(x, y)
        d.ellipse([c[0] - 3, c[1] - 3, c[0] + 3, c[1] + 3], fill=(92, 84, 58))

    white = (222, 224, 218)
    # socket keep-out outline
    rect(cpu[0] - 34, cpu[1] - 34, cpu[0] + 34, cpu[1] + 34, outline=white, width=3)
    text(cpu[0] - 33, cpu[1] - 38, "CPU1  LGA", 2.6)
    # DIMM labels
    for i, lab in enumerate(["DDR5_A1", "DDR5_A2", "DDR5_B1", "DDR5_B2"]):
        x = 152 + i * 9.5
        text(x, 156, lab, 2.0, anchor="lm")
    rect(146, 158, 190, 302, outline=(120, 122, 118), width=2)
    text(26, 141, "PCIE_X16_1  (CPU · Gen5)", 2.6)
    text(26, 118, "PCIE_X1_1", 2.2)
    text(26, 96, "PCIE_X16_2  (Chipset)", 2.2)
    text(26, 60, "PCIE_X1_2", 2.2)
    text(58, 164, "M.2_1  PCIe 4.0 x4  2280", 2.4)
    text(170, 98, "CHIPSET", 2.6, anchor="mm")
    text(236, 96, "SATA3", 2.4, anchor="mm")
    for i in range(4):
        text(240, 42 + i * 13.5 + 6, str(i + 1), 2.0, anchor="mm")
    text(232, 255, "ATX_24P", 2.2, anchor="mm")
    text(28, 300, "EPS_8P", 2.0)
    text(70, 293, "CPU_FAN", 1.9)
    text(210, 120, "SYS_FAN2", 1.9)
    text(200, 10, "F_PANEL", 2.0)
    text(150, 10, "USB3_F", 2.0)
    text(14, 10, "HD_AUDIO", 2.0)
    text(200, 24, "BIOS", 1.9)
    text(122, 34, "ATX  305 x 244 mm   REV 1.0", 2.4, fill=(170, 172, 166))
    text(48, 270, "VRM 16+1+1", 1.9, fill=(170, 172, 166))
    # component outlines (resistor arrays)
    for _ in range(260):
        x, y = rnd.uniform(10, 230), rnd.uniform(10, 295)
        w, h = rnd.choice([(1.6, 0.8), (0.8, 1.6), (2.0, 1.2)])
        rect(x, y, x + w, y + h, fill=(150, 140, 110))
        rect(x + 0.3, y, x + w - 0.3, y + h, fill=(32, 32, 34))
    # mounting holes (ATX positions approx.)
    for (hx, hy) in [(6, 299), (6, 140), (6, 25), (163, 299), (163, 140), (163, 25), (238, 299), (238, 140), (238, 25)]:
        c = P(hx, hy)
        r = 4 * S
        d.ellipse([c[0] - r, c[1] - r, c[0] + r, c[1] + r], fill=(196, 170, 96))
        r2 = 1.8 * S
        d.ellipse([c[0] - r2, c[1] - r2, c[0] + r2, c[1] + r2], fill=(30, 30, 30))
    save(img, "mobo.png")


# ---------------------------------------------------------------- CPU die floorplan
DIE_W, DIE_H = 18.0, 10.0  # mm


def die():
    S = 110
    W, H = int(DIE_W * S), int(DIE_H * S)
    img = Image.new("RGB", (W, H), (46, 40, 52))
    d = ImageDraw.Draw(img)
    rnd = random.Random(3)

    def R(x0, y0, x1, y1, fill, outline=None):
        d.rectangle([x0 * S, (DIE_H - y1) * S, x1 * S, (DIE_H - y0) * S], fill=fill, outline=outline, width=3)

    def grid(x0, y0, x1, y1, base, step=0.12, line=None):
        R(x0, y0, x1, y1, base)
        line = line or tuple(max(0, c - 28) for c in base)
        x = x0
        while x < x1:
            d.line([x * S, (DIE_H - y1) * S, x * S, (DIE_H - y0) * S], fill=line, width=1)
            x += step
        y = y0
        while y < y1:
            d.line([x0 * S, (DIE_H - y) * S, x1 * S, (DIE_H - y) * S], fill=line, width=1)
            y += step

    def noise(x0, y0, x1, y1, base, n=900, spread=26):
        R(x0, y0, x1, y1, base)
        for _ in range(n):
            x, y = rnd.uniform(x0, x1), rnd.uniform(y0, y1)
            w, h = rnd.uniform(0.04, 0.3), rnd.uniform(0.04, 0.2)
            w, h = min(w, x1 - x), min(h, y1 - y)
            k = rnd.uniform(-spread, spread)
            c = tuple(int(min(255, max(0, v + k))) for v in base)
            d.rectangle([x * S, (DIE_H - y - h) * S, (x + w) * S, (DIE_H - y) * S], fill=c)

    # regions (colours match the callouts in the web module)
    ALU = (232, 132, 52)
    CU = (70, 120, 220)
    L1 = (130, 210, 120)
    L2 = (40, 150, 90)
    L3 = (34, 170, 170)
    IMC = (150, 90, 200)
    IO = (210, 180, 70)
    RING = (235, 235, 240)
    # memory controller (left)
    noise(0.3, 0.6, 2.6, 9.4, IMC)
    # IO / PCIe (right)
    noise(15.4, 0.6, 17.7, 9.4, IO)
    # L3 in the middle band
    grid(2.9, 4.0, 15.1, 6.0, L3, 0.1)
    # ring bus
    R(2.9, 3.85, 15.1, 4.0, RING)
    R(2.9, 6.0, 15.1, 6.15, RING)
    # 8 cores: 4 top, 4 bottom
    cw = (15.1 - 2.9) / 4
    for row, (y0, y1) in enumerate([(6.3, 9.4), (0.6, 3.7)]):
        for i in range(4):
            x0 = 2.9 + i * cw + 0.08
            x1 = x0 + cw - 0.16
            R(x0, y0, x1, y1, (30, 28, 36))
            # L2 band adjacent to L3
            if row == 0:
                grid(x0 + 0.1, y0 + 0.1, x1 - 0.1, y0 + 0.9, L2, 0.08)
                ya, yb = y0 + 1.0, y1 - 0.1
            else:
                grid(x0 + 0.1, y1 - 0.9, x1 - 0.1, y1 - 0.1, L2, 0.08)
                ya, yb = y0 + 0.1, y1 - 1.0
            mx = (x0 + x1) / 2
            noise(x0 + 0.1, ya, mx - 0.05, yb, ALU, n=260)
            noise(mx + 0.05, (ya + yb) / 2 + 0.05, x1 - 0.1, yb, CU, n=160)
            grid(mx + 0.05, ya, x1 - 0.1, (ya + yb) / 2 - 0.05, L1, 0.06)
    # die seal ring
    d.rectangle([4, 4, W - 5, H - 5], outline=(180, 170, 150), width=6)
    save(img, "die.png")


# ---------------------------------------------------------------- generic dark chip top with marking
def chip(name, lines, size=(1024, 512), bg=(22, 22, 25), fg=(150, 150, 150), dot=True):
    img = Image.new("RGB", size, bg)
    d = ImageDraw.Draw(img)
    rnd = random.Random(len(name))
    for _ in range(4000):
        x, y = rnd.randrange(size[0]), rnd.randrange(size[1])
        v = rnd.randint(-6, 6)
        d.point((x, y), fill=tuple(max(0, c + v) for c in bg))
    n = len(lines)
    fs = int(size[1] * 0.16)
    for i, s in enumerate(lines):
        d.text((size[0] / 2, size[1] * (0.5 + (i - (n - 1) / 2) * 0.24)), s, font=font(fs, bold=(i == 0)), fill=fg, anchor="mm")
    if dot:
        r = size[1] * 0.06
        d.ellipse([size[1] * 0.08, size[1] * 0.08, size[1] * 0.08 + 2 * r, size[1] * 0.08 + 2 * r], fill=tuple(c + 25 for c in bg))
    save(img, name)


def label(name, size, bg, fg, lines, accent=None, bar=None):
    img = Image.new("RGB", size, bg)
    d = ImageDraw.Draw(img)
    if accent:
        d.rectangle([0, 0, size[0], int(size[1] * 0.12)], fill=accent)
    if bar:
        d.rectangle([0, int(size[1] * 0.88), size[0], size[1]], fill=bar)
    y = size[1] * 0.22
    for s, rel, bold in lines:
        fs = int(size[1] * rel)
        d.text((size[0] * 0.06, y), s, font=font(fs, bold=bold), fill=fg, anchor="lm")
        y += fs * 1.35
    save(img, name)


# ---------------------------------------------------------------- HDD platter (tracks + sectors)
def platter():
    N = 2048
    img = Image.new("RGB", (N, N), (0, 0, 0))
    d = ImageDraw.Draw(img)
    c = N / 2
    R = N / 2 - 2
    r_in = R * 0.30
    # brushed mirror base: radial gradient
    for i in range(int(R), 0, -2):
        t = i / R
        v = int(150 + 70 * math.sin(t * 9.0) * 0.25 + 40 * t)
        d.ellipse([c - i, c - i, c + i, c + i], fill=(v, v + 2, v + 6))
    # tracks
    k = 0
    r = R * 0.97
    while r > r_in:
        tone = (120, 124, 132) if k % 2 else (190, 194, 202)
        d.ellipse([c - r, c - r, c + r, c + r], outline=tone, width=2)
        r -= 9
        k += 1
    # highlighted track (current cylinder)
    rt = R * 0.66
    d.ellipse([c - rt, c - rt, c + rt, c + rt], outline=(255, 140, 40), width=16)
    # sector boundaries
    for s in range(32):
        a = s / 32 * math.tau
        d.line([c + r_in * math.cos(a), c + r_in * math.sin(a), c + R * 0.97 * math.cos(a), c + R * 0.97 * math.sin(a)], fill=(96, 100, 110), width=3)
    # highlighted sector on the highlighted track
    a0, a1 = 0.0, math.tau / 32
    pts = []
    for j in range(12):
        a = a0 + (a1 - a0) * j / 11
        pts.append((c + (rt + 30) * math.cos(a), c + (rt + 30) * math.sin(a)))
    for j in range(12):
        a = a1 - (a1 - a0) * j / 11
        pts.append((c + (rt - 30) * math.cos(a), c + (rt - 30) * math.sin(a)))
    d.polygon(pts, fill=(60, 150, 255))
    # hub area
    d.ellipse([c - r_in, c - r_in, c + r_in, c + r_in], fill=(170, 172, 178))
    save(img, "platter.png")


# ---------------------------------------------------------------- DRAM bank array
def banks():
    W, H = 2048, 1024
    img = Image.new("RGB", (W, H), (18, 20, 26))
    d = ImageDraw.Draw(img)
    cols = [(48, 92, 170), (40, 120, 160), (56, 84, 150), (44, 110, 176)]
    for bi in range(8):
        gx, gy = bi % 4, bi // 4
        x0, y0 = 40 + gx * 500, 60 + gy * 480
        x1, y1 = x0 + 460, y0 + 400
        base = cols[bi % 4]
        d.rectangle([x0, y0, x1, y1], fill=base)
        for y in range(y0, y1, 8):
            d.line([x0, y, x1, y], fill=tuple(c - 18 for c in base), width=2)
        for x in range(x0, x1, 24):
            d.line([x, y0, x, y1], fill=tuple(c - 10 for c in base), width=1)
        # row decoder + sense amps
        d.rectangle([x0 - 22, y0, x0 - 6, y1], fill=(170, 170, 70))
        d.rectangle([x0, y1 + 6, x1, y1 + 26], fill=(200, 110, 60))
        d.text((x0 + 12, y0 + 12), f"BANK {bi}", font=font(34, bold=True), fill=(235, 238, 245))
    # active row in bank 2
    x0, y0 = 40 + 2 * 500, 60
    d.rectangle([x0, y0 + 200, x0 + 460, y0 + 212], fill=(255, 200, 60))
    save(img, "banks.png")


# ---------------------------------------------------------------- other boards
def pcb(name, size_mm, color, trace, S=10, seed=1, pads=None, texts=()):
    W, H = int(size_mm[0] * S), int(size_mm[1] * S)
    img = Image.new("RGB", (W, H), color)
    d = ImageDraw.Draw(img)
    rnd = random.Random(seed)
    for _ in range(int(size_mm[0] * size_mm[1] / 12)):
        x, y = rnd.uniform(0, W), rnd.uniform(0, H)
        pts = [(x, y)]
        for _ in range(rnd.randint(2, 4)):
            if rnd.random() < 0.5:
                x += rnd.uniform(-25, 25) * S
            else:
                y += rnd.uniform(-25, 25) * S
            pts.append((x, y))
        d.line(pts, fill=trace, width=max(2, int(0.3 * S)))
    # vias: sparse, tented (solder mask over copper reads darker than bare gold)
    via = tuple(int(c * 0.55 + t * 0.6) for c, t in zip(color, trace))
    for _ in range(int(size_mm[0] * size_mm[1] / 45)):
        x, y = rnd.uniform(0, W), rnd.uniform(0, H)
        r = 0.25 * S
        d.ellipse([x - r, y - r, x + r, y + r], fill=via)
    for (s, x, y, fs) in texts:
        d.text((x * S, (size_mm[1] - y) * S), s, font=font(int(fs * S)), fill=(230, 230, 225), anchor="lm")
    save(img, name)


def fan_hub():
    N = 512
    img = Image.new("RGB", (N, N), (24, 24, 27))
    d = ImageDraw.Draw(img)
    d.ellipse([20, 20, N - 20, N - 20], fill=(34, 34, 38), outline=(70, 70, 76), width=6)
    d.text((N / 2, N / 2 - 30), "120", font=font(110, bold=True), fill=(170, 170, 175), anchor="mm")
    d.text((N / 2, N / 2 + 70), "12V DC", font=font(54), fill=(130, 130, 135), anchor="mm")
    save(img, "fanhub.png")


def front_mesh():
    W, H = 840, 1840  # 210 x 460 mm @4
    img = Image.new("RGB", (W, H), (26, 27, 30))
    d = ImageDraw.Draw(img)
    for row in range(0, H, 14):
        off = 7 if (row // 14) % 2 else 0
        for col in range(off, W, 14):
            d.ellipse([col - 4, row - 4, col + 4, row + 4], fill=(12, 12, 14))
    save(img, "frontmesh.png")


def io_panel():
    W, H = 400, 1600  # 20 x 160mm (two-sided label strip for rear I/O shield)
    img = Image.new("RGB", (W, H), (40, 42, 46))
    save(img, "io.png")


def pads(name, size_mm, bg, pad, pitch, r, S=24, border=0.0, field=None):
    W, H = int(size_mm[0] * S), int(size_mm[1] * S)
    img = Image.new("RGB", (W, H), bg)
    d = ImageDraw.Draw(img)
    fx0, fy0, fx1, fy1 = field or (border, border, size_mm[0] - border, size_mm[1] - border)
    y = fy0 + pitch / 2
    row = 0
    while y < fy1:
        x = fx0 + pitch / 2 + (pitch / 2 if row % 2 else 0)
        while x < fx1:
            d.ellipse([(x - r) * S, (y - r) * S, (x + r) * S, (y + r) * S], fill=pad)
            x += pitch
        y += pitch * 0.866
        row += 1
    save(img, name)


def substrate():
    S = 40
    W, H = int(45 * S), int(37.5 * S)
    img = Image.new("RGB", (W, H), (38, 92, 58))
    d = ImageDraw.Draw(img)
    rnd = random.Random(5)
    for _ in range(500):
        x, y = rnd.uniform(0, W), rnd.uniform(0, H)
        pts = [(x, y)]
        for _ in range(3):
            if rnd.random() < 0.5:
                x += rnd.uniform(-3, 3) * S
            else:
                y += rnd.uniform(-3, 3) * S
            pts.append((x, y))
        d.line(pts, fill=(50, 112, 72), width=3)
    for _ in range(300):
        x, y = rnd.uniform(0, W), rnd.uniform(0, H)
        d.ellipse([x - 5, y - 5, x + 5, y + 5], fill=(200, 170, 90))
    d.text((2 * S, H - 2 * S), "8C/16T  LGA  e3", font=font(int(1.4 * S)), fill=(220, 225, 215), anchor="lm")
    d.polygon([(0, H), (3 * S, H), (0, H - 3 * S)], fill=(220, 180, 80))
    save(img, "substrate.png")


def ihs():
    S = 40
    N = int(29 * S)
    img = Image.new("RGB", (N, N), (206, 206, 210))
    d = ImageDraw.Draw(img)
    rnd = random.Random(1)
    for _ in range(9000):
        x, y = rnd.uniform(0, N), rnd.uniform(0, N)
        v = rnd.randint(196, 214)
        d.line([(x, y), (x + rnd.uniform(5, 30), y)], fill=(v, v, v + 3))
    for i, (s_, fs) in enumerate([("8-CORE PROCESSOR", 1.6), ("16 THREADS  5.0 GHz", 1.3), ("CACHE 32MB L3", 1.3)]):
        d.text((N / 2, N * 0.4 + i * 2.4 * S), s_, font=font(int(fs * S), bold=(i == 0)), fill=(130, 132, 138), anchor="mm")
    save(img, "ihs.png")


def nic_die():
    W, H = 1440, 720
    img = Image.new("RGB", (W, H), (30, 30, 36))
    d = ImageDraw.Draw(img)
    rnd = random.Random(4)
    for (x0, x1, base, lab) in [(20, 700, (60, 110, 210), "MAC"), (740, 1420, (225, 130, 50), "PHY")]:
        d.rectangle([x0, 20, x1, H - 20], fill=base)
        for _ in range(900):
            x, y = rnd.uniform(x0, x1 - 20), rnd.uniform(20, H - 40)
            k = rnd.randint(-28, 28)
            c = tuple(max(0, min(255, v + k)) for v in base)
            d.rectangle([x, y, x + rnd.uniform(6, 30), y + rnd.uniform(4, 18)], fill=c)
        d.text(((x0 + x1) / 2, H / 2), lab, font=font(150, bold=True), fill=(250, 250, 252), anchor="mm")
    d.rectangle([700, 20, 740, H - 20], fill=(235, 235, 240))
    save(img, "nic_die.png")


# ---------------------------------------------------------------- tileable finish maps (height maps, grey)
def _tile_noise(n, scale, seed):
    import numpy as np
    rng = np.random.default_rng(seed)
    f = np.fft.fft2(rng.standard_normal((n, n)))
    ky = np.fft.fftfreq(n)[:, None]
    kx = np.fft.fftfreq(n)[None, :]
    return f, kx, ky, rng


def finish_maps():
    import numpy as np
    n = 512
    # brushed metal: long streaks along u
    f, kx, ky, rng = _tile_noise(n, 1, 3)
    filt = np.exp(-(kx / 0.004) ** 2 - (ky / 0.35) ** 2)
    h = np.real(np.fft.ifft2(f * filt))
    h = (h - h.mean()) / (h.std() + 1e-9)
    img = np.clip(128 + h * 34, 0, 255).astype(np.uint8)
    Image.fromarray(img, "L").save(os.path.join(OUT, "fin_brushed.png"))
    # powder coat: fine isotropic orange-peel
    f, kx, ky, rng = _tile_noise(n, 1, 5)
    k = np.sqrt(kx ** 2 + ky ** 2)
    h = np.real(np.fft.ifft2(f * np.exp(-(k / 0.06) ** 2)))
    h = (h - h.mean()) / (h.std() + 1e-9)
    img = np.clip(128 + h * 40, 0, 255).astype(np.uint8)
    Image.fromarray(img, "L").save(os.path.join(OUT, "fin_powder.png"))
    # braided sleeving: diagonal over/under weave
    y, x = np.mgrid[0:n, 0:n] / n
    a = (x + y) * 16 % 1.0
    b = (x - y) * 16 % 1.0
    ca = (np.floor((x + y) * 16) + np.floor((x - y) * 16)) % 2
    strand = lambda t: np.sin(np.pi * t) ** 0.6
    hgt = np.where(ca > 0.5, strand(a) * 0.9 + 0.1 * strand(b * 6 % 1), strand(b) * 0.9 + 0.1 * strand(a * 6 % 1))
    fib = 0.08 * np.sin((x + y) * 16 * 6 * np.pi * 2)
    img = np.clip((hgt + fib) * 220 + 20, 0, 255).astype(np.uint8)
    Image.fromarray(img, "L").save(os.path.join(OUT, "fin_braid.png"))
    # perforated mesh (front/top filter): hex holes
    m = Image.new("L", (n, n), 200)
    d = ImageDraw.Draw(m)
    step = n / 16
    for j in range(-1, 18):
        for i in range(-1, 18):
            cx = i * step + (step / 2 if j % 2 else 0)
            cy = j * step * 0.866
            r = step * 0.36
            d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=10)
    m.save(os.path.join(OUT, "fin_mesh.png"))
    print("tex finish maps")


def fins(name, n, horizontal):
    k = 10
    if horizontal:
        img = Image.new("RGB", (n * k, 8), (60, 62, 68))
        d = ImageDraw.Draw(img)
        for i in range(n):
            d.rectangle([i * k + 1, 0, i * k + 4, 8], fill=(214, 216, 222))
    else:
        img = Image.new("RGB", (8, n * k), (60, 62, 68))
        d = ImageDraw.Draw(img)
        for i in range(n):
            d.rectangle([0, i * k + 1, 8, i * k + 4], fill=(214, 216, 222))
    save(img, name)


if __name__ == "__main__":
    motherboard()
    die()
    chip("dram.png", ["D5 16Gb", "x8  6000"], bg=(20, 20, 23))
    chip("nand.png", ["3D TLC NAND", "512GB  232L"], bg=(24, 24, 27))
    chip("ssdctrl.png", ["NVMe CTRL", "PCIe 4.0 x4"], size=(768, 768), bg=(30, 30, 33))
    chip("ssddram.png", ["LPDDR4", "1GB"], bg=(22, 22, 25))
    chip("phy.png", ["2.5GbE", "MAC + PHY"], size=(768, 768), bg=(26, 26, 30))
    chip("gpu_die.png", ["GPU", "5nm"], size=(768, 768), bg=(46, 48, 56), fg=(120, 124, 138))
    chip("gddr.png", ["GDDR6", "16Gb"], bg=(20, 20, 23))
    chip("chipset.png", ["PCH", "PCIe 4.0 / SATA / USB"], size=(768, 768), bg=(32, 32, 36))
    chip("spd.png", ["SPD"], size=(512, 256), bg=(22, 22, 25))
    label("ram_label.png", (1600, 400), (196, 198, 202), (30, 30, 34),
          [("DDR5-6000   16GB", 0.17, True), ("CL30  1.35V  288-PIN DIMM", 0.11, False), ("PC5-48000", 0.11, False)])
    label("ssd_label.png", (1600, 400), (24, 24, 28), (226, 228, 232),
          [("NVMe  M.2 2280", 0.17, True), ("PCIe 4.0 x4  ·  1 TB", 0.12, False), ("Read 7000 MB/s", 0.1, False)], accent=(220, 140, 40))
    label("hdd_label.png", (1470, 1020), (214, 216, 220), (30, 32, 36),
          [("3.5\"  SATA HDD", 0.075, True), ("2 TB   7200 RPM", 0.06, False), ("SATA 6Gb/s   256MB Cache", 0.045, False),
           ("+5V 0.45A   +12V 0.55A", 0.045, False)], bar=(60, 64, 72))
    label("psu_label.png", (1400, 860), (30, 31, 35), (220, 222, 226),
          [("850 W", 0.13, True), ("80 PLUS GOLD   ATX 3.1", 0.06, False), ("+12V  70.8A   +5V  20A", 0.05, False),
           ("+3.3V  20A    -12V 0.3A", 0.05, False), ("AC 100-240V  50/60Hz", 0.05, False)], accent=(212, 160, 50))
    label("gpu_side.png", (2400, 200), (28, 29, 33), (210, 212, 216), [("GRAPHICS  ·  PCIe 5.0 x16", 0.32, True)])
    platter()
    banks()
    pcb("gpu_pcb.png", (260, 110), (18, 20, 24), (32, 38, 46), S=8, seed=11, texts=[("PCIE 5.0 X16", 30, 10, 3.5)])
    pcb("psu_pcb.png", (140, 130), (150, 120, 60), (178, 146, 80), S=8, seed=5,
        texts=[("PFC", 20, 110, 5), ("+12V", 100, 20, 5), ("LLC", 70, 70, 5)])
    pcb("nic_pcb.png", (120, 68), (22, 80, 58), (36, 108, 78), S=12, seed=9, texts=[("ETH 2.5G  PCIe x1", 40, 8, 3.2)])
    pcb("ram_pcb.png", (133, 32), (24, 60, 44), (38, 84, 62), S=14, seed=4, texts=[("DDR5 UDIMM  2Rx8", 50, 3, 1.8)])
    pcb("ssd_pcb.png", (80, 22), (18, 20, 24), (34, 40, 50), S=24, seed=6, texts=[("M.2 2280 M-KEY", 18, 2.2, 1.4)])
    fan_hub()
    front_mesh()
    pads("lga.png", (40, 36), (30, 28, 26), (210, 170, 90), 0.9, 0.28, S=30)
    pads("lga_pads.png", (45, 37.5), (38, 92, 58), (222, 184, 96), 1.0, 0.36, S=30, field=(3, 3, 42, 34.5))
    substrate()
    ihs()
    nic_die()
    finish_maps()
    fins("fins_z.png", 56, horizontal=False)
    fins("fins_x.png", 140, horizontal=True)
