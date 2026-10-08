"""Entry point (run inside Blender):

  blender -b -P tools/pc-splat/build.py -- exterior [--preview] [--scale 0.2] [--only gpu,cpu]
  blender -b -P tools/pc-splat/build.py -- interior cpu [--preview] [--scale 0.2]

Writes build/ply/<part>.ply (+ _open), build/meta/<name>.json and build/preview/*.png
"""
import math
import os
import sys
import time

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

import bpy  # noqa: E402
import numpy as np  # noqa: E402
from mathutils import Vector  # noqa: E402

import lib  # noqa: E402
import model  # noqa: E402
import splat  # noqa: E402

BUILD = os.path.join(HERE, "build")
for d in ("ply", "meta", "preview"):
    os.makedirs(os.path.join(BUILD, d), exist_ok=True)

# splat budgets (closed PC total <= ~700k, each interior <= ~250k)
EXT_BUDGET = dict(case=168_000, board=190_000, cpu=76_000, ram=30_000, ssd=14_000, gpu=114_000, nic=22_000, hdd=32_000, psu=50_000)
INT_BUDGET = dict(cpu=240_000, ram=240_000, ssd=230_000, hdd=245_000, gpu=245_000, psu=245_000, nic=230_000, board=245_000)
# per-interior AO radius / max splat sigma / max triangle area before subdivision (m, m, m^2)
INT_PARAMS = dict(
    cpu=(0.004, 0.0006, 4e-6), ram=(0.006, 0.0008, 1e-5), ssd=(0.004, 0.0005, 4e-6), hdd=(0.008, 0.0010, 2e-5),
    gpu=(0.010, 0.0012, 4e-5), psu=(0.010, 0.0012, 4e-5), nic=(0.006, 0.0008, 1e-5), board=(0.010, 0.0012, 4e-5),
)


def args():
    a = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    opts = dict(mode=a[0] if a else "exterior", part=None, preview="--preview" in a, scale=1.0, only=None, noply="--noply" in a)
    if opts["mode"] == "interior":
        opts["part"] = a[1]
    if "--scale" in a:
        opts["scale"] = float(a[a.index("--scale") + 1])
    if "--only" in a:
        opts["only"] = a[a.index("--only") + 1].split(",")
    return opts


def setup_render(res=(1000, 720), samples=40):
    sc = bpy.context.scene
    sc.render.engine = "CYCLES"
    sc.cycles.device = "CPU"
    sc.cycles.samples = samples
    sc.cycles.use_denoising = False  # distro build has no OIDN
    sc.cycles.sample_clamp_indirect = 2.0
    sc.cycles.max_bounces = 4
    sc.render.resolution_x, sc.render.resolution_y = res
    sc.render.resolution_percentage = 100
    sc.view_settings.view_transform = "AgX"
    sc.view_settings.look = "AgX - Medium High Contrast"
    world = bpy.data.worlds.new("w")
    world.use_nodes = True
    bg = world.node_tree.nodes["Background"]
    bg.inputs["Color"].default_value = (0.02, 0.022, 0.026, 1)
    bg.inputs["Strength"].default_value = 1.0
    sc.world = world
    for nm, d, e, sz in (("key", splat.LIGHT_KEY, 220, 0.8), ("fill", splat.LIGHT_FILL, 60, 1.2), ("rim", splat.LIGHT_RIM, 90, 0.8)):
        L = bpy.data.lights.new(nm, "AREA")
        L.energy = e
        L.size = sz
        o = bpy.data.objects.new(nm, L)
        sc.collection.objects.link(o)
        o.location = Vector(d) * 1.6 + Vector((0, 0, 0.25))
        o.rotation_euler = (-Vector(d)).to_track_quat("-Z", "Y").to_euler()


def camera_shot(path, target, direction, dist, lens=50):
    sc = bpy.context.scene
    cam = bpy.data.objects.get("cam")
    if cam is None:
        cd = bpy.data.cameras.new("cam")
        cam = bpy.data.objects.new("cam", cd)
        sc.collection.objects.link(cam)
        sc.camera = cam
    cam.data.lens = lens
    cam.data.clip_start = 0.002
    d = Vector(direction).normalized()
    cam.location = Vector(target) + d * dist
    cam.rotation_euler = (-d).to_track_quat("-Z", "Y").to_euler()
    sc.render.filepath = path
    t = time.time()
    bpy.ops.render.render(write_still=True)
    print(f"[render] {os.path.basename(path)} {time.time()-t:.0f}s", flush=True)


def exterior(o):
    lib.reset()
    roots = model.build_exterior()
    bpy.context.view_layer.update()
    meta = dict(parts={})
    if not o["noply"]:
        board_bvh = splat.scene_bvh([roots["board"]])
        case_bvh = splat.scene_bvh([roots["case"]])
        dirs = splat.fib_dirs(40)
        for name in model.EXTERIOR_PARTS:
            if o["only"] and name not in o["only"]:
                continue
            ao = {"board": [case_bvh], "case": [board_bvh]}.get(name, [board_bvh, case_bvh])
            vd = dirs[dirs[:, 2] > -0.3] if name == "case" else dirs
            n = int(EXT_BUDGET[name] * o["scale"])
            cnt = splat.bake(roots[name], n, os.path.join(BUILD, "ply", name + ".ply"), ao, 0.03, vd, seed=hash(name) % 1000,
                             max_sigma=0.004, k_sigma=0.72, amax=2.5e-4)
            meta["parts"][name] = dict(count=cnt, **splat.part_meta(roots[name]))
        path = os.path.join(BUILD, "meta", "exterior.json" if not o["only"] else "exterior_partial.json")
        splat.write_json(path, meta)
    if o["preview"]:
        setup_render()
        camera_shot(os.path.join(BUILD, "preview", "exterior.png"), (0, 0, 0.25), (-1.0, -1.05, 0.62), 1.45)
        camera_shot(os.path.join(BUILD, "preview", "exterior_side.png"), (0.03, 0.04, 0.27), (-1.0, -0.12, 0.18), 0.82)


def interior(o):
    lib.reset()
    part = o["part"]
    root = model.build_interior(part)
    bpy.context.view_layer.update()
    ao_d, msig, amax = INT_PARAMS[part]
    if not o["noply"]:
        n = int(INT_BUDGET[part] * o["scale"])
        cnt = splat.bake(root, n, os.path.join(BUILD, "ply", part + "_open.ply"), [], ao_d, splat.fib_dirs(48), seed=7,
                         max_sigma=msig, k_sigma=0.72, amax=amax)
        meta = dict(count=cnt, **splat.part_meta(root))
        splat.write_json(os.path.join(BUILD, "meta", part + "_open.json"), meta)
    if o["preview"]:
        setup_render((1100, 800), 40)
        bb = splat.part_meta(root)["bbox"]
        lo, hi = np.array(bb[0]), np.array(bb[1])
        c3 = (lo + hi) / 2  # three axes
        c = (c3[0], -c3[2], c3[1])
        size = float(np.linalg.norm(hi - lo))
        camera_shot(os.path.join(BUILD, "preview", part + "_open.png"), c, (-0.35, -1.0, 0.85), size * 1.25)


if __name__ == "__main__":
    t0 = time.time()
    o = args()
    if o["mode"] == "exterior":
        exterior(o)
    else:
        interior(o)
    print(f"[done] {o['mode']} {o['part'] or ''} in {time.time()-t0:.0f}s", flush=True)
