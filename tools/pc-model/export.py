"""Part export (runs inside Blender): realise every modelled object of a part into one mesh,
give it UVs, bake ambient occlusion into a colour attribute with Cycles and write a GLB.

For every part root (an empty) all descendant meshes/curves are evaluated (modifiers, booleans,
curve bevels applied), moved into the root's local frame and joined, so the viewer draws each part
with one draw call per material.

UVs
  * textured materials keep the original look: the image is mapped on the object's local bbox
    (Blender 'Generated' coordinates) on the faces selected by tex_side; the other faces of that
    object get a plain twin material '<name>__plain'.
  * every other face gets metric box-projected UVs (1 UV unit = 5 cm) so the viewer can tile
    fine finish maps (brushed aluminium, powder coat, braided sleeving) at real scale.

Ambient occlusion is baked per corner into the colour attribute 'ao' (exported as COLOR_0).
Long edges are split first so contact shadows have enough vertices to live on.
"""
import json
import math
import os
import time

import bmesh
import bpy
import numpy as np
from mathutils import Matrix, Vector

from lib import MATS, srgb2lin

UV_TILE = 0.05  # metres per UV unit for tiling finish maps


def descendants(root):
    out = []
    stack = list(root.children)
    while stack:
        o = stack.pop()
        stack.extend(o.children)
        if o.type in ("MESH", "CURVE") and not o.hide_render and not o.get("nosplat"):
            out.append(o)
    return out


def _plain_twin(m):
    name = m.name + "__plain"
    if name in bpy.data.materials:
        return bpy.data.materials[name]
    src = MATS[m.name]
    t = bpy.data.materials.new(name)
    t.use_nodes = True
    b = t.node_tree.nodes["Principled BSDF"]
    sb = m.node_tree.nodes["Principled BSDF"]
    for k in ("Metallic", "Roughness", "Coat Weight", "Coat Roughness"):
        b.inputs[k].default_value = sb.inputs[k].default_value
    b.inputs["Base Color"].default_value = [srgb2lin(c) for c in src["color"]] + [1.0]
    MATS[name] = dict(src, tex=None)
    return t


