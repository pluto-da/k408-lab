"""Small bpy modelling kit used by model.py (meters, Blender Z-up)."""
import math
import os

import bmesh
import bpy
from mathutils import Matrix, Vector

HERE = os.path.dirname(os.path.abspath(__file__))
TEX = os.path.join(HERE, "build", "tex")

# material registry: name -> params used by the splat baker (splat.py)
MATS = {}


def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    MATS.clear()


def srgb2lin(c):
    c = c / 255.0
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def mat(name, color, metal=0.0, rough=0.5, tex=None, tex_side="top", dens=1.0, emit=0.0, rot=False):
    """color: sRGB 0-255. tex: png in build/tex mapped on the object's local XY bbox (top faces).
    tex_side: 'top' (normal +Z), 'both' (+Z and -Z), 'all' (every face, projected along Z)."""
    if name in MATS:
        return bpy.data.materials[name]
    MATS[name] = dict(color=color, metal=metal, rough=rough, tex=tex, tex_side=tex_side, dens=dens, emit=emit, rot=rot)
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    bsdf = nt.nodes["Principled BSDF"]
    lin = [srgb2lin(c) for c in color] + [1.0]
    bsdf.inputs["Base Color"].default_value = lin
    bsdf.inputs["Metallic"].default_value = metal
    bsdf.inputs["Roughness"].default_value = rough
    if emit:
        bsdf.inputs["Emission Color"].default_value = lin
        bsdf.inputs["Emission Strength"].default_value = emit
    if tex:
        tc = nt.nodes.new("ShaderNodeTexCoord")
        img = nt.nodes.new("ShaderNodeTexImage")
        img.image = bpy.data.images.load(os.path.join(TEX, tex), check_existing=True)
        img.extension = "EXTEND"
        vec = tc.outputs["Generated"]
        if rot:
            mp = nt.nodes.new("ShaderNodeMapping")
            mp.inputs["Rotation"].default_value = (0, 0, math.pi / 2)
            mp.inputs["Location"].default_value = (1, 0, 0)
            nt.links.new(vec, mp.inputs["Vector"])
            vec = mp.outputs["Vector"]
        nt.links.new(vec, img.inputs["Vector"])
        sep = nt.nodes.new("ShaderNodeSeparateXYZ")
        nt.links.new(tc.outputs["Normal"], sep.inputs["Vector"])
        mix = nt.nodes.new("ShaderNodeMix")
        mix.data_type = "RGBA"
        if tex_side == "box":
            img.projection = "BOX"
            img.projection_blend = 0.1
        if tex_side in ("all", "box"):
            mix.inputs["Factor"].default_value = 1.0
        else:
            gt = nt.nodes.new("ShaderNodeMath")
            if tex_side == "both":
                ab = nt.nodes.new("ShaderNodeMath")
                ab.operation = "ABSOLUTE"
                nt.links.new(sep.outputs["Z"], ab.inputs[0])
                src = ab.outputs[0]
            else:
                src = sep.outputs["Z"]
            gt.operation = "GREATER_THAN"
            gt.inputs[1].default_value = 0.7
            nt.links.new(src, gt.inputs[0])
            nt.links.new(gt.outputs[0], mix.inputs["Factor"])
        mix.inputs["A"].default_value = lin
        nt.links.new(img.outputs["Color"], mix.inputs["B"])
        nt.links.new(mix.outputs["Result"], bsdf.inputs["Base Color"])
    return m


def _link(obj, parent):
    bpy.context.scene.collection.objects.link(obj)
    if parent is not None:
        obj.parent = parent
    return obj


def empty(name, loc=(0, 0, 0), parent=None, matrix=None):
    e = bpy.data.objects.new(name, None)
    _link(e, parent)
    if matrix is not None:
        e.matrix_local = matrix
    else:
        e.location = loc
    return e


def _obj_from_bm(name, bm, material, parent, smooth=False):
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    if smooth:
        me.shade_smooth()
    o = bpy.data.objects.new(name, me)
    if material is not None:
        me.materials.append(material)
    return _link(o, parent)


def _place(o, loc, rot):
    o.location = loc
    o.rotation_euler = rot
    return o


def bevel(o, w, seg=2, angle=40):
    if w <= 0:
        return o
    m = o.modifiers.new("bevel", "BEVEL")
    m.width = w
    m.segments = seg
    m.limit_method = "ANGLE"
    m.angle_limit = math.radians(angle)
    return o


def box(name, size, loc=(0, 0, 0), material=None, parent=None, rot=(0, 0, 0), bev=0.0, seg=2):
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    bmesh.ops.scale(bm, vec=Vector(size), verts=bm.verts)
    o = _obj_from_bm(name, bm, material, parent)
    _place(o, loc, rot)
    bevel(o, min(bev, min(size) * 0.45), seg)
    return o


def cyl(name, r, h, loc=(0, 0, 0), material=None, parent=None, rot=(0, 0, 0), seg=32, bev=0.0, r2=None):
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=seg, radius1=r, radius2=r if r2 is None else r2, depth=h)
    o = _obj_from_bm(name, bm, material, parent, smooth=True)
    _place(o, loc, rot)
    if bev:
        bevel(o, min(bev, h * 0.45, r * 0.45), 2, angle=60)
    return o


