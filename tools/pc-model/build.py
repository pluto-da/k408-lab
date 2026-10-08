"""Entry point (run inside Blender):

  blender -b -P tools/pc-model/build.py -- exterior [--preview] [--noglb] [--samples 48]
  blender -b -P tools/pc-model/build.py -- interior cpu [--preview] [--noglb]

Writes build/glb/<part>.glb (+ <part>_open.glb), build/meta/<name>.json, build/meta/materials.json
and Cycles previews in build/preview/*.png
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

import export  # noqa: E402
import lib  # noqa: E402
import model  # noqa: E402

BUILD = os.path.join(HERE, "build")
for d in ("glb", "meta", "preview"):
    os.makedirs(os.path.join(BUILD, d), exist_ok=True)

# max edge length before splitting for AO (m) and AO distance (m)
EXT_LMAX = dict(case=0.012, board=0.004)
EXT_LMAX_DEFAULT = 0.006
INT_PARAMS = dict(  # (ao distance, lmax)
    cpu=(0.004, 0.0015), ram=(0.006, 0.003), ssd=(0.004, 0.0012), hdd=(0.010, 0.004),
    gpu=(0.012, 0.006), psu=(0.012, 0.007), nic=(0.006, 0.003), board=(0.012, 0.006),
)


def args():
    a = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    opts = dict(mode=a[0] if a else "exterior", part=None, preview="--preview" in a, noglb="--noglb" in a, samples=48, hero="--hero" in a)
    if opts["mode"] == "interior":
        opts["part"] = a[1]
    opts["lmax"] = float(a[a.index("--lmax") + 1]) if "--lmax" in a else 1.0
    if "--samples" in a:
        opts["samples"] = int(a[a.index("--samples") + 1])
    return opts


def studio(res=(1180, 820), samples=64):
    """Photographic studio: large soft key, strip rim lights, gentle fill, dark seamless backdrop."""
    sc = bpy.context.scene
    sc.render.engine = "CYCLES"
    sc.cycles.device = "CPU"
    sc.cycles.samples = samples
    sc.cycles.use_denoising = False
    sc.cycles.sample_clamp_indirect = 1.5
    sc.cycles.max_bounces = 6
    sc.cycles.transmission_bounces = 6
    sc.render.resolution_x, sc.render.resolution_y = res
    sc.render.resolution_percentage = 100
    sc.render.film_transparent = False
    sc.view_settings.view_transform = "AgX"
    sc.view_settings.look = "AgX - Base Contrast"
    sc.view_settings.exposure = 0.0
    world = bpy.data.worlds.new("studio")
    world.use_nodes = True
    bg = world.node_tree.nodes["Background"]
    bg.inputs["Color"].default_value = (0.012, 0.013, 0.016, 1)
    bg.inputs["Strength"].default_value = 1.0
    sc.world = world
    rigs = (
        ("key", "AREA", (-0.9, -0.75, 1.0), 260, (0.9, 0.6)),
        ("fill", "AREA", (1.1, -0.6, 0.45), 45, (1.4, 1.4)),
        ("rimL", "AREA", (-0.8, 0.9, 0.5), 120, (0.12, 1.2)),
        ("rimR", "AREA", (0.9, 0.85, 0.7), 90, (0.12, 1.2)),
        ("top", "AREA", (0.0, 0.0, 1.4), 110, (1.2, 0.8)),
    )
    for nm, typ, pos, e, sz in rigs:
        L = bpy.data.lights.new(nm, typ)
        L.energy = e
        L.shape = "RECTANGLE"
        L.size, L.size_y = sz
        o = bpy.data.objects.new(nm, L)
        sc.collection.objects.link(o)
        o.location = Vector(pos) + Vector((0, 0, 0.25))
        d = (Vector((0, 0, 0.25)) - o.location).normalized()
        o.rotation_euler = d.to_track_quat("-Z", "Y").to_euler()
    # seamless floor
    bpy.ops.mesh.primitive_plane_add(size=6, location=(0, 0, 0))
    fl = bpy.context.active_object
    fm = bpy.data.materials.new("floor")
    fm.use_nodes = True
    b = fm.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (0.03, 0.032, 0.036, 1)
    b.inputs["Roughness"].default_value = 0.35
    fl.data.materials.append(fm)


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


def hide_sources(roots):
    for r in roots:
        for o in export.descendants(r):
            o.hide_render = True
            o["nosplat"] = 1


def exterior(o):
    lib.reset()
    roots = model.build_exterior()
    bpy.context.view_layer.update()
    meta = dict(parts={})
    if not o["noglb"]:
        objs = {}
        for name in model.EXTERIOR_PARTS:
            objs[name] = export.realise_part(roots[name], name, EXT_LMAX.get(name, EXT_LMAX_DEFAULT) * o["lmax"])
        hide_sources(roots.values())
        for name, ob in objs.items():
            export.place_world(ob, roots[name])
        bpy.context.view_layer.update()
        export.bake_ao(list(objs.values()), 0.03, o["samples"])
        for name, ob in objs.items():
            tris = export.export_glb(ob, os.path.join(BUILD, "glb", name + ".glb"))
            export.place_world(ob, roots[name])
            meta["parts"][name] = dict(tris=tris, **export.part_meta(roots[name], ob))
        export.write_json(os.path.join(BUILD, "meta", "exterior.json"), meta)
        export.materials_json(os.path.join(BUILD, "meta", "materials.json"))
    if o["hero"]:
        # home page still: same three-quarter view as the 3D page, rendered larger and downsampled (no denoiser here)
        studio((1652, 1148), 40)
        bpy.context.scene.world.node_tree.nodes["Background"].inputs["Color"].default_value = (0.006, 0.007, 0.009, 1)
        out = os.path.join(BUILD, "preview", "home_pc.png")
        camera_shot(out, (0.0, 0.0, 0.245), (-1.0, -0.95, 0.42), 1.42, lens=55)
    if o["preview"]:
        studio()
        camera_shot(os.path.join(BUILD, "preview", "exterior.png"), (0, 0, 0.25), (-1.0, -1.05, 0.55), 1.35)
        camera_shot(os.path.join(BUILD, "preview", "exterior_side.png"), (0.03, 0.04, 0.27), (-1.0, -0.12, 0.18), 0.82)


def interior(o):
    lib.reset()
    part = o["part"]
    root = model.build_interior(part)
    bpy.context.view_layer.update()
    if "--asm" in sys.argv:  # preview the assembled pose (debug)
        from mathutils import Matrix
        for L in export.layer_roots(root):
            L.matrix_local = Matrix([L["asm"][i * 4:(i + 1) * 4] for i in range(4)])
        bpy.context.view_layer.update()
    ao_d, lmax = INT_PARAMS[part]
    ob = None
    if not o["noglb"]:
        layers = export.layer_roots(root)
        base = export.realise_part(root, part + "_open", lmax * o["lmax"], stop_layers=True)
        objs = [base]
        for L in layers:
            lo = export.realise_part(root, "L_" + L["layer"], lmax * o["lmax"], src=L, stop_layers=False)
            objs.append(lo)
        hide_sources([root])
        for x in objs:
            export.place_world(x, root)
        bpy.context.view_layer.update()
        export.bake_ao(objs, ao_d, o["samples"])
        tris = export.export_glb(objs, os.path.join(BUILD, "glb", part + "_open.glb"))
        for x in objs:
            export.place_world(x, root)
        meta = dict(tris=tris, **export.part_meta(root, objs))
        meta["layers"] = export.layer_meta(root, layers)
        meta["anchorLayer"] = export.anchor_layers(root)
        export.write_json(os.path.join(BUILD, "meta", part + "_open.json"), meta)
        export.materials_json(os.path.join(BUILD, "meta", "materials.json"))
        ob = objs
    if o["preview"]:
        studio((1180, 820), 48)
        bb = export.part_meta(root, ob)["bbox"]
        lo, hi = np.array(bb[0]), np.array(bb[1])
        c3 = (lo + hi) / 2
        c = (c3[0], -c3[2], c3[1])
        size = float(np.linalg.norm(hi - lo))
        bpy.data.objects["Plane"].location.z = float(lo[1]) - 0.002
        camera_shot(os.path.join(BUILD, "preview", part + ("_asm" if "--asm" in sys.argv else "") + "_open.png"), c, (-0.35, -1.0, 0.85), size * 1.25)


if __name__ == "__main__":
    t0 = time.time()
    o = args()
    if o["mode"] == "exterior":
        exterior(o)
    else:
        interior(o)
    print(f"[done] {o['mode']} {o['part'] or ''} in {time.time()-t0:.0f}s", flush=True)