def _realise(o, dg, root_inv):
    """Evaluated copy of o as a new mesh in root-local coordinates, with UVs and final materials."""
    ev = o.evaluated_get(dg)
    me = bpy.data.meshes.new_from_object(ev, preserve_all_data_layers=False, depsgraph=dg)
    if len(me.polygons) == 0:
        bpy.data.meshes.remove(me)
        return None
    # local-space generated coordinates (same as Blender's 'Generated' texture space)
    nv = len(me.vertices)
    co = np.empty(nv * 3, np.float32)
    me.vertices.foreach_get("co", co)
    co = co.reshape(-1, 3)
    bmin, bmax = co.min(0), co.max(0)
    if o.type == "MESH":
        bb = np.array([v[:] for v in ev.bound_box], np.float32)
        bmin, bmax = bb.min(0), bb.max(0)
    bsz = np.maximum(bmax - bmin, 1e-9)

    mw = o.matrix_world
    me.transform(root_inv @ mw)  # now in root-local metres (Blender axes)
    co_w = np.empty(nv * 3, np.float32)
    me.vertices.foreach_get("co", co_w)
    co_w = co_w.reshape(-1, 3)

    npoly = len(me.polygons)
    nloop = len(me.loops)
    lv = np.empty(nloop, np.int32)
    me.loops.foreach_get("vertex_index", lv)
    pstart = np.empty(npoly, np.int32)
    me.polygons.foreach_get("loop_start", pstart)
    ptotal = np.empty(npoly, np.int32)
    me.polygons.foreach_get("loop_total", ptotal)
    pmat = np.empty(npoly, np.int32)
    me.polygons.foreach_get("material_index", pmat)
    pn_w = np.empty(npoly * 3, np.float32)
    me.polygons.foreach_get("normal", pn_w)
    pn_w = pn_w.reshape(-1, 3)
    # local normals (object space before transform) for the tex_side test
    R = np.array((mw.to_3x3()), np.float32)
    pn_l = pn_w @ R  # root-local (= world orientation, roots are unrotated) -> object space
    pn_l /= np.linalg.norm(pn_l, axis=1, keepdims=True) + 1e-12
    loop_poly = np.repeat(np.arange(npoly), ptotal)

    mats = list(me.materials) or [None]
    new_mats = []
    for mm in mats:
        if mm is not None and mm.name not in new_mats:
            new_mats.append(mm.name)
    uv = np.zeros((nloop, 2), np.float32)
    newidx = np.zeros(npoly, np.int32)

    # metric box UVs by dominant world normal
    ax = np.argmax(np.abs(pn_w), axis=1)
    pw = co_w[lv]
    la = ax[loop_poly]
    u_box = np.where(la == 0, pw[:, 1], pw[:, 0]) / UV_TILE
    v_box = np.where(la == 2, pw[:, 1], pw[:, 2]) / UV_TILE
    uv[:, 0], uv[:, 1] = u_box, v_box

    def slot(name):
        if name not in new_mats:
            new_mats.append(name)
        return new_mats.index(name)

    gen = (co[lv] - bmin) / bsz
    for mi in np.unique(pmat):
        mm = mats[min(mi, len(mats) - 1)]
        sel_p = pmat == mi
        if mm is None:
            newidx[sel_p] = slot("_default") if "_default" in bpy.data.materials else 0
            continue
        info = MATS.get(mm.name, {})
        if not info.get("tex"):
            newidx[sel_p] = slot(mm.name)
            continue
        side = info.get("tex_side", "top")
        nl = pn_l
        if side in ("all", "box"):
            on = np.ones(npoly, bool)
        elif side == "both":
            on = np.abs(nl[:, 2]) > 0.7
        else:
            on = nl[:, 2] > 0.7
        tex_p = sel_p & on
        plain_p = sel_p & ~on
        newidx[tex_p] = slot(mm.name)
        if plain_p.any():
            newidx[plain_p] = slot(_plain_twin(mm).name)
        tl = tex_p[loop_poly]
        if side == "box":
            a = np.argmax(np.abs(nl), axis=1)[loop_poly]
            uu = np.where(a == 0, gen[:, 1], gen[:, 0])
            vv = np.where(a == 2, gen[:, 1], gen[:, 2])
        else:
            uu, vv = gen[:, 0], gen[:, 1]
        if info.get("rot"):
            uu, vv = gen[:, 1], 1 - gen[:, 0]
        uv[tl, 0] = uu[tl]
        uv[tl, 1] = vv[tl]

    me.materials.clear()
    for nme in new_mats:
        me.materials.append(bpy.data.materials.get(nme))
    me.polygons.foreach_set("material_index", newidx)
    layer = me.uv_layers.new(name="UVMap")
    layer.data.foreach_set("uv", uv.ravel())
    ob = bpy.data.objects.new(o.name + "_x", me)
    if o.get("nosplit"):
        ob["nosplit"] = 1
    bpy.context.scene.collection.objects.link(ob)
    return ob


def split_long_edges(ob, lmax):
    """Split edges longer than lmax so baked AO has vertices to land on."""
    if lmax <= 0:
        return
    me = ob.data
    bm = bmesh.new()
    bm.from_mesh(me)
    bmesh.ops.triangulate(bm, faces=bm.faces[:])
    for _ in range(9):
        long_e = [e for e in bm.edges if e.calc_length() > lmax]
        if not long_e:
            break
        bmesh.ops.subdivide_edges(bm, edges=long_e, cuts=1, use_grid_fill=False)
        bmesh.ops.triangulate(bm, faces=[f for f in bm.faces if len(f.verts) > 3])
    bm.to_mesh(me)
    bm.free()


def realise_part(root, name, lmax):
    """Returns one joined object for the part, origin at the root, in root-local Blender axes."""
    dg = bpy.context.evaluated_depsgraph_get()
    root_inv = root.matrix_world.inverted()
    pieces = []
    for o in descendants(root):
        ob = _realise(o, dg, root_inv)
        if ob is not None:
            pieces.append(ob)
    for ob in pieces:
        if not ob.get("nosplit"):
            split_long_edges(ob, lmax)
    bpy.ops.object.select_all(action="DESELECT")
    for ob in pieces:
        ob.select_set(True)
    bpy.context.view_layer.objects.active = pieces[0]
    with bpy.context.temp_override(active_object=pieces[0], selected_editable_objects=pieces, selected_objects=pieces):
        bpy.ops.object.join()
    ob = pieces[0]
    ob.name = "X_" + name
    ob.data.name = name
    ob["exported"] = 1
    return ob


def place_world(ob, root):
    ob.matrix_world = root.matrix_world.copy()


