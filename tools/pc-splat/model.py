"""Procedural model of an ATX mid-tower PC and the opened (interior) variant of each part.

Units: meters, Blender Z-up. Case: X = side (-X is the glass side), Y = depth (-Y front), Z up.
Each part lives under an empty named after its id; exterior roots sit at their world position
with identity rotation, interior roots at the origin.
"""
import math

from lib import (anchor, array, bevel, box, cable, cut, cyl, empty, fan_blades, frame_matrix, mat, mesh, ring)

MM = 0.001


# ------------------------------------------------------------------ materials
def M():
    return dict(
        pcb_mobo=mat("pcb_mobo", (25, 29, 35), rough=0.55, tex="mobo.png", dens=1.6),
        pcb_black=mat("pcb_black", (20, 22, 26), rough=0.55),
        plastic=mat("plastic", (24, 24, 27), rough=0.6),
        plastic_gray=mat("plastic_gray", (92, 94, 100), rough=0.55),
        plastic_white=mat("plastic_white", (226, 226, 222), rough=0.5),
        plastic_blue=mat("plastic_blue", (40, 92, 200), rough=0.45),
        rubber=mat("rubber", (16, 16, 18), rough=0.9),
        case_black=mat("case_black", (30, 31, 35), metal=0.0, rough=0.45),
        case_inner=mat("case_inner", (24, 25, 28), metal=0.2, rough=0.6),
        alu=mat("alu", (196, 198, 204), metal=1.0, rough=0.3),
        alu_dark=mat("alu_dark", (70, 73, 80), metal=1.0, rough=0.35),
        gunmetal=mat("gunmetal", (52, 54, 60), metal=0.9, rough=0.35),
        steel=mat("steel", (160, 162, 168), metal=1.0, rough=0.35),
        nickel=mat("nickel", (206, 206, 210), metal=1.0, rough=0.18),
        copper=mat("copper", (206, 122, 82), metal=1.0, rough=0.28),
        gold=mat("gold", (222, 180, 92), metal=1.0, rough=0.25, dens=1.5),
        cap_sleeve=mat("cap_sleeve", (30, 30, 36), rough=0.4),
        cap_top=mat("cap_top", (190, 192, 198), metal=1.0, rough=0.3),
        choke=mat("choke", (64, 64, 68), metal=0.4, rough=0.5),
        sleeve=mat("sleeve", (28, 28, 32), rough=0.75),
        frit=mat("frit", (10, 10, 12), rough=0.25),
        front_mesh=mat("front_mesh", (38, 39, 44), rough=0.8),
        led_white=mat("led_white", (235, 240, 255), emit=1.6),
        led_green=mat("led_green", (60, 230, 110), emit=2.0),
        led_amber=mat("led_amber", (255, 170, 40), emit=2.0),
        usb_blue=mat("usb_blue", (30, 80, 210), rough=0.4),
        audio_g=mat("audio_g", (110, 200, 80), rough=0.4),
        audio_p=mat("audio_p", (230, 120, 170), rough=0.4),
        audio_b=mat("audio_b", (80, 140, 230), rough=0.4),
        ferrite=mat("ferrite", (40, 40, 44), rough=0.7),
        yellow_tape=mat("yellow_tape", (226, 190, 70), rough=0.45),
        cap_blue=mat("cap_blue", (40, 70, 150), rough=0.4),
        smd=mat("smd", (160, 140, 110), rough=0.5),
        thermal_pad=mat("thermal_pad", (150, 156, 170), rough=0.8),
        tim=mat("tim", (180, 182, 186), metal=0.5, rough=0.45),
    )


TM = {}  # textured materials, created lazily


def T(name, tex, color=(30, 30, 33), side="top", metal=0.0, rough=0.5, dens=1.0, rot=False):
    if name not in TM:
        TM[name] = mat(name, color, metal=metal, rough=rough, tex=tex, tex_side=side, dens=dens, rot=rot)
    return TM[name]


class Frame:
    """Build helper working in millimetres inside a local frame (empty)."""

    def __init__(self, parent):
        self.p = parent

    def B(self, name, x0, y0, z0, x1, y1, z1, m, bev=0.4, seg=2, dens=None):
        sx, sy, sz = abs(x1 - x0), abs(y1 - y0), abs(z1 - z0)
        o = box(name, (sx * MM, sy * MM, sz * MM), ((x0 + x1) / 2 * MM, (y0 + y1) / 2 * MM, (z0 + z1) / 2 * MM), m, self.p, bev=bev * MM, seg=seg)
        if dens:
            o["dens"] = dens
        return o

    def C(self, name, cx, cy, z0, r, h, m, seg=32, bev=0.3, axis="z", dens=None, r2=None):
        rot = {"z": (0, 0, 0), "x": (0, math.pi / 2, 0), "y": (math.pi / 2, 0, 0)}[axis]
        if axis == "z":
            loc = (cx * MM, cy * MM, (z0 + h / 2) * MM)
        elif axis == "x":
            loc = ((z0 + h / 2) * MM, cx * MM, cy * MM)
        else:
            loc = (cx * MM, (z0 + h / 2) * MM, cy * MM)
        o = cyl(name, r * MM, h * MM, loc, m, self.p, rot=rot, seg=seg, bev=bev * MM, r2=None if r2 is None else r2 * MM)
        if dens:
            o["dens"] = dens
        return o

    def A(self, name, x, y, z):
        return anchor(name, (x * MM, y * MM, z * MM), self.p)

    def sub(self, name, origin_mm, xaxis=(1, 0, 0), yaxis=(0, 1, 0)):
        e = empty(name, parent=self.p, matrix=frame_matrix([v * MM for v in origin_mm], xaxis, yaxis))
        return Frame(e)


# ------------------------------------------------------------------ generic sub-assemblies
def fan(F, name, size, thick, m, frame=True, blades=7, hub_tex=True, frame_mat=None):
    """Fan centred on local origin, axis +Z, front face at z=+thick/2."""
    s = size / 2
    r_open = s * 0.94
    if frame:
        fr = F.B(name + "_frame", -s, -s, -thick / 2, s, s, thick / 2, frame_mat or m["plastic"], bev=2.0, seg=3)
        cutter = F.C(name + "_hole", 0, 0, -thick, r_open, thick * 2, m["plastic"], seg=64, bev=0)
        cut(fr, cutter)
        for i, (x, y) in enumerate([(-1, -1), (-1, 1), (1, -1), (1, 1)]):
            F.C(f"{name}_scr{i}", x * (s - 7.5), y * (s - 7.5), thick / 2 - 0.2, 2.6, 0.6, m["steel"], seg=16)
        # struts on the back
        for i in range(4):
            a = math.pi / 4 + i * math.pi / 2
            L = s * 1.25
            st = F.B(f"{name}_strut{i}", -L / 2, -1.3, -thick / 2, L / 2, 1.3, -thick / 2 + 2.5, frame_mat or m["plastic"], bev=0.4)
            st.rotation_euler = (0, 0, a)
            st.location = (math.cos(a) * L / 2 * MM, math.sin(a) * L / 2 * MM, st.location[2])
    hub_r = size * 0.19
    F.C(name + "_motor", 0, 0, -thick / 2 + 2, hub_r * 0.9, thick - 4, m["plastic"], seg=40)
    hub = F.C(name + "_hub", 0, 0, thick / 2 - 3.2, hub_r, 2.6, T("fanhub", "fanhub.png", (24, 24, 27)) if hub_tex else m["plastic"], seg=48, bev=0.8)
    hub["dens"] = 1.5
    fan_blades(name + "_blades", hub_r * MM * 0.95, r_open * MM * 0.97, blades, 0.9 * MM, m["plastic"], F.p,
               loc=(0, 0, (thick / 2 - 6) * MM), pitch=0.9, sweep=0.55)


def cap(F, name, x, y, z0, r, h, m, sleeve=None):
    F.C(name, x, y, z0, r, h - 0.6, sleeve or m["cap_sleeve"], seg=24, bev=0.4)
    F.C(name + "_t", x, y, z0 + h - 0.8, r * 0.92, 0.8, m["cap_top"], seg=24, bev=0.2)


def slot_groove(F, name, x0, y0, x1, y1, z0, z1, m_body, along="x", gap=1.6, wall=None):
    """Connector slot made of base + two walls leaving a real groove (along x or y)."""
    if along == "x":
        w = (y1 - y0 - gap) / 2 if wall is None else wall
        F.B(name + "_base", x0, y0, z0, x1, y1, z0 + 2, m_body, bev=0.3)
        F.B(name + "_wa", x0, y0, z0, x1, y0 + w, z1, m_body, bev=0.5)
        F.B(name + "_wb", x0, y1 - w, z0, x1, y1, z1, m_body, bev=0.5)
        F.B(name + "_ea", x0, y0, z0, x0 + 1.5, y1, z1, m_body, bev=0.4)
        F.B(name + "_eb", x1 - 1.5, y0, z0, x1, y1, z1, m_body, bev=0.4)
    else:
        w = (x1 - x0 - gap) / 2 if wall is None else wall
        F.B(name + "_base", x0, y0, z0, x1, y1, z0 + 2, m_body, bev=0.3)
        F.B(name + "_wa", x0, y0, z0, x0 + w, y1, z1, m_body, bev=0.5)
        F.B(name + "_wb", x1 - w, y0, z0, x1, y1, z1, m_body, bev=0.5)
        F.B(name + "_ea", x0, y0, z0, x1, y0 + 1.5, z1, m_body, bev=0.4)
        F.B(name + "_eb", x0, y1 - 1.5, z0, x1, y1, z1, m_body, bev=0.4)