def ring(name, r_in, r_out, h, loc=(0, 0, 0), material=None, parent=None, rot=(0, 0, 0), seg=48):
    verts, faces = [], []
    for i in range(seg):
        a = i / seg * math.tau
        c, s = math.cos(a), math.sin(a)
        verts += [(r_in * c, r_in * s, -h / 2), (r_out * c, r_out * s, -h / 2), (r_out * c, r_out * s, h / 2), (r_in * c, r_in * s, h / 2)]
    for i in range(seg):
        a, b = i * 4, ((i + 1) % seg) * 4
        for k in range(4):
            k2 = (k + 1) % 4
            faces.append((a + k, b + k, b + k2, a + k2))
    me = bpy.data.meshes.new(name)
    me.from_pydata(verts, [], faces)
    me.update()
    for p in me.polygons:
        p.use_smooth = True
    if material is not None:
        me.materials.append(material)
    o = _link(bpy.data.objects.new(name, me), parent)
    return _place(o, loc, rot)


def mesh(name, verts, faces, material=None, parent=None, loc=(0, 0, 0), rot=(0, 0, 0), smooth=False):
    me = bpy.data.meshes.new(name)
    me.from_pydata(verts, [], faces)
    me.update()
    if smooth:
        me.shade_smooth()
    if material is not None:
        me.materials.append(material)
    o = _link(bpy.data.objects.new(name, me), parent)
    return _place(o, loc, rot)


def array(o, count, offset, count2=None, offset2=None):
    m = o.modifiers.new("arr", "ARRAY")
    m.use_relative_offset = False
    m.use_constant_offset = True
    m.constant_offset_displace = offset
    m.count = count
    # keep bevel after array so ends stay rounded
    if count2:
        m2 = o.modifiers.new("arr2", "ARRAY")
        m2.use_relative_offset = False
        m2.use_constant_offset = True
        m2.constant_offset_displace = offset2
        m2.count = count2
    _bevel_last(o)
    return o


def _bevel_last(o):
    names = [m.name for m in o.modifiers]
    if "bevel" in names:
        i = names.index("bevel")
        if i != len(names) - 1:
            with bpy.context.temp_override(object=o):
                bpy.ops.object.modifier_move_to_index(modifier="bevel", index=len(names) - 1)


def cut(o, cutter):
    """Boolean difference with a hidden cutter object."""
    cutter.hide_render = True
    cutter.hide_viewport = True
    cutter["nosplat"] = 1
    m = o.modifiers.new("cut_" + cutter.name, "BOOLEAN")
    m.operation = "DIFFERENCE"
    m.solver = "EXACT"
    m.object = cutter
    # boolean before bevel
    names = [mm.name for mm in o.modifiers]
    if "bevel" in names:
        with bpy.context.temp_override(object=o):
            bpy.ops.object.modifier_move_to_index(modifier=m.name, index=names.index("bevel"))
    return o


def cable(name, pts, radius, material, parent=None, res=6):
    cu = bpy.data.curves.new(name, "CURVE")
    cu.dimensions = "3D"
    cu.bevel_depth = radius
    cu.bevel_resolution = 3
    cu.resolution_u = res
    cu.use_fill_caps = True
    sp = cu.splines.new("BEZIER")
    sp.bezier_points.add(len(pts) - 1)
    for bp, p in zip(sp.bezier_points, pts):
        bp.co = p
        bp.handle_left_type = bp.handle_right_type = "AUTO"
    cu.materials.append(material)
    return _link(bpy.data.objects.new(name, cu), parent)


def anchor(name, loc, parent):
    e = empty("a:" + name, loc, parent)
    e["anchor"] = 1
    return e


def fan_blades(name, r_hub, r_tip, n, thick, material, parent, loc=(0, 0, 0), rot=(0, 0, 0), pitch=0.5, sweep=0.5):
    """n swept blades around +Z axis. Built as thin curved patches."""
    verts, faces = [], []
    NR, NA = 6, 7
    for b in range(n):
        base = b / n * math.tau
        start = len(verts)
        for side in (0, 1):
            for i in range(NR):
                t = i / (NR - 1)
                r = r_hub + (r_tip - r_hub) * t
                span = (math.tau / n) * 0.78
                for j in range(NA):
                    u = j / (NA - 1)
                    a = base + span * u + sweep * t
                    z = (u - 0.5) * pitch * (r_tip - r_hub) * 0.55 * (1 - 0.3 * t)
                    z += (thick / 2 if side else -thick / 2)
                    verts.append((r * math.cos(a), r * math.sin(a), z))
        def idx(side, i, j):
            return start + side * NR * NA + i * NA + j
        for i in range(NR - 1):
            for j in range(NA - 1):
                faces.append((idx(1, i, j), idx(1, i + 1, j), idx(1, i + 1, j + 1), idx(1, i, j + 1)))
                faces.append((idx(0, i, j), idx(0, i, j + 1), idx(0, i + 1, j + 1), idx(0, i + 1, j)))
        for i in range(NR - 1):
            faces.append((idx(0, i, 0), idx(0, i + 1, 0), idx(1, i + 1, 0), idx(1, i, 0)))
            faces.append((idx(0, i, NA - 1), idx(1, i, NA - 1), idx(1, i + 1, NA - 1), idx(0, i + 1, NA - 1)))
        for j in range(NA - 1):
            faces.append((idx(0, NR - 1, j), idx(0, NR - 1, j + 1), idx(1, NR - 1, j + 1), idx(1, NR - 1, j)))
    return mesh(name, verts, faces, material, parent, loc, rot, smooth=True)


def frame_matrix(origin, xaxis, yaxis):
    x = Vector(xaxis).normalized()
    y = Vector(yaxis).normalized()
    z = x.cross(y)
    m = Matrix.Identity(4)
    for i in range(3):
        m[i][0], m[i][1], m[i][2], m[i][3] = x[i], y[i], z[i], origin[i]
    return m