def bake_ao(targets, distance, samples=48):
    """Bakes AO for every object in targets into a byte colour attribute 'ao' (corner domain).
    Whatever else is renderable in the scene occludes too."""
    sc = bpy.context.scene
    sc.render.engine = "CYCLES"
    sc.cycles.device = "CPU"
    sc.cycles.samples = samples
    sc.cycles.use_denoising = False
    if sc.world is None:
        sc.world = bpy.data.worlds.new("bake")
    sc.world.light_settings.distance = distance
    for ob in targets:
        me = ob.data
        if "ao" in me.color_attributes:
            me.color_attributes.remove(me.color_attributes["ao"])
        ca = me.color_attributes.new("ao", "FLOAT_COLOR", "CORNER")
        me.color_attributes.active_color = ca
        me.attributes.default_color_name = "ao"
    bpy.ops.object.select_all(action="DESELECT")
    for ob in targets:
        ob.select_set(True)
    bpy.context.view_layer.objects.active = targets[0]
    t = time.time()
    bpy.ops.object.bake(type="AO", target="VERTEX_COLORS", margin=0)
    print(f"[ao] {[o.name for o in targets]} {time.time()-t:.0f}s", flush=True)


def ao_stats(ob):
    ca = ob.data.color_attributes["ao"]
    n = len(ca.data)
    c = np.empty(n * 4, np.float32)
    ca.data.foreach_get("color", c)
    return float(c[0::4].mean())


def export_glb(ob, path):
    """Writes ob (moved to the identity transform, i.e. root-local coordinates) as GLB."""
    mw = ob.matrix_world.copy()
    ob.matrix_world = Matrix.Identity(4)
    bpy.ops.object.select_all(action="DESELECT")
    ob.select_set(True)
    bpy.context.view_layer.objects.active = ob
    bpy.ops.export_scene.gltf(
        filepath=path,
        export_format="GLB",
        use_selection=True,
        export_yup=True,
        export_apply=False,
        export_texcoords=True,
        export_normals=True,
        export_tangents=False,
        export_materials="EXPORT",
        export_image_format="NONE",
        export_vertex_color="ACTIVE",
        export_all_vertex_colors=False,
        export_active_vertex_color_when_no_material=True,
        export_animations=False,
        export_skins=False,
        export_morph=False,
        export_cameras=False,
        export_lights=False,
        export_extras=False,
    )
    ob.matrix_world = mw
    tris = sum(len(p.vertices) - 2 for p in ob.data.polygons)
    print(f"[glb] {os.path.basename(path)} tris {tris} verts {len(ob.data.vertices)} {os.path.getsize(path)//1024} KB", flush=True)
    return tris


def to_three(v, origin=(0, 0, 0)):
    x, y, z = (v[0] - origin[0], v[1] - origin[1], v[2] - origin[2])
    return [round(float(x), 5), round(float(z), 5), round(float(-y), 5)]


def part_meta(root, ob=None):
    """anchors + bbox (three axes, relative to root origin)."""
    o = root.matrix_world.translation
    anchors = {}
    stack = list(root.children)
    while stack:
        c = stack.pop()
        stack.extend(c.children)
        if c.get("anchor"):
            nm = c.name[2:]
            if len(nm) > 4 and nm[-4] == "." and nm[-3:].isdigit():
                nm = nm[:-4]
            anchors[nm] = to_three(c.matrix_world.translation, o)
    if ob is not None:
        n = len(ob.data.vertices)
        co = np.empty(n * 3, np.float32)
        ob.data.vertices.foreach_get("co", co)
        co = co.reshape(-1, 3)
        lo, hi = co.min(0), co.max(0)  # root-local blender axes
        mins = [lo[0], lo[2], -hi[1]]
        maxs = [hi[0], hi[2], -lo[1]]
    else:
        mins = maxs = [0, 0, 0]
    return dict(origin=to_three(o), anchors=anchors, bbox=[[round(float(v), 4) for v in mins], [round(float(v), 4) for v in maxs]])


def write_json(path, data):
    with open(path, "w") as f:
        json.dump(data, f, ensure_ascii=False, indent=1)


def materials_json(path):
    out = {}
    for k, v in MATS.items():
        out[k] = {kk: vv for kk, vv in v.items() if vv not in (None, False, 0, 0.0) or kk in ("metal", "rough")}
        out[k]["color"] = list(v["color"])
    if os.path.exists(path):
        with open(path) as f:
            old = json.load(f)
        old.update(out)
        out = old
    write_json(path, dict(sorted(out.items())))