def smd_scatter(F, name, x0, y0, x1, y1, z, n, m, seed=1):
    import random
    rnd = random.Random(seed)
    for i in range(n):
        x, y = rnd.uniform(x0, x1), rnd.uniform(y0, y1)
        w, h = rnd.choice([(1.0, 0.5), (1.6, 0.8), (2.0, 1.25), (0.5, 1.0)])
        F.B(f"{name}{i}", x, y, z, x + w, y + h, z + 0.5, m, bev=0.1, seg=1)


# ------------------------------------------------------------------ motherboard
BOARD_ORIGIN = (0.085, 0.2155, 0.14)
CARD_Y = 0.2225  # world y of the expansion-card bracket plane  # world position of board-local (0,0,0)
BOARD_X = (0, -1, 0)
BOARD_Y = (0, 0, 1)
SOCKET = (95, 225)
SLOT_TOP = 1.6 + 11.0  # PCIe slot top (board-local z, mm)


def board_world(x, y, z):
    """board-local mm -> world meters"""
    ox, oy, oz = BOARD_ORIGIN
    return (ox - z * MM, oy - x * MM, oz + y * MM)


def build_board(F, m, opened=False):
    pcb = F.B("pcb", 0, 0, 0, 244, 305, 1.6, m["pcb_mobo"], bev=0.3, seg=1)
    pcb["dens"] = 1.0
    # socket
    sx, sy = SOCKET
    F.B("socket_base", sx - 25, sy - 24, 1.6, sx + 25, sy + 24, 4.6, m["plastic"], bev=0.6)
    F.B("socket_plate_a", sx - 26, sy - 25, 4.6, sx + 26, sy - 20, 5.6, m["steel"], bev=0.3)
    F.B("socket_plate_b", sx - 26, sy + 20, 4.6, sx + 26, sy + 25, 5.6, m["steel"], bev=0.3)
    F.B("socket_plate_c", sx - 26, sy - 25, 4.6, sx - 21, sy + 25, 5.6, m["steel"], bev=0.3)
    F.B("socket_plate_d", sx + 21, sy - 25, 4.6, sx + 26, sy + 25, 5.6, m["steel"], bev=0.3)
    F.C("socket_lever", sx + 29, 3.5, sy - 23, 0.9, 46, m["steel"], axis="y", seg=12, bev=0)
    if opened:
        # bare LGA field visible when the CPU is removed
        F.B("lga_field", sx - 20, sy - 18, 4.6, sx + 20, sy + 18, 4.8, T("lga", "lga.png", (180, 150, 80), metal=0.6), bev=0, seg=1).__setitem__("dens", 2.0)
    # VRM: chokes, mosfets, caps, heatsinks
    for i in range(10):
        x = 62 + i * 7.6
        F.B(f"choke_t{i}", x, 253, 1.6, x + 6.6, 260, 6.8, m["choke"], bev=0.5)
        cap(F, f"vcap_t{i}", x + 3.3, 247, 1.6, 2.6, 7.5, m)
        if opened:
            F.B(f"mos_t{i}", x + 0.8, 263, 1.6, x + 5.8, 269, 2.6, m["plastic"], bev=0.2)
    for i in range(9):
        y = 180 + i * 7.6
        F.B(f"choke_l{i}", 60, y, 1.6, 67, y + 6.6, 6.8, m["choke"], bev=0.5)
        cap(F, f"vcap_l{i}", 70.5, y + 3.3, 1.6, 2.6, 7.5, m)
        if opened:
            F.B(f"mos_l{i}", 50, y + 0.8, 1.6, 56, y + 5.8, 2.6, m["plastic"], bev=0.2)
    if not opened:
        # VRM heatsinks with real fins
        hs = F.B("vrm_hs_top_base", 55, 262, 1.6, 138, 281, 12, m["gunmetal"], bev=1.2)
        fin = F.B("vrm_hs_top_fin", 55, 262, 12, 56.6, 281, 27, m["gunmetal"], bev=0.3)
        array(fin, 26, (3.2 * MM, 0, 0))
        F.B("vrm_hs_top_cap", 55, 262, 27, 138, 266, 29, m["alu_dark"], bev=0.8)
        F.B("vrm_hs_left_base", 38, 175, 1.6, 58, 262, 12, m["gunmetal"], bev=1.2)
        fin = F.B("vrm_hs_left_fin", 38, 175, 12, 58, 176.6, 30, m["gunmetal"], bev=0.3)
        array(fin, 27, (0, 3.2 * MM, 0))
        F.B("vrm_hs_left_cap", 38, 175, 30, 42, 262, 32, m["alu_dark"], bev=0.8)
        del hs
    # DIMM slots
    for i in range(4):
        x0 = 147 + i * 9.5
        body = m["plastic_gray"] if i % 2 else m["plastic"]
        slot_groove(F, f"dimm{i}", x0, 158, x0 + 6, 300, 1.6, 9.6, body, along="y", gap=1.8)
        F.B(f"dimm{i}_latch_a", x0 - 0.5, 300, 1.6, x0 + 6.5, 304, 12.5, m["plastic_gray"], bev=0.6)
        F.B(f"dimm{i}_latch_b", x0 - 0.5, 154, 1.6, x0 + 6.5, 158, 12.5, m["plastic_gray"], bev=0.6)
    # PCIe slots
    slot_groove(F, "pcie16_1", 20, 127, 109, 134, 1.6, SLOT_TOP, m["steel"], along="x", gap=1.8)
    F.B("pcie16_1_latch", 109, 126, 1.6, 116, 135, SLOT_TOP + 1, m["plastic_gray"], bev=0.6)
    slot_groove(F, "pcie1_1", 20, 107, 45, 114, 1.6, SLOT_TOP, m["plastic"], along="x", gap=1.8)
    slot_groove(F, "pcie16_2", 20, 86, 109, 93, 1.6, SLOT_TOP, m["plastic"], along="x", gap=1.8)
    slot_groove(F, "pcie1_2", 20, 47, 45, 54, 1.6, SLOT_TOP, m["plastic"], along="x", gap=1.8)
    # M.2 connector + standoff
    F.B("m2_conn", 132, 142, 1.6, 138, 168, 5.6, m["plastic"], bev=0.4)
    F.C("m2_standoff", 52, 155, 1.6, 2.6, 2.4, m["gold"], seg=16)
    # chipset
    if opened:
        F.B("pch_pkg", 155, 44, 1.6, 185, 74, 3.0, m["pcb_black"], bev=0.3)
        F.B("pch_die", 160, 49, 3.0, 180, 69, 3.8, T("chipset", "chipset.png", (32, 32, 36), dens=2.0), bev=0.15).__setitem__("dens", 2.0)
    else:
        F.B("pch_hs", 150, 38, 1.6, 190, 80, 9.5, m["gunmetal"], bev=1.6, seg=3)
        F.B("pch_hs_top", 154, 42, 9.5, 186, 76, 10.5, m["alu"], bev=0.6)
    # SATA ports (front edge)
    for i in range(4):
        yc = 48 + 13.5 * i
        F.B(f"sata{i}", 231, yc - 4.5, 1.6, 244.5, yc + 4.5, 8.5, m["plastic"], bev=0.5)
        F.B(f"sata{i}_in", 244.2, yc - 3.3, 3.0, 244.8, yc + 3.3, 7.0, m["rubber"], bev=0.1, seg=1)
        F.B(f"sata{i}_key", 244.4, yc - 3.0, 5.6, 245.0, yc + 2.0, 6.4, m["plastic_gray"], bev=0.1, seg=1)
    # 24-pin + 8-pin power headers
    F.B("atx24", 228, 200, 1.6, 238, 252, 14, m["plastic"], bev=0.6)
    F.B("eps8", 12, 294, 1.6, 34, 303, 13, m["plastic"], bev=0.6)
    # rear I/O: ports + shroud
    io_y = 158
    ports = [("usb_a", 12, m["usb_blue"]), ("usb_b", 12, m["usb_blue"]), ("lan", 16, m["plastic"]), ("dp", 10, m["plastic"]),
             ("hdmi", 10, m["plastic"]), ("usb_c", 10, m["plastic"]), ("usb_k", 12, m["plastic"]), ("audio", 20, m["plastic"])]
    for i, (nm, w, pm) in enumerate(ports):
        F.B(f"io_{nm}", -10.6, io_y, 1.6, 14, io_y + w - 1.5, 15, m["steel"], bev=0.4)
        F.B(f"io_{nm}_in", -11.2, io_y + 1.5, 4.0, -10.4, io_y + w - 3.0, 12.5, pm, bev=0.2, seg=1)
        io_y += w
    for i, am in enumerate([m["audio_g"], m["audio_p"], m["audio_b"]]):
        F.B(f"audio_ring{i}", -11.4, io_y - 18 + i * 5.5, 5, -10.4, io_y - 14 + i * 5.5, 9, am, bev=0.2, seg=1)
    if not opened:
        F.B("io_shroud", -1, 156, 1.6, 22, 300, 36, m["gunmetal"], bev=2.0, seg=3)
        F.B("io_shroud_trim", 21.5, 160, 4, 22.6, 296, 34, m["alu"], bev=0.3)
    # misc caps / headers / battery / screws
    for i in range(6):
        cap(F, f"acap{i}", 20 + (i % 3) * 9, 20 + (i // 3) * 10, 1.6, 3.2, 9, m, sleeve=m["yellow_tape"])
    F.C("cmos", 205, 140, 1.6, 10, 3.2, m["nickel"], seg=48, bev=0.4)
    F.B("hdr_cpufan", 66, 288, 1.6, 76, 293, 8, m["plastic_white"], bev=0.3)
    F.B("hdr_sys2", 205, 114, 1.6, 215, 119, 8, m["plastic_white"], bev=0.3)
    F.B("hdr_fpanel", 196, 4, 1.6, 214, 9, 8, m["plastic"], bev=0.3)
    F.B("hdr_usb3", 140, 3, 1.6, 162, 11, 9, m["usb_blue"], bev=0.4)
    F.B("hdr_audio", 8, 3, 1.6, 22, 8, 8, m["plastic"], bev=0.3)
    F.B("bios", 196, 22, 1.6, 204, 28, 2.8, m["plastic"], bev=0.2)
    F.B("debug_led", 216, 146, 1.6, 226, 152, 4, m["led_amber"], bev=0.3)
    smd_scatter(F, "smd", 120, 100, 225, 150, 1.6, 40, m["smd"], seed=3)
    smd_scatter(F, "smd2", 25, 150, 55, 290, 1.6, 30, m["smd"], seed=4)
    for i, (hx, hy) in enumerate([(6, 299), (6, 140), (6, 25), (163, 299), (163, 140), (163, 25), (238, 299), (238, 140), (238, 25)]):
        F.C(f"screw{i}", hx, hy, 1.6, 3.4, 1.6, m["steel"], seg=20, bev=0.4)
    # anchors
    F.A("cpu", sx, sy, 6)
    F.A("dimm", 166, 230, 10)
    F.A("pcie16", 64, 130.5, SLOT_TOP)
    F.A("pcie1_2", 32, 50.5, SLOT_TOP)
    F.A("m2", 135, 155, 6)
    F.A("chipset", 170, 59, 11)
    F.A("sata", 238, 68, 9)
    F.A("atx24", 233, 226, 14)
    F.A("eps8", 23, 298, 13)
    F.A("vrm", 96, 271, 28)
    F.A("io", 4, 230, 36)
    F.A("bios", 200, 25, 3)


# ------------------------------------------------------------------ CPU + cooler
def cpu_package(F, m, ihs=True, z0=4.6):
    """CPU package centred on local origin (x,y), sitting at z0."""
    F.B("substrate", -22.5, -18.75, z0, 22.5, 18.75, z0 + 1.2, T("substrate", "substrate.png", (40, 96, 60)), bev=0.3, seg=1).__setitem__("dens", 1.5)
    if ihs:
        F.B("ihs_skirt", -17, -15, z0 + 1.2, 17, 15, z0 + 2.2, m["nickel"], bev=0.6)
        F.B("ihs_top", -14.5, -14.5, z0 + 2.2, 14.5, 14.5, z0 + 4.4, T("ihs", "ihs.png", (206, 206, 210), metal=1.0, rough=0.2), bev=0.8, seg=3)


def build_cooler(F, m):
    """Tower cooler in board-local frame (mm), above SOCKET."""
    sx, sy = SOCKET
    zc = 1.6 + 3.0 + 1.2 + 3.2  # top of IHS
    F.B("cool_base", sx - 20, sy - 20, zc, sx + 20, sy + 20, zc + 4.5, m["nickel"], bev=0.8)
    F.B("cool_block", sx - 18, sy - 24, zc + 4.5, sx + 18, sy + 24, zc + 14, m["alu"], bev=1.2)
    F.B("cool_mount", sx - 34, sy - 5, zc + 9, sx + 34, sy + 5, zc + 12, m["steel"], bev=0.8)
    # heat pipes (6) going up into the stack
    for i in range(6):
        y = sy - 25 + i * 10
        F.C(f"pipe{i}", sx + (-6 if i % 2 else 6), y, zc + 6, 3.0, 145, m["copper"], seg=16, bev=0)
    # fin stack: 50 (x) x 124 (y), fins along z
    F.B("fins", sx - 25, sy - 62, 44, sx + 25, sy + 62, 156, T("fins_z", "fins_z.png", (196, 198, 204), side="box", metal=1.0, rough=0.3, dens=1.3), bev=0.2, seg=1)
    F.B("cool_top", sx - 26, sy - 63, 156.5, sx + 26, sy + 63, 160, m["plastic"], bev=1.4, seg=3)
    F.B("cool_top_trim", sx - 24, sy - 61, 160, sx + 24, sy + 61, 160.6, m["alu"], bev=0.3)
    for i in range(6):
        y = sy - 25 + i * 10
        F.C(f"pipe_cap{i}", sx + (-6 if i % 2 else 6), y, 160.2, 3.1, 1.2, m["nickel"], seg=16, bev=0.3)
    # fan on the rear side (x smaller), axis along board x
    G = F.sub("cool_fan", (sx - 25 - 13.5, sy, 102), xaxis=(0, 1, 0), yaxis=(0, 0, 1))
    fan(G, "cfan", 120, 25, m)
    # fan clips
    for i, z in enumerate((44, 160)):
        F.B(f"clip{i}", sx - 40, sy - 58, z - 1, sx - 24, sy - 56, z + 1, m["steel"], bev=0.3)
        F.B(f"clipb{i}", sx - 40, sy + 56, z - 1, sx - 24, sy + 58, z + 1, m["steel"], bev=0.3)


def build_cpu_open(F, m):
    """Delidded CPU: substrate + exposed die, IHS lifted above, solder/TIM."""
    F.B("substrate", -22.5, -18.75, 0, 22.5, 18.75, 1.2, T("substrate", "substrate.png", (40, 96, 60)), bev=0.3, seg=1).__setitem__("dens", 1.2)
    F.B("pads", -22.5, -18.75, -0.15, 22.5, 18.75, 0, T("lga_pads", "lga_pads.png", (180, 150, 80), side="both", metal=0.7, rough=0.3), bev=0, seg=1)
    # die (18 x 10 mm) a touch raised, with underfill
    F.B("underfill", -9.8, -5.8, 1.2, 9.8, 5.8, 1.45, m["tim"], bev=0.1, seg=1)
    die = F.B("die", -9, -5, 1.45, 9, 5, 2.2, T("die", "die.png", (46, 40, 52), dens=9.0, rough=0.25), bev=0.1, seg=1)
    die["dens"] = 9.0
    # SMD caps on the substrate
    import random
    rnd = random.Random(2)
    for i in range(46):
        a = rnd.random() * math.tau
        x = rnd.uniform(-20, 20)
        y = rnd.choice([rnd.uniform(-17.5, -8), rnd.uniform(8, 17.5)])
        if abs(x) < 16 and abs(y) < 13.5:
            continue
        F.B(f"scap{i}", x, y, 1.2, x + 1.0, y + 0.5, 1.7, m["smd"], bev=0.08, seg=1)
    for i in range(14):
        x = -14 + i * 2.1
        F.B(f"scap_r{i}", x, 9.0, 1.2, x + 1.0, 9.5, 1.7, m["smd"], bev=0.08, seg=1)
        F.B(f"scap_s{i}", x, -9.5, 1.2, x + 1.0, -9.0, 1.7, m["smd"], bev=0.08, seg=1)
    # sealant outline where the IHS was glued
    for i, (a, b, c, d) in enumerate([(-17, -15, 17, -14), (-17, 14, 17, 15), (-17, -15, -16, 15), (16, -15, 17, 15)]):
        F.B(f"seal{i}", a, b, 1.2, c, d, 1.5, m["rubber"], bev=0.1, seg=1)
    # lifted IHS (upside down, tilted) showing its underside + solder
    G = F.sub("ihs_lift", (0, 30, 22), xaxis=(1, 0, 0), yaxis=(0, math.cos(-2.28), math.sin(-2.28)))
    G.B("ihs_plate", -14.5, -14.5, 0, 14.5, 14.5, 2.2, m["nickel"], bev=0.8, seg=3)
    G.B("ihs_skirt", -17, -15, 2.2, 17, 15, 3.2, m["nickel"], bev=0.6)
    G.B("ihs_solder", -9, -5, -0.25, 9, 5, 0, m["tim"], bev=0.05, seg=1)
    # anchors (die regions follow textures.py: die 18x10 mm, centred)
    def dpos(u, v):  # texture mm (origin bottom-left) -> local
        return (u - 9.0, v - 5.0, 2.3)
    F.A("core", *dpos(4.3, 8.0))
    F.A("alu", *dpos(3.6, 8.6))
    F.A("cu", *dpos(5.5, 8.6))
    F.A("l1", *dpos(5.5, 7.6))
    F.A("l2", *dpos(4.4, 6.7))
    F.A("l3", *dpos(9.0, 5.0))
    F.A("ring", *dpos(12.0, 6.07))
    F.A("imc", *dpos(1.4, 5.0))
    F.A("io", *dpos(16.5, 5.0))
    F.A("substrate", 18, -14, 1.2)
    F.A("ihs", 0, 30, 22)


# ------------------------------------------------------------------ RAM
def dimm(F, m, name, opened=False):
    """DIMM in its own frame: X along length (133.35), Y height from slot groove, Z thickness."""
    L = 133.35
    F.B(name + "_pcb", 0, 0, -0.6, L, 31.25, 0.6, T("ram_pcb", "ram_pcb.png", (24, 60, 44), side="both"), bev=0.2, seg=1)
    # gold fingers both sides
    F.B(name + "_gold", 1.5, 0, -0.62, L - 1.5, 3.2, 0.62, m["gold"], bev=0, seg=1)
    if not opened:
        for s, sg in ((1, "a"), (-1, "b")):
            z0, z1 = (0.6, 2.2) if s > 0 else (-2.2, -0.6)
            F.B(f"{name}_hs{sg}", -0.6, 6, z0, L + 0.6, 38, z1, m["alu_dark"], bev=0.5)
        lab = F.B(name + "_label", 12, 12, 2.2, 122, 30, 2.4, T("ram_label", "ram_label.png", (196, 198, 202)), bev=0.1, seg=1)
        lab["dens"] = 1.5
        F.B(name + "_bar", 2, 38, -4.0, L - 2, 40.6, 4.0, m["alu"], bev=0.6)
    else:
        for i in range(8):
            x = 8 + i * 15.2 + (6 if i >= 4 else 0)
            F.B(f"{name}_dram{i}", x, 9, 0.6, x + 11, 23, 1.6, T("dram", "dram.png", (20, 20, 23), dens=2.5), bev=0.2).__setitem__("dens", 2.5)
        F.B(name + "_pmic", 62.5, 24.5, 0.6, 70.5, 29, 1.4, m["plastic"], bev=0.15)
        F.B(name + "_spd", 62.5, 6.0, 0.6, 68.5, 9.0, 1.2, T("spd", "spd.png", (22, 22, 25)), bev=0.1)
        smd_scatter(F, name + "_smd", 4, 4, 128, 28, 0.6, 60, m["smd"], seed=8)
        for i in range(10):
            cap(F, f"{name}_mlcc{i}", 54 + i * 2.6, 26.5, 0.6, 0.7, 1.6, m)


def build_ram(F, m):
    """Two DIMMs in slots A2 and B2 (board-local frame)."""
    for i, k in enumerate((1, 3)):
        x0 = 147 + k * 9.5 + 3.0  # slot centre x
        G = F.sub(f"dimm_f{i}", (x0, 158 + (142 - 133.35) / 2, 3.6), xaxis=(0, 1, 0), yaxis=(0, 0, 1))
        dimm(G, m, f"dimm{i}")
    F.A("chips", 147 + 3 * 9.5 + 3, 230, 40)


def build_ram_open(F, m):
    G = F.sub("stick", (-66.7, 0, 0), xaxis=(1, 0, 0), yaxis=(0, 0, 1))  # stick standing up, facing -Y
    dimm(G, m, "d", opened=True)
    # heatspreader halves pulled away to both sides
    # both heatspreader halves set aside behind the stick, leaning back, outer face (label) to the camera
    for k, (dy, dz) in enumerate(((30, -6), (52, 6))):
        H = F.sub(f"hs_{k}", (-66.7, dy, dz), xaxis=(1, 0, 0), yaxis=(0, -math.sin(0.35), math.cos(0.35)))
        H.B("plate", -0.6, 6, -0.8, 133.95, 38, 0.8, m["alu_dark"], bev=0.5)
        H.B("rim", -0.6, 34, -2, 133.95, 40.5, 2, m["gunmetal"], bev=0.8)
        H.B("label", 12, 12, -1.0, 122, 30, -0.8, T("ram_label_back", "ram_label.png", (196, 198, 202), side="both"), bev=0.05, seg=1)
    # floating DRAM die with banks above chip 2
    B = F.sub("bankdie", (-25, -6, 62), xaxis=(1, 0, 0), yaxis=(0, math.cos(0.5), math.sin(0.5)))
    B.B("die", -24, -12, 0, 24, 12, 0.8, T("banks", "banks.png", (18, 20, 26), dens=4.0), bev=0.15).__setitem__("dens", 4.0)
    B.B("die_edge", -24.6, -12.6, -0.6, 24.6, 12.6, 0, m["pcb_black"], bev=0.1)
    F.A("dram", -66.7 + 8 + 2 * 15.2 + 5.5, -1.6, 16)
    F.A("bank", -25 - 6, -6, 68)
    F.A("rowbuf", -25 + 1, -6 + 3.5, 66)
    F.A("gold", 0, -1, 1.5)
    F.A("spd", -66.7 + 65.5, -1.2, 7.5)
    F.A("pmic", -66.7 + 66.5, -1.4, 27)
    F.A("hs", 40, 52, 40)


# ------------------------------------------------------------------ NVMe SSD
def ssd(F, m, opened=False):
    """M.2 2280 card, X along length (connector at x=80), Y width 22, Z up."""
    F.B("pcb", 0, -11, 0, 80, 11, 0.8, T("ssd_pcb", "ssd_pcb.png", (18, 20, 24), side="both"), bev=0.15, seg=1)
    F.B("gold", 76, -9.5, -0.02, 80, 9.5, 0.82, m["gold"], bev=0, seg=1)
    F.B("notch", 0, -1.6, -0.1, 2.2, 1.6, 0.9, m["pcb_black"], bev=0.1)
    if not opened:
        lab = F.B("label", 3, -10.8, 0.8, 74, 10.8, 1.0, T("ssd_label", "ssd_label.png", (24, 24, 28), rot=False), bev=0.05, seg=1)
        lab["dens"] = 2.0
        F.B("bump_ctrl", 58, -7, 1.0, 70, 7, 1.6, T("ssd_label", "ssd_label.png", (24, 24, 28)), bev=0.6)
    else:
        F.B("ctrl", 57, -7, 0.8, 71, 7, 1.9, T("ssdctrl", "ssdctrl.png", (30, 30, 33), dens=3.0), bev=0.2).__setitem__("dens", 3.0)
        F.B("dram", 45, -6, 0.8, 53, 6, 1.6, T("ssddram", "ssddram.png", (22, 22, 25), dens=2.0, rot=True), bev=0.15).__setitem__("dens", 2.0)
        for i in range(2):
            x = 6 + i * 19
            F.B(f"nand{i}", x, -8, 0.8, x + 16, 8, 2.0, T("nand", "nand.png", (24, 24, 27), dens=2.0, rot=True), bev=0.2).__setitem__("dens", 2.0)
        F.B("pmic", 72, 7.5, 0.8, 75, 10, 1.4, m["plastic"], bev=0.1)
        smd_scatter(F, "smd", 2, -10.5, 75, 10.5, 0.8, 50, m["smd"], seed=12)


def build_ssd(F, m):
    G = F.sub("ssd_f", (52, 155, 3.4), xaxis=(1, 0, 0), yaxis=(0, 1, 0))
    ssd(G, m)
    G.C("screw", 1.0, 0, 0.8, 2.6, 1.3, m["steel"], seg=16, bev=0.3)
    F.A("ssd", 100, 155, 5)


def build_ssd_open(F, m):
    G = F.sub("card", (-40, 0, 0))
    ssd(G, m, opened=True)
    # peeled label floating above
    L = F.sub("label_peel", (-40, 30, 1), xaxis=(1, 0, 0), yaxis=(0, math.cos(1.3), math.sin(1.3)))
    L.B("label", 3, -10.8, 0, 74, 10.8, 0.15, T("ssd_label", "ssd_label.png", (24, 24, 28)), bev=0.03, seg=1).__setitem__("dens", 1.2)
    # NAND die stack floating above package 0
    S = F.sub("nandstack", (-26, -2, 14))
    cols = [mat("nand_die", (120, 130, 150), metal=0.6, rough=0.3)]
    for i in range(4):
        S.B(f"die{i}", -6, -5, i * 2.2, 6, 5, i * 2.2 + 0.6, cols[0], bev=0.05, seg=1)
        S.B(f"wire{i}", 6, -4.5, i * 2.2, 6.6, 4.5, i * 2.2 + 0.4, m["gold"], bev=0, seg=1)
    F.A("ctrl", -40 + 64, 0, 2.2)
    F.A("dram", -40 + 49, 0, 1.8)
    F.A("nand", -40 + 33, 0, 2.2)
    F.A("stack", -26, -2, 22)
    F.A("mkey", -40 + 78.5, 0, 1)
    F.A("label", -40 + 40, 33, 16)


# ------------------------------------------------------------------ HDD
def hdd_shell(F, m, opened=False):
    """3.5in drive: X 101.6 wide, Y 147 long, Z 26.1, centred x/y, z from 0. connectors at +Y."""
    W, L, H = 101.6, 147.0, 26.1
    base_m = m["alu"]
    if not opened:
        F.B("base", -W / 2, -L / 2, 0, W / 2, L / 2, 21, base_m, bev=1.2, seg=3)
        F.B("cover", -W / 2 + 1, -L / 2 + 1, 21, W / 2 - 1, L / 2 - 1, H, m["alu"], bev=1.0, seg=3)
        lab = F.B("label", -W / 2 + 6, -L / 2 + 8, H, W / 2 - 6, L / 2 - 40, H + 0.15, T("hdd_label", "hdd_label.png", (214, 216, 220), rot=True), bev=0.05, seg=1)
        lab["dens"] = 1.6
        for i, (x, y) in enumerate([(-44, -66), (44, -66), (-44, 66), (44, 66), (0, 0), (-12, 40)]):
            F.C(f"cscr{i}", x, y, H, 2.2, 0.6, m["steel"], seg=12, bev=0.2)
    else:
        F.B("floor", -W / 2, -L / 2, 0, W / 2, L / 2, 4, base_m, bev=1.0, seg=3)
        wall = 3.0
        F.B("wall_l", -W / 2, -L / 2, 4, -W / 2 + wall, L / 2, 21, base_m, bev=0.8)
        F.B("wall_r", W / 2 - wall, -L / 2, 4, W / 2, L / 2, 21, base_m, bev=0.8)
        F.B("wall_f", -W / 2, -L / 2, 4, W / 2, -L / 2 + wall, 21, base_m, bev=0.8)
        F.B("wall_b", -W / 2, L / 2 - wall, 4, W / 2, L / 2, 21, base_m, bev=0.8)
    # bottom PCB + SATA connectors at +Y end
    F.B("pcb", -W / 2 + 4, -L / 2 + 30, -1.6, W / 2 - 4, L / 2 - 2, 0, m["pcb_black"] if not opened else mat("hdd_pcb", (24, 70, 50), rough=0.5), bev=0.2, seg=1)
    F.B("sata_data", -30, L / 2 - 1, 2, -12, L / 2 + 5, 8, m["plastic"], bev=0.4)
    F.B("sata_pwr", -8, L / 2 - 1, 2, 22, L / 2 + 5, 8, m["plastic"], bev=0.4)
    F.B("sata_data_g", -28, L / 2 + 4.6, 3.5, -14, L / 2 + 5.2, 6.5, m["gold"], bev=0, seg=1)
    F.B("sata_pwr_g", -6, L / 2 + 4.6, 3.5, 20, L / 2 + 5.2, 6.5, m["gold"], bev=0, seg=1)


def build_hdd_open(F, m):
    hdd_shell(F, m, opened=True)
    # spindle + 2 platters (platter centre at y=-22)
    py = -L_HDD() / 2 + 52
    F.C("spindle_base", 0, py, 4, 14, 3, m["alu_dark"], seg=48, bev=0.5)
    for i, z in enumerate((9.0, 15.5)):
        F.C(f"platter{i}", 0, py, z, 47.5, 1.27, T("platter", "platter.png", (190, 194, 200), metal=0.85, rough=0.12, dens=1.6), seg=128, bev=0.2).__setitem__("dens", 1.6)
    F.C("spacer", 0, py, 7.0, 13, 10, m["nickel"], seg=48, bev=0.3)
    F.C("clamp", 0, py, 16.8, 15.5, 1.5, m["nickel"], seg=48, bev=0.5)
    for i in range(6):
        a = i / 6 * math.tau
        F.C(f"clampscr{i}", 10 * math.cos(a), py + 10 * math.sin(a), 18.2, 1.4, 0.8, m["steel"], seg=12, bev=0.2)
    # head stack assembly: pivot at (34, 40), arm reaches the highlighted track (r = 0.66*47.5)
    px, pyv = 34.0, py + 62.0
    F.C("pivot", px, pyv, 4, 6.5, 16, m["nickel"], seg=40, bev=0.5)
    tgt_r = 0.66 * 47.5
    # head target point on track, pick the angle on the side near the pivot
    ang = math.atan2(pyv - py, px)  # direction from platter centre to pivot
    a2 = ang + 0.55
    hx, hy = tgt_r * math.cos(a2), py + tgt_r * math.sin(a2)
    dx, dy = hx - px, hy - pyv
    L = math.hypot(dx, dy)
    th = math.atan2(dy, dx)
    A = F.sub("arm", (px, pyv, 0), xaxis=(math.cos(th), math.sin(th), 0), yaxis=(-math.sin(th), math.cos(th), 0))
    for i, z in enumerate((10.6, 17.0)):
        A.B(f"arm{i}", 0, -4.5, z, L * 0.62, 4.5, z + 1.0, m["alu"], bev=0.3)
        A.B(f"susp{i}", L * 0.6, -2.0, z + 0.2, L - 0.5, 2.0, z + 0.5, m["steel"], bev=0.1, seg=1)
        A.B(f"slider{i}", L - 1.6, -0.8, z - 0.6, L + 0.4, 0.8, z + 0.2, m["plastic"], bev=0.1, seg=1)
    # voice-coil motor behind the pivot
    A.B("coil", -24, -9, 11, -6, 9, 15, m["copper"], bev=1.5, seg=3)
    A.B("coil_hub", -8, -5, 10, 4, 5, 18, m["alu"], bev=0.6)
    F.B("vcm_magnet", px - 6 - 22, pyv - 4, 4, px + 2 - 22 + 18, pyv + 22, 8, m["steel"], bev=1.0)
    F.B("flex", px - 6, pyv - 30, 4, px - 4, pyv - 6, 14, m["copper"], bev=0.2, seg=1)
    F.B("filter", -38, py + 40, 4, -28, py + 52, 12, m["plastic_white"], bev=0.6)
    # cover lifted & tilted
    Cv = F.sub("cover_lift", (0, 112, 62), xaxis=(1, 0, 0), yaxis=(0, math.cos(1.2), math.sin(1.2)))
    Cv.B("cover", -50.8, -73.5, 0, 50.8, 73.5, 1.2, m["alu"], bev=0.6, seg=2)
    Cv.B("label", -44.8, -65.5, 1.2, 44.8, 33.5, 1.35, T("hdd_label", "hdd_label.png", (214, 216, 220), rot=True), bev=0.05, seg=1)
    F.A("platter", -28, py - 20, 17)
    F.A("track", tgt_r * math.cos(a2 + 1.2), py + tgt_r * math.sin(a2 + 1.2), 17)
    F.A("sector", tgt_r * 1.0, py + 2.5, 17)
    F.A("head", hx, hy, 18)
    F.A("arm", px - 4, pyv - 12, 18)
    F.A("vcm", px - 16, pyv + 6, 16)
    F.A("spindle", 0, py, 18.5)
    F.A("sata", -5, L_HDD() / 2 + 5, 5)


def L_HDD():
    return 147.0


# ------------------------------------------------------------------ expansion cards
def bracket(F, m, z_lo, z_hi, h=120):
    F.B("bracket", -1.0, -10, z_lo, 0, h, z_hi, m["steel"], bev=0.2, seg=1)
    F.B("bracket_tab", -1.0, h - 1, z_lo, 10, h, z_hi, m["steel"], bev=0.2, seg=1)


def gpu(F, m, opened=False):
    """Card frame: X length from bracket, Y away from board (0 = slot top), Z+ component side."""
    F.B("pcb", 4, 0, 0, 268, 112, 1.6, T("gpu_pcb", "gpu_pcb.png", (18, 20, 24), side="both"), bev=0.3, seg=1)
    F.B("fingers", 27, -8, -0.05, 116, 0, 1.65, m["gold"], bev=0, seg=1)
    if not opened:
        bracket(F, m, -4, 44)
        for i in range(3):
            F.B(f"port{i}", -2.0, 14 + i * 22, 6, 0.2, 30 + i * 22, 14, m["plastic"], bev=0.3, seg=1)
        F.B("hdmi", -2.0, 82, 6, 0.2, 98, 12, m["plastic"], bev=0.3, seg=1)
        # backplate
        F.B("backplate", 4, 1, -4.0, 270, 113, -1.0, m["gunmetal"], bev=0.8, seg=2)
        F.B("bp_stripe", 60, 112.4, -3.6, 250, 113.4, -1.4, m["alu"], bev=0.2, seg=1)
        for i, (x, y) in enumerate([(88, 44), (112, 44), (88, 68), (112, 68)]):
            F.C(f"bpscr{i}", x, y, -4.6, 2.4, 0.8, m["steel"], seg=14, bev=0.2)
        # fins (visible through the open shroud edges)
        F.B("fin", 12, 6, 6, 292, 108, 40, T("fins_x", "fins_x.png", (190, 192, 198), side="box", metal=1.0, rough=0.35), bev=0.2, seg=1)
        for i in range(4):
            F.C(f"hp{i}", 30 + i * 16, 22 + (i % 2) * 6, 12, 3.0, 280, m["copper"], axis="x", seg=14, bev=0)
        # shroud: bottom plate with 3 fan holes + side rails + end cap
        plate = F.B("shroud_plate", 2, -4, 42, 300, 118, 47, m["gunmetal"], bev=1.6, seg=3)
        for i, x in enumerate((60, 155, 250)):
            c = F.C(f"fanhole{i}", x, 57, 40, 45, 10, m["plastic"], seg=72, bev=0)
            cut(plate, c)
        F.B("rail_a", 2, -4, 6, 300, -1, 42, m["gunmetal"], bev=1.0)
        rail = F.B("rail_b", 2, 115, 6, 300, 118.5, 42, m["gunmetal"], bev=1.0)
        del rail
        Gs = F.sub("gside", (0, 118.5, 0), xaxis=(1, 0, 0), yaxis=(0, 0, -1))
        Gs.B("side_label", 40, -36, 0, 260, -18, 0.3, T("gpu_side", "gpu_side.png", (28, 29, 33)), bev=0, seg=1).__setitem__("dens", 1.5)
        F.B("lightbar", 30, 118.4, 38, 280, 119.0, 40, m["led_white"], bev=0.2, seg=1)
        F.B("endcap", 296, -4, 6, 300, 118.5, 47, m["gunmetal"], bev=1.0)
        for i, x in enumerate((60, 155, 250)):
            G = F.sub(f"gfan{i}", (x, 57, 36))
            fan(G, f"gf{i}", 90, 8, m, frame=False, blades=11)
        F.B("pwr", 205, 109, 2, 226, 121, 11, m["plastic"], bev=0.6)
    else:
        # bare PCB: die, VRAM, VRM
        F.B("sub", 82, 38, 1.6, 118, 74, 2.8, m["pcb_black"], bev=0.3)
        F.B("die", 89, 45, 2.8, 111, 67, 3.6, T("gpu_die", "gpu_die.png", (46, 48, 56), dens=4.0, metal=0.4, rough=0.25), bev=0.15).__setitem__("dens", 4.0)
        pos = [(68, 46), (68, 64), (126, 46), (126, 64), (90, 24), (108, 24), (90, 82), (108, 82)]
        for i, (x, y) in enumerate(pos):
            F.B(f"gddr{i}", x - 6, y - 5.5 if x in (68, 126) else y - 7, 1.6, x + 6, y + 5.5 if x in (68, 126) else y + 7, 2.8,
                T("gddr", "gddr.png", (20, 20, 23), dens=2.0, rot=x not in (68, 126)), bev=0.2).__setitem__("dens", 2.0)
        for i in range(12):
            x = 140 + i * 9.5
            F.B(f"choke{i}", x, 80, 1.6, x + 8, 88, 7, m["choke"], bev=0.6)
            F.B(f"mos{i}", x + 1, 70, 1.6, x + 7, 76, 2.6, m["plastic"], bev=0.2)
            cap(F, f"gcap{i}", x + 4, 95, 1.6, 2.5, 6, m)
        for i in range(6):
            cap(F, f"bcap{i}", 160 + i * 14, 30, 1.6, 4, 10, m)
        F.B("pwr", 205, 104, 1.6, 226, 116, 11, m["plastic"], bev=0.6)
        smd_scatter(F, "smd", 20, 10, 260, 105, 1.6, 120, m["smd"], seed=21)


def nic(F, m, opened=False):
    F.B("pcb", 4, 0, 0, 120, 68, 1.6, T("nic_pcb", "nic_pcb.png", (22, 80, 58), side="both"), bev=0.3, seg=1)
    F.B("fingers", 27, -8, -0.05, 52, 0, 1.65, m["gold"], bev=0, seg=1)
    bracket(F, m, -2, 18, h=120)
    # RJ45 jack at bracket
    F.B("rj45", 0.5, 20, 1.6, 22, 36, 15, m["steel"], bev=0.6)
    F.B("rj45_hole", -1.6, 22.5, 3.5, 0.6, 33.5, 12.5, m["rubber"], bev=0.3)
    F.B("led_g", -1.4, 21, 12.8, 0.6, 23.5, 14.2, m["led_green"], bev=0.2, seg=1)
    F.B("led_a", -1.4, 32, 12.8, 0.6, 34.5, 14.2, m["led_amber"], bev=0.2, seg=1)
    F.B("magnetics", 26, 18, 1.6, 40, 38, 7.5, m["plastic"], bev=0.5)
    F.C("xtal", 70, 18, 1.6, 2.4, 1.2, m["nickel"], seg=20, bev=0.2)
    F.B("xtal_b", 66, 16.2, 1.6, 74, 19.8, 3.0, m["nickel"], bev=1.4)
    for i in range(6):
        cap(F, f"ncap{i}", 85 + i * 5, 52, 1.6, 2.0, 5, m)
    smd_scatter(F, "smd", 10, 6, 115, 62, 1.6, 50, m["smd"], seed=31)
    F.B("chip", 50, 22, 1.6, 64, 36, 2.8, T("phy", "phy.png", (26, 26, 30), dens=2.5), bev=0.3).__setitem__("dens", 2.5)
    if not opened:
        hs = F.B("hs_base", 46, 18, 2.8, 68, 40, 5, m["alu_dark"], bev=0.6)
        fin = F.B("hs_fin", 46, 18, 5, 47.2, 40, 12, m["alu_dark"], bev=0.2)
        array(fin, 8, (3.0 * MM, 0, 0))
        del hs


def build_nic_open(F, m):
    G = F.sub("card", (-60, -34, 0))
    nic(G, m, opened=True)
    # heatsink lifted
    H = F.sub("hs_lift", (-60, -34, 26))
    H.B("hs_base", 46, 18, 0, 68, 40, 2.2, m["alu_dark"], bev=0.6)
    fin = H.B("hs_fin", 46, 18, 2.2, 47.2, 40, 9, m["alu_dark"], bev=0.2)
    array(fin, 8, (3.0 * MM, 0, 0))
    H.B("pad", 50, 22, -0.6, 64, 36, 0, m["thermal_pad"], bev=0.1)
    # floating die: MAC | PHY
    D = F.sub("nicdie", (-3, -10, 44), xaxis=(1, 0, 0), yaxis=(0, math.cos(0.55), math.sin(0.55)))
    D.B("die", -18, -9, 0, 18, 9, 0.8, T("nic_die", "nic_die.png", (30, 30, 36), dens=4.0), bev=0.1).__setitem__("dens", 4.0)
    D.B("edge", -18.5, -9.5, -0.5, 18.5, 9.5, 0, m["pcb_black"], bev=0.1)
    F.A("mac", -3 - 9, -10, 46)
    F.A("phy", -3 + 9, -10, 46)
    F.A("chip", -60 + 57, -34 + 29, 3.2)
    F.A("magnetics", -60 + 33, -34 + 28, 8)
    F.A("rj45", -60 + 11, -34 + 28, 15)
    F.A("led", -60 - 1, -34 + 22, 14)
    F.A("pcie", -60 + 40, -34 - 4, 1)
    F.A("xtal", -60 + 70, -34 + 18, 3)


# ------------------------------------------------------------------ PSU
def psu(F, m, opened=False):
    """150 (X) x 140 (Y, +Y = rear/AC side) x 86 (Z), centred x/y, z from 0. Fan on the bottom (-Z)."""
    W, D, H = 150, 140, 86
    if not opened:
        F.B("shell", -W / 2, -D / 2, 0, W / 2, D / 2, H, m["case_black"], bev=1.6, seg=3)
        lab = F.B("label", -60, -50, H, 60, 50, H + 0.2, T("psu_label", "psu_label.png", (30, 31, 35), rot=False), bev=0.05, seg=1)
        lab["dens"] = 1.3
        # side label facing the glass (-X)
        S = F.sub("side", (-W / 2, 0, H / 2), xaxis=(0, -1, 0), yaxis=(0, 0, 1))
        S.B("slabel", -55, -32, 0, 55, 32, 0.3, T("psu_side", "psu_label.png", (30, 31, 35)), bev=0, seg=1).__setitem__("dens", 1.3)
        # rear: AC inlet + switch + honeycomb
        F.B("ac_inlet", -50, D / 2, 30, -24, D / 2 + 1.5, 52, m["plastic"], bev=0.8)
        F.B("ac_pins", -46, D / 2 + 1.2, 35, -28, D / 2 + 1.8, 47, m["rubber"], bev=0.3)
        F.B("switch", -16, D / 2, 36, -6, D / 2 + 2.5, 48, m["plastic"], bev=0.8)
        for i in range(10):
            F.B(f"vent{i}", 4 + i * 6.5, D / 2 - 0.3, 10, 7 + i * 6.5, D / 2 + 0.3, 76, m["rubber"], bev=0.2, seg=1)
        # front modular sockets
        for i, (x, w) in enumerate([(-60, 32), (-24, 12), (-8, 12), (8, 12), (24, 12), (40, 22)]):
            F.B(f"mod{i}", x, -D / 2 - 1.2, 8, x + w, -D / 2 + 0.4, 18 if i else 26, m["rubber"], bev=0.3)
    else:
        F.B("floor", -W / 2, -D / 2, 0, W / 2, D / 2, 1.2, m["case_black"], bev=0.6)
        F.B("wall_r", W / 2 - 1.2, -D / 2, 0, W / 2, D / 2, 40, m["case_black"], bev=0.5)
        F.B("wall_b", -W / 2, D / 2 - 1.2, 0, W / 2, D / 2, 40, m["case_black"], bev=0.5)
        F.B("pcb", -W / 2 + 4, -D / 2 + 4, 4, W / 2 - 4, D / 2 - 4, 5.6, T("psu_pcb", "psu_pcb.png", (150, 120, 60)), bev=0.3, seg=1)
        z = 5.6
        cap(F, "bulk", -40, 38, z, 15, 40, m)
        F.C("pfc_choke", -8, 38, z + 1, 16, 16, m["copper"], seg=48, bev=3)
        ring("pfc_core", 6 * MM, 15 * MM, 12 * MM, (-8 * MM, 38 * MM, (z + 9) * MM), m["copper"], F.p)
        # main transformer
        F.B("xfmr_core", 4, -16, z, 34, 6, z + 32, m["ferrite"], bev=1.0)
        F.B("xfmr_tape", 8, -18, z + 4, 30, 8, z + 28, m["yellow_tape"], bev=2.5, seg=3)
        # heatsinks with fins
        for k, x0 in enumerate((-60, 44)):
            F.B(f"hs{k}", x0, -50, z, x0 + 4, 50, z + 40, m["alu"], bev=0.6)
            fin = F.B(f"hs{k}_fin", x0 + 4, -50, z + 6, x0 + 14, -48.6, z + 40, m["alu"], bev=0.3)
            array(fin, 26, (0, 3.8 * MM, 0))
            for j in range(4):
                F.B(f"fet{k}{j}", x0 - 4.5, -40 + j * 22, z, x0, -30 + j * 22, z + 15, m["plastic"], bev=0.5)
        for i in range(10):
            cap(F, f"ocap{i}", 40 + (i % 5) * 7 - 20, -46 + (i // 5) * 8, z, 3.2, 12, m, sleeve=m["cap_blue"])
        for i in range(8):
            cap(F, f"scap{i}", -30 + i * 6, -58, z, 2.2, 7, m)
        F.B("out_board", -60, -D / 2, z, 62, -D / 2 + 6, z + 18, m["pcb_black"], bev=0.3)
        for i, (x, w) in enumerate([(-60, 32), (-24, 12), (-8, 12), (8, 12), (24, 12), (40, 22)]):
            F.B(f"mod{i}", x, -D / 2 - 1.2, z + 2, x + w, -D / 2 + 4, z + 14, m["plastic"], bev=0.3)
        F.B("ac_inlet", -50, D / 2 - 8, 30, -24, D / 2, 52, m["plastic"], bev=0.8)
        # lid with fan, lifted & tilted
        Lf = F.sub("lid", (0, 118, 80), xaxis=(1, 0, 0), yaxis=(0, math.cos(1.9), math.sin(1.9)))
        Lf.B("lid", -W / 2, -D / 2, 0, W / 2, D / 2, 1.2, m["case_black"], bev=0.6)
        Lf.B("lid_l", -W / 2, -D / 2, 1.2, -W / 2 + 1.2, D / 2, 44, m["case_black"], bev=0.5)
        Lf.B("lid_f", -W / 2, -D / 2, 1.2, W / 2, -D / 2 + 1.2, 44, m["case_black"], bev=0.5)
        Fn = Lf.sub("lidfan", (0, 0, 14))
        fan(Fn, "pfan", 120, 25, m)
        F.A("xfmr", 19, -5, z + 34)
        F.A("bulk", -40, 38, z + 41)
        F.A("pfc", -8, 38, z + 18)
        F.A("hs", -58, 0, z + 41)
        F.A("fan", 0, 108, 92)
        F.A("out", 0, -D / 2, z + 16)
        F.A("ocap", 15, -42, z + 13)


# ------------------------------------------------------------------ case
CASE = dict(x0=-0.105, x1=0.105, y0=-0.225, y1=0.225, z0=0.02, z1=0.48)


def build_case(F, m):
    """Case frame in world mm (F is a frame at world origin)."""
    x0, x1, y0, y1, z0, z1 = (v * 1000 for v in (CASE["x0"], CASE["x1"], CASE["y0"], CASE["y1"], CASE["z0"], CASE["z1"]))
    t = 1.2
    cb, ci = m["case_black"], m["case_inner"]
    # right steel side panel (+X) with inner face
    F.B("side_r", x1 - t, y0 + 10, z0 + 4, x1, y1 - 2, z1 - 4, cb, bev=1.0, dens=0.75)
    # top panel with mesh filter
    F.B("top", x0 + 2, y0 + 10, z1 - t, x1, y1, z1, cb, bev=1.0)
    F.B("top_filter", x0 + 18, y0 + 40, z1, x1 - 18, y1 - 40, z1 + 0.8, m["front_mesh"], bev=0.6)
    # bottom
    F.B("bottom", x0 + 2, y0 + 10, z0, x1, y1, z0 + t, cb, bev=1.0)
    # rear panel with openings: PSU window (bottom), I/O cutout, fan grille, slot area
    psu_z1 = 112
    F.B("rear_low", x0 + 2, y1 - t, z0, x1, y1, z0 + 4, cb, bev=0.5)
    F.B("rear_psu_l", x0 + 2, y1 - t, z0, -77, y1, psu_z1, cb, bev=0.5)
    F.B("rear_psu_r", 77, y1 - t, z0, x1, y1, psu_z1, cb, bev=0.5)
    F.B("rear_mid", x0 + 2, y1 - t, psu_z1, x1, y1, 118, cb, bev=0.5)
    # expansion slot covers (7) between z=118 and 290, x from -40 to 70 ... slots are horizontal strips
    for i in range(7):
        zc = 140 + 130.5 - 20.32 * i
        if zc > 220 or abs(zc - 190.5) < 5:
            continue  # GPU (2 slots) and NIC brackets sit here
        F.B(f"slotcover{i}", -45, y1 - 0.6, zc - 8.5, 72, y1 + 0.6, zc + 8.5, ci, bev=0.4)
    F.B("rear_slot_l", x0 + 2, y1 - t, 118, -46, y1, 292, cb, bev=0.5)
    F.B("rear_slot_r", 74, y1 - t, 118, x1, y1, 292, cb, bev=0.5)
    F.B("rear_upper", x0 + 2, y1 - t, 292, x1, y1, z1, cb, bev=0.5)
    # I/O shield (motherboard I/O pokes through)
    F.B("io_shield", 44, y1 - 0.4, 290, 86, y1 + 0.4, 445, m["steel"], bev=0.3)
    # rear fan grille rings on upper rear (fan centre)
    rf = (-18, 380)
    for i, r in enumerate((18, 32, 46, 56)):
        ring(f"rgrill{i}", (r - 1.2) * MM, (r + 1.2) * MM, 1.4 * MM, (rf[0] * MM, (y1 + 0.8) * MM, rf[1] * MM), m["case_black"], F.p, rot=(math.pi / 2, 0, 0), seg=64)
    # front panel: thick fascia with mesh insert and an aluminium accent edge
    F.B("front", x0, y0, z0, x1, y0 + 14, z1, cb, bev=3.0, seg=3, dens=1.6)
    Fm = F.sub("front_mesh_f", (0, y0, 0), xaxis=(1, 0, 0), yaxis=(0, 0, 1))
    Fm.B("front_mesh", x0 + 14, z0 + 16, -2, x1 - 14, z1 - 16, 0.8, m["front_mesh"], bev=1.2)
    F.B("front_io", x0 + 30, y0 + 20, z1 - 0.6, x1 - 30, y0 + 46, z1 + 1.0, m["plastic"], bev=1.0)
    F.C("power_btn", 0, y0 + 33, z1 + 0.6, 5.5, 1.6, m["alu"], seg=40, bev=0.5)
    F.C("power_led", 0, y0 + 33, z1 + 2.15, 4.0, 0.3, m["led_white"], seg=40, bev=0)
    for i, x in enumerate((-56, -40, 40, 56)):
        F.B(f"fusb{i}", x - 6, y0 + 30, z1 + 0.9, x + 6, y0 + 36, z1 + 1.2, m["usb_blue"] if i < 2 else m["plastic"], bev=0.3)
    # glass-side frame posts (black frit border is part of the glass panel object below)
    F.B("post_front", x0, y0 + 10, z0, x0 + 12, y0 + 22, z1, cb, bev=0.8, dens=2.0)
    F.B("post_rear", x0, y1 - 12, z0, x0 + 12, y1, z1, cb, bev=0.8, dens=2.0)
    # glass border frit (the glass itself is drawn by the viewer)
    g = 0.6
    for nm, a in (("frit_top", (y0 + 14, z1 - 22, y1 - 2, z1 - 2)), ("frit_bot", (y0 + 14, z0 + 2, y1 - 2, z0 + 22)),
                  ("frit_front", (y0 + 14, z0 + 2, y0 + 34, z1 - 2)), ("frit_rear", (y1 - 22, z0 + 2, y1 - 2, z1 - 2))):
        F.B(nm, x0 - g, a[0], a[1], x0, a[2], a[3], m["frit"], bev=0.3, dens=2.0)
    for i, (yy, zz) in enumerate([(y0 + 24, z0 + 12), (y1 - 12, z0 + 12), (y0 + 24, z1 - 12), (y1 - 12, z1 - 12)]):
        F.C(f"thumbscrew{i}", yy, zz, x0 - 4, 4.5, 3.4, m["alu"], axis="x", seg=28, bev=0.6)
    # motherboard tray (inner) with grommets
    F.B("tray", 86, y0 + 40, z0 + 4, 88, y1 - 6, z1 - 4, ci, bev=0.6)
    for i, zz in enumerate((150, 240, 330)):
        F.B(f"grommet{i}", 84.5, -62, zz, 86.2, -50, zz + 70, m["rubber"], bev=3.0, seg=3)
    F.B("grommet_top", 0, 150, 455, 60, 175, 457, m["rubber"], bev=2.0, seg=3)
    # PSU floor rails + HDD sled rails
    F.B("psu_rail_a", -76, 60, z0 + t, -70, 210, z0 + 4, ci, bev=0.5)
    F.B("psu_rail_b", 70, 60, z0 + t, 76, 210, z0 + 4, ci, bev=0.5)
    F.B("hdd_rail_a", -56, -176, z0 + t, -51, -18, z0 + 12, m["alu_dark"], bev=0.6)
    F.B("hdd_rail_b", 51, -176, z0 + t, 56, -18, z0 + 12, m["alu_dark"], bev=0.6)
    # feet
    for i, (xx, yy) in enumerate([(-80, -190), (80, -190), (-80, 190), (80, 190)]):
        F.B(f"foot{i}", xx - 14, yy - 22, 0, xx + 14, yy + 22, z0, m["rubber"], bev=3.0, seg=3)
    # front intake fans (3) behind the fascia, rear exhaust fan
    for i, zc in enumerate((100, 228, 356)):
        G = F.sub(f"ffan{i}", (0, y0 + 30, zc), xaxis=(1, 0, 0), yaxis=(0, 0, 1))
        fan(G, f"ff{i}", 120, 25, m)
    G = F.sub("rfan", (rf[0], y1 - 14, rf[1]), xaxis=(1, 0, 0), yaxis=(0, 0, -1))
    fan(G, "rf", 120, 25, m)
    # cables (sleeved): 24-pin, EPS, GPU power, SATA
    s = m["sleeve"]
    bx = board_world
    a24 = bx(233, 226, 14)
    for k in range(4):
        off = (k - 1.5) * 4.5 * MM
        cable(f"cab24_{k}", [(a24[0] + 0.004, a24[1], a24[2] + off), (a24[0] - 0.012, a24[1] - 0.012, a24[2] + off),
                             (0.084 - 0.004, -0.056, 0.30 + off), (0.09, -0.056, 0.26 + off)], 2.1 * MM, s, F.p)
    ae = bx(23, 298, 13)
    for k in range(2):
        off = (k - 0.5) * 4.5 * MM
        cable(f"cabeps_{k}", [(ae[0] + 0.003, ae[1] + off, ae[2]), (ae[0] - 0.01, ae[1] + off, ae[2] + 0.004), (0.03, 0.162 + off, 0.455), (0.03, 0.162 + off, 0.47)], 2.0 * MM, s, F.p)
    gp = gpu_world((215, 121, 6))
    for k in range(3):
        off = (k - 1) * 4.5 * MM
        cable(f"cabgpu_{k}", [(gp[0] - 0.004, gp[1] + off, gp[2]), (gp[0] - 0.022, gp[1] + off, gp[2] - 0.025),
                              (gp[0] - 0.012, gp[1] + 0.02 + off, 0.14), (-0.03 + off, PSU_CENTER[1] - 0.09, 0.05), (-0.03 + off, PSU_CENTER[1] - 0.071, 0.037)], 2.0 * MM, s, F.p)
    hp = hdd_world((7, 78, 5))
    cable("cabhddp", [(hp[0], hp[1] + 0.006, hp[2]), (hp[0] + 0.01, hp[1] + 0.04, hp[2] + 0.015), (0.03, PSU_CENTER[1] - 0.09, 0.04), (0.03, PSU_CENTER[1] - 0.071, 0.037)], 1.8 * MM, s, F.p)
    sa = bx(245, 61.5, 5)
    hd = hdd_world((-21, 78, 5))
    cable("cabsata", [(sa[0], sa[1] - 0.004, sa[2]), (sa[0] + 0.002, sa[1] - 0.03, sa[2] - 0.02), (hd[0] + 0.01, hd[1] + 0.04, hd[2] + 0.02), (hd[0], hd[1] + 0.008, hd[2])], 1.3 * MM, m["plastic_gray"], F.p)
    F.A("glass", (x0 - 1), 0, (z0 + z1) / 2)
    # waypoints that keep the power paths on the cable routes
    py = PSU_CENTER[1] * 1000
    F.A("pw_a", 30, py - 78, 60)
    F.A("pw_b", 74, -45, 75)
    F.A("pw_c", 74, -45, 330)
    F.A("pw_top", 70, -40, 458)
    F.A("pw_eps", 40, 175, 462)
    F.A("pw_g", -30, py - 95, 160)
    F.A("pw_h", 10, -5, 45)
    F.A("front_fans", 0, y0 + 30, 228)
    F.A("rear_fan", rf[0], y1 - 14, rf[1])


# world placement helpers for cards / drives -----------------------------------------
GPU_Z = 0.14 + 0.1305
NIC_Z = 0.14 + 0.0505
GPU_ORIGIN_X = BOARD_ORIGIN[0] - SLOT_TOP * MM


def gpu_world(p):
    x, y, z = p
    return (GPU_ORIGIN_X - y * MM, CARD_Y - x * MM, GPU_Z - z * MM)


HDD_CENTER = (0.0, -0.095, 0.02 + 0.0012 + 0.003)


def hdd_world(p):
    x, y, z = p
    return (HDD_CENTER[0] + x * MM, HDD_CENTER[1] + y * MM, HDD_CENTER[2] + z * MM)


PSU_CENTER = (0.0, 0.1535, 0.02 + 0.004)


# ------------------------------------------------------------------ assembly
EXTERIOR_PARTS = ["case", "board", "cpu", "ram", "ssd", "gpu", "nic", "hdd", "psu"]


def build_exterior():
    m = M()
    roots = {}

    def root(name, loc):
        roots[name] = empty(name, loc)
        return roots[name]

    # roots at sensible world centres (identity rotation)
    r_case = root("case", (0, 0, 0.25))
    r_board = root("board", board_world(122, 152, 0))
    r_cpu = root("cpu", board_world(SOCKET[0], SOCKET[1], 60))
    r_ram = root("ram", board_world(166, 229, 20))
    r_ssd = root("ssd", board_world(92, 155, 4))
    r_gpu = root("gpu", gpu_world((150, 57, 20)))
    r_nic = root("nic", (GPU_ORIGIN_X - 0.034, CARD_Y - 0.06, NIC_Z - 0.005))
    r_hdd = root("hdd", (HDD_CENTER[0], HDD_CENTER[1], HDD_CENTER[2] + 0.013))
    r_psu = root("psu", (PSU_CENTER[0], PSU_CENTER[1], PSU_CENTER[2] + 0.043))

    def board_frame(r):
        e = empty(r.name + "_bf", parent=r, matrix=r.matrix_world.inverted() @ frame_matrix(BOARD_ORIGIN, BOARD_X, BOARD_Y))
        return Frame(e)

    bpy_update()
    build_board(board_frame(r_board), m)
    Fc = board_frame(r_cpu)
    G = Fc.sub("cpu_pkg", (SOCKET[0], SOCKET[1], 0))
    cpu_package(G, m)
    build_cooler(Fc, m)
    Fc.A("cpu", SOCKET[0], SOCKET[1], 9)
    build_ram(board_frame(r_ram), m)
    build_ssd(board_frame(r_ssd), m)

    def card_frame(r, z_world):
        org = (GPU_ORIGIN_X, CARD_Y, z_world)
        e = empty(r.name + "_cf", parent=r, matrix=r.matrix_world.inverted() @ frame_matrix(org, (0, -1, 0), (-1, 0, 0)))
        return Frame(e)

    Fg = card_frame(r_gpu, GPU_Z)
    gpu(Fg, m)
    Fg.A("die", 100, 56, 2)
    Fg.A("pcie", 70, -4, 0.8)
    Fg.A("power", 215, 121, 6)
    Fn = card_frame(r_nic, NIC_Z)
    nic(Fn, m)
    Fn.A("chip", 57, 29, 10)
    Fn.A("pcie", 40, -4, 0.8)
    Fn.A("rj45", -1, 28, 8)

    eh = empty("hdd_f", parent=r_hdd, matrix=r_hdd.matrix_world.inverted() @ frame_matrix(HDD_CENTER, (1, 0, 0), (0, 1, 0)))
    Fh = Frame(eh)
    hdd_shell(Fh, m)
    Fh.A("hdd", 0, 0, 27)
    Fh.A("sata", -21, 78, 5)
    ep = empty("psu_f", parent=r_psu, matrix=r_psu.matrix_world.inverted() @ frame_matrix(PSU_CENTER, (1, 0, 0), (0, 1, 0)))
    Fp = Frame(ep)
    psu(Fp, m)
    Fp.A("psu", 0, -70, 60)
    Fp.A("out", 0, -71, 14)
    ec = empty("case_f", parent=r_case, matrix=r_case.matrix_world.inverted())
    build_case(Frame(ec), m)
    return roots


def bpy_update():
    import bpy
    bpy.context.view_layer.update()


INTERIOR_BUILDERS = {}


def build_interior(part):
    m = M()
    r = empty(part + "_open", (0, 0, 0))
    F = Frame(r)
    if part == "cpu":
        build_cpu_open(F, m)
    elif part == "ram":
        build_ram_open(F, m)
    elif part == "ssd":
        build_ssd_open(F, m)
    elif part == "hdd":
        build_hdd_open(F, m)
    elif part == "gpu":
        G = F.sub("card", (-136, -56, 0))
        gpu(G, m, opened=True)
        # heatsink + shroud lifted
        H = F.sub("hs_lift", (-136, -56 + 70, 60))
        H.B("fin", 12, 6, 0, 292, 108, 34, T("fins_x", "fins_x.png", (190, 192, 198), side="box", metal=1.0, rough=0.35), bev=0.2, seg=1)
        H.B("coldplate", 86, 42, -3, 114, 70, 0, m["copper"], bev=0.4)
        for i in range(4):
            H.C(f"hp{i}", 30 + i * 16, 4 + (i % 2) * 6, 12, 3.0, 280, m["copper"], axis="x", seg=14, bev=0)
        S = F.sub("shroud_lift", (-136, -56 + 140, 120))
        plate = S.B("shroud_plate", 2, -4, 0, 300, 118, 5, m["gunmetal"], bev=1.6, seg=3)
        for i, x in enumerate((60, 155, 250)):
            c = S.C(f"fanhole{i}", x, 57, -2, 45, 10, m["plastic"], seg=72, bev=0)
            cut(plate, c)
            Gf = S.sub(f"gfan{i}", (x, 57, -6))
            fan(Gf, f"gf{i}", 90, 8, m, frame=False, blades=11)
        F.A("die", -136 + 100, -56 + 56, 4)
        F.A("vram", -136 + 68, -56 + 64, 3)
        F.A("vrm", -136 + 190, -56 + 84, 8)
        F.A("pcie", -136 + 70, -56 - 4, 1)
        F.A("heatsink", -136 + 150, -56 + 125, 95)
        F.A("fan", -136 + 155, -56 + 200, 125)
        F.A("power", -136 + 215, -56 + 110, 11)
    elif part == "psu":
        psu(F, m, opened=True)
    elif part == "nic":
        build_nic_open(F, m)
    elif part == "board":
        bf = F.sub("bf", (-122, -152.5, 0))
        build_board(bf, m, opened=True)
    return r
