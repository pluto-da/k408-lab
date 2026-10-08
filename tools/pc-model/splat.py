"""Mesh -> flat Gaussian splats baker (runs inside Blender).

For every part root (an empty) all descendant meshes/curves are evaluated, triangulated and
sampled area-weighted with a per-triangle R2 low-discrepancy pattern. Each sample becomes one
flat anisotropic Gaussian lying in the triangle plane (tangent sigma ~ local spacing, normal
sigma tiny). Colour = material albedo / texture at the sample, lit with a fixed studio rig plus
ray-traced ambient occlusion, so the splats look lit without view-dependent SH.
Output: standard 3DGS binary PLY (SH degree 0) in three.js axes (Y up), relative to the part origin.
"""
import json
import math
import os
import re
import struct
import time

import bpy
import numpy as np
from mathutils import Vector
from mathutils.bvhtree import BVHTree
from PIL import Image
from scipy.spatial import cKDTree

from lib import MATS, TEX

SH_C0 = 0.28209479177387814
_IMG = {}


def _img(name):
    """Returns (image, summed-area table) for box-filtered lookups."""
    if name not in _IMG:
        im = np.asarray(Image.open(os.path.join(TEX, name)).convert("RGB"), dtype=np.float32)
        lin = np.where(im / 255 <= 0.04045, im / 255 / 12.92, ((im / 255 + 0.055) / 1.055) ** 2.4)
        sat = np.zeros((im.shape[0] + 1, im.shape[1] + 1, 3), np.float64)
        sat[1:, 1:] = lin.cumsum(0).cumsum(1)
        _IMG[name] = (im, sat)
    return _IMG[name]


def _box_lookup(sat, x0, y0, x1, y1):
    """mean linear colour over integer pixel boxes [x0,x1) x [y0,y1), returned as sRGB 0-255."""
    area = np.maximum((x1 - x0) * (y1 - y0), 1)[:, None]
    tot = sat[y1, x1] - sat[y0, x1] - sat[y1, x0] + sat[y0, x0]
    lin = np.clip(tot / area, 0, 1)
    return np.where(lin <= 0.0031308, lin * 12.92, 1.055 * np.power(lin, 1 / 2.4) - 0.055) * 255


def descendants(root):
    out = []
    stack = list(root.children)
    while stack:
        o = stack.pop()
        stack.extend(o.children)
        if o.type in ("MESH", "CURVE") and not o.hide_render and not o.get("nosplat"):
            out.append(o)
    return out


def collect(objs):
    """Returns dict of per-triangle arrays (world space)."""
    dg = bpy.context.evaluated_depsgraph_get()
    P, N, G, LN, MI, OD, BS = [], [], [], [], [], [], []
    mat_names = []
    for o in objs:
        ev = o.evaluated_get(dg)
        me = ev.to_mesh()
        if me is None:
            continue
        me.calc_loop_triangles()
        nt = len(me.loop_triangles)
        if nt == 0:
            ev.to_mesh_clear()
            continue
        nv = len(me.vertices)
        co = np.empty(nv * 3, np.float32)
        me.vertices.foreach_get("co", co)
        co = co.reshape(-1, 3)
        tri_v = np.empty(nt * 3, np.int32)
        me.loop_triangles.foreach_get("vertices", tri_v)
        tri_l = np.empty(nt * 3, np.int32)
        me.loop_triangles.foreach_get("loops", tri_l)
        tri_m = np.empty(nt, np.int32)
        me.loop_triangles.foreach_get("material_index", tri_m)
        cn = np.empty(len(me.loops) * 3, np.float32)
        me.corner_normals.foreach_get("vector", cn)
        cn = cn.reshape(-1, 3)
        bb = np.array([v[:] for v in ev.bound_box], np.float32)
        bmin, bmax = bb.min(0), bb.max(0)
        bsz = np.maximum(bmax - bmin, 1e-9)
        local = co[tri_v].reshape(-1, 3, 3)
        lnrm = cn[tri_l].reshape(-1, 3, 3)
        mw = np.array(o.matrix_world, np.float32)
        R, t = mw[:3, :3], mw[:3, 3]
        nm = np.linalg.inv(R).T
        world = local @ R.T + t
        wn = lnrm @ nm.T
        wn /= np.linalg.norm(wn, axis=-1, keepdims=True) + 1e-12
        gen = (local - bmin) / bsz
        names = [m.name if m else "_default" for m in me.materials] or ["_default"]
        idx = []
        for nme in names:
            if nme not in mat_names:
                mat_names.append(nme)
            idx.append(mat_names.index(nme))
        idx = np.array(idx, np.int32)
        P.append(world)
        N.append(wn)
        G.append(gen)
        BS.append(np.broadcast_to(bsz, (nt, 3)).astype(np.float32))
        LN.append(lnrm)
        MI.append(idx[np.clip(tri_m, 0, len(idx) - 1)])
        OD.append(np.full(nt, float(o.get("dens", 0.0)), np.float32))
        ev.to_mesh_clear()
    return dict(P=np.concatenate(P), N=np.concatenate(N), G=np.concatenate(G), LN=np.concatenate(LN),
                MI=np.concatenate(MI), OD=np.concatenate(OD), BS=np.concatenate(BS), mats=mat_names)


KEYS = ("P", "N", "G", "LN", "MI", "OD", "BS")


def subdivide(T, amax, iters=10):
    for _ in range(iters):
        P = T["P"]
        area = 0.5 * np.linalg.norm(np.cross(P[:, 1] - P[:, 0], P[:, 2] - P[:, 0]), axis=1)
        big = area > amax
        if not big.any():
            break
        out = {}
        for k in KEYS:
            a = T[k]
            keep, b = a[~big], a[big]
            if b.ndim == 3:
                v0, v1, v2 = b[:, 0], b[:, 1], b[:, 2]
                m01, m12, m20 = (v0 + v1) / 2, (v1 + v2) / 2, (v2 + v0) / 2
                parts = [np.stack(t, 1) for t in ((v0, m01, m20), (m01, v1, m12), (m20, m12, v2), (m01, m12, m20))]
                out[k] = np.concatenate([keep] + parts)
            else:
                out[k] = np.concatenate([keep, b, b, b, b])
        T.update(out)
    return T


def bvh_from(P):
    T = len(P)
    verts = P.reshape(-1, 3).tolist()
    polys = np.arange(T * 3).reshape(-1, 3).tolist()
    return BVHTree.FromPolygons(verts, polys, all_triangles=True, epsilon=0.0)


def fib_dirs(n):
    i = np.arange(n) + 0.5
    phi = np.arccos(1 - 2 * i / n)
    th = math.pi * (1 + 5 ** 0.5) * i
    return np.stack([np.cos(th) * np.sin(phi), np.sin(th) * np.sin(phi), np.cos(phi)], 1)


def visible_tris(T, bvh, dirs, eps=4e-5):
    """Triangle is kept if any of 4 probe points sees open sky in any direction of its hemisphere."""
    P, FN = T["P"], T["FN"]
    keep = np.zeros(len(P), bool)
    w = np.array([[1 / 3, 1 / 3, 1 / 3], [0.7, 0.15, 0.15], [0.15, 0.7, 0.15], [0.15, 0.15, 0.7]], np.float32)
    probes = np.einsum("kj,tjc->tkc", w, P)  # T,4,3
    dots = FN @ dirs.T  # T,D
    rc = bvh.ray_cast
    for t in range(len(P)):
        ds = dirs[dots[t] > 0.08]
        if len(ds) == 0:
            continue
        n = FN[t]
        found = False
        for p in probes[t]:
            o = Vector(p + n * eps)
            for d in ds:
                if rc(o, Vector(d))[0] is None:
                    found = True
                    break
            if found:
                break
        keep[t] = found
    return keep


def sample(T, n_target, rng, max_sigma, k_sigma):
    P = T["P"]
    e1 = P[:, 1] - P[:, 0]
    e2 = P[:, 2] - P[:, 0]
    cr = np.cross(e1, e2)
    area = 0.5 * np.linalg.norm(cr, axis=1)
    w = area * T["DENS"]
    rho = n_target / max(w.sum(), 1e-12)  # samples per (weighted) m^2
    exp_n = w * rho
    cnt = np.floor(exp_n + rng.random(len(exp_n))).astype(np.int64)
    tri = np.repeat(np.arange(len(P)), cnt)
    starts = np.repeat(np.cumsum(cnt) - cnt, cnt)
    j = np.arange(len(tri)) - starts
    g = 1.32471795724474602596
    a1, a2 = 1 / g, 1 / (g * g)
    r1, r2 = rng.random(len(P)), rng.random(len(P))
    u = np.mod(r1[tri] + j * a1, 1.0)
    v = np.mod(r2[tri] + j * a2, 1.0)
    flip = (u + v) > 1
    u[flip], v[flip] = 1 - u[flip], 1 - v[flip]
    wa = 1 - u - v
    bary = np.stack([wa, u, v], 1).astype(np.float32)
    pos = np.einsum("sk,skc->sc", bary, P[tri])
    nrm = np.einsum("sk,skc->sc", bary, T["N"][tri])
    nrm /= np.linalg.norm(nrm, axis=1, keepdims=True) + 1e-12
    gen = np.einsum("sk,skc->sc", bary, T["G"][tri])
    lnrm = np.einsum("sk,skc->sc", bary, T["LN"][tri])
    lnrm /= np.linalg.norm(lnrm, axis=1, keepdims=True) + 1e-12
    spacing = 1.0 / np.sqrt(rho * T["DENS"][tri])
    bary = relax(bary, tri, P, spacing, T["FN"])
    pos = np.einsum("sk,skc->sc", bary, P[tri])
    nrm = np.einsum("sk,skc->sc", bary, T["N"][tri])
    nrm /= np.linalg.norm(nrm, axis=1, keepdims=True) + 1e-12
    gen = np.einsum("sk,skc->sc", bary, T["G"][tri])
    lnrm = np.einsum("sk,skc->sc", bary, T["LN"][tri])
    lnrm /= np.linalg.norm(lnrm, axis=1, keepdims=True) + 1e-12
    sig = np.minimum(k_sigma * spacing, max_sigma)
    fn = T["FN"][tri]
    t1 = e1[tri] / (np.linalg.norm(e1[tri], axis=1, keepdims=True) + 1e-12)
    return dict(tri=tri, pos=pos, nrm=nrm, gen=gen, lnrm=lnrm, fn=fn, t1=t1, sig=sig, mi=T["MI"][tri], spacing=spacing, bs=T["BS"][tri])


def relax(bary, tri, P, spacing, FN, iters=3, k=8):
    """Blue-noise relaxation: push samples apart in their tangent plane, keep each inside its triangle."""
    A, B, C = P[tri, 0], P[tri, 1], P[tri, 2]
    e1, e2 = B - A, C - A
    d11 = np.sum(e1 * e1, 1)
    d12 = np.sum(e1 * e2, 1)
    d22 = np.sum(e2 * e2, 1)
    den = d11 * d22 - d12 * d12 + 1e-30
    n = FN[tri]
    for _ in range(iters):
        pos = A + bary[:, 1:2] * e1 + bary[:, 2:3] * e2
        tree = cKDTree(pos)
        dist, nb = tree.query(pos, k=k + 1)
        dist, nb = dist[:, 1:], nb[:, 1:]
        r = spacing[:, None] * 1.05
        same = np.einsum("sc,skc->sk", n, n[nb]) > 0.85
        wgt = np.where(same & (dist < r), (r - dist) / r, 0.0)
        dvec = pos[:, None, :] - pos[nb]
        dvec /= dist[..., None] + 1e-12
        push = np.einsum("sk,skc->sc", wgt, dvec) * spacing[:, None] * 0.18
        push -= n * np.sum(push * n, 1, keepdims=True)
        new = pos + push
        q = new - A
        q1, q2 = np.sum(q * e1, 1), np.sum(q * e2, 1)
        u = (d22 * q1 - d12 * q2) / den
        v = (d11 * q2 - d12 * q1) / den
        u, v = np.maximum(u, 0), np.maximum(v, 0)
        sv = u + v
        over = sv > 1
        u[over] /= sv[over]
        v[over] /= sv[over]
        bary = np.stack([1 - u - v, u, v], 1).astype(np.float32)
    return bary


def ambient_occlusion(S, bvhs, dist, rng, n_rays=6):
    pos, fn = S["pos"], S["fn"]
    ns = len(pos)
    # cosine-weighted hemisphere around face normal
    a = np.where(np.abs(fn[:, 0:1]) < 0.9, np.array([[1, 0, 0]], np.float32), np.array([[0, 1, 0]], np.float32))
    tx = np.cross(fn, a)
    tx /= np.linalg.norm(tx, axis=1, keepdims=True)
    ty = np.cross(fn, tx)
    occ = np.zeros(ns, np.float32)
    eps = 3e-5
    org = pos + fn * eps
    rcs = [b.ray_cast for b in bvhs]
    for k in range(n_rays):
        u1 = (rng.random(ns) + k) / n_rays
        u2 = rng.random(ns)
        r = np.sqrt(u1)
        ph = math.tau * u2
        d = tx * (r * np.cos(ph))[:, None] + ty * (r * np.sin(ph))[:, None] + fn * np.sqrt(1 - u1)[:, None]
        for i in range(ns):
            o, dv = Vector(org[i]), Vector(d[i])
            best = None
            for rc in rcs:
                hit = rc(o, dv, dist)
                if hit[0] is not None and (best is None or hit[3] < best):
                    best = hit[3]
            if best is not None:
                occ[i] += 1.0 - 0.6 * (best / dist)
    ao = 1.0 - occ / n_rays
    # denoise: average over neighbours with similar normals
    tree = cKDTree(pos)
    k = min(12, ns)
    _, nb = tree.query(pos, k=k)
    wgt = np.clip(np.einsum("sc,skc->sk", S["nrm"], S["nrm"][nb]), 0, 1) ** 4
    ao_s = (ao[nb] * wgt).sum(1) / (wgt.sum(1) + 1e-6)
    return ao_s


def _n(v):
    v = np.array(v, np.float32)
    return v / np.linalg.norm(v)


LIGHT_KEY = _n((-0.55, -0.6, 0.78))
LIGHT_FILL = _n((0.7, -0.45, 0.25))
LIGHT_RIM = _n((0.25, 0.85, 0.45))
VIEW = _n((-0.62, -0.68, 0.42))


def shade(S, mats, ao):
    ns = len(S["pos"])
    alb = np.zeros((ns, 3), np.float32)
    metal = np.zeros(ns, np.float32)
    rough = np.zeros(ns, np.float32)
    emit = np.zeros(ns, np.float32)
    for mi, name in enumerate(mats):
        sel = S["mi"] == mi
        if not sel.any():
            continue
        m = MATS.get(name, dict(color=(128, 128, 128), metal=0, rough=0.5, tex=None))
        c = np.array(m["color"], np.float32)
        alb[sel] = c
        metal[sel] = m["metal"]
        rough[sel] = m["rough"]
        emit[sel] = m.get("emit", 0.0)
        if m.get("tex"):
            img, sat = _img(m["tex"])
            h, w = img.shape[:2]
            g = S["gen"][sel]
            ln = S["lnrm"][sel]
            bs = S["bs"][sel]
            sp = S["spacing"][sel] * 1.4  # filter footprint (m)
            side = m.get("tex_side", "top")
            if side == "box":
                ax = np.argmax(np.abs(ln), axis=1)
                ui = np.where(ax == 0, 1, 0)
                vi = np.where(ax == 2, 1, 2)
                on = np.ones(len(g), bool)
            else:
                ui = np.zeros(len(g), np.int64)
                vi = np.ones(len(g), np.int64)
                if side == "all":
                    on = np.ones(len(g), bool)
                elif side == "both":
                    on = np.abs(ln[:, 2]) > 0.7
                else:
                    on = ln[:, 2] > 0.7
            r = np.arange(len(g))
            tu, tv = g[r, ui], g[r, vi]
            su, sv = bs[r, ui], bs[r, vi]
            if m.get("rot"):
                tu, tv, su, sv = g[:, 1], 1 - g[:, 0], bs[:, 1], bs[:, 0]
            fu = sp / np.maximum(su, 1e-6) * w  # footprint in pixels
            fv = sp / np.maximum(sv, 1e-6) * h
            cx, cy = tu * w, (1 - tv) * h
            x0 = np.clip(np.floor(cx - fu / 2), 0, w - 1).astype(np.int64)
            x1 = np.clip(np.maximum(np.ceil(cx + fu / 2), x0 + 1), 1, w).astype(np.int64)
            y0 = np.clip(np.floor(cy - fv / 2), 0, h - 1).astype(np.int64)
            y1 = np.clip(np.maximum(np.ceil(cy + fv / 2), y0 + 1), 1, h).astype(np.int64)
            x1 = np.maximum(x1, x0 + 1)
            y1 = np.maximum(y1, y0 + 1)
            sub = alb[sel]
            sub[on] = _box_lookup(sat, x0[on], y0[on], x1[on], y1[on])
            alb[sel] = sub
    lin = np.where(alb / 255 <= 0.04045, alb / 255 / 12.92, ((alb / 255 + 0.055) / 1.055) ** 2.4)
    n = S["nrm"]
    sky = 0.55 + 0.45 * n[:, 2]
    kd = np.clip(n @ LIGHT_KEY, 0, 1)
    fd = np.clip(n @ LIGHT_FILL, 0, 1)
    rd = np.clip(n @ LIGHT_RIM, 0, 1)
    aof = 0.35 + 0.65 * ao
    diffuse = 0.42 * sky * ao + (1.05 * kd + 0.32 * fd + 0.3 * rd) * aof
    # reflection of nominal view direction
    R = 2 * (n @ VIEW)[:, None] * n - VIEW
    env = 0.18 + 0.95 * np.clip((R[:, 2] - 0.1) / 0.8, 0, 1) ** 1.5 + 0.25 * np.clip(R @ LIGHT_FILL, 0, 1) ** 2
    shininess = 4 + 60 * (1 - rough) ** 2
    hi = np.clip(R @ LIGHT_KEY, 0, 1) ** shininess
    spec_d = (0.04 + 0.2 * (1 - rough) ** 2) * hi * 1.4
    col_d = lin * diffuse[:, None] + spec_d[:, None]
    col_m = lin * ((env * (0.45 + 0.55 * ao))[:, None] + 0.25 * diffuse[:, None]) + (lin * 0.6 + 0.4) * (hi * (1 - rough) * 1.2 * ao)[:, None]
    col = col_d * (1 - metal)[:, None] + col_m * metal[:, None]
    col += lin * emit[:, None]
    col = col * (1 + col / 4.0) / (1 + col)  # extended Reinhard (white = 2)
    col = np.clip(col, 0, 1)
    srgb = np.where(col <= 0.0031308, col * 12.92, 1.055 * np.power(col, 1 / 2.4) - 0.055)
    return srgb


C_B2T = np.array([[1, 0, 0], [0, 0, 1], [0, -1, 0]], np.float32)  # blender -> three


def quat_from_mat(M):
    m00, m01, m02 = M[:, 0, 0], M[:, 0, 1], M[:, 0, 2]
    m10, m11, m12 = M[:, 1, 0], M[:, 1, 1], M[:, 1, 2]
    m20, m21, m22 = M[:, 2, 0], M[:, 2, 1], M[:, 2, 2]
    tr = m00 + m11 + m22
    q = np.zeros((len(M), 4), np.float64)
    s1 = tr > 0
    s = np.sqrt(np.maximum(tr + 1, 1e-12)) * 2
    q[:, 0] = np.where(s1, 0.25 * s, 0)
    q[:, 1] = np.where(s1, (m21 - m12) / s, 0)
    q[:, 2] = np.where(s1, (m02 - m20) / s, 0)
    q[:, 3] = np.where(s1, (m10 - m01) / s, 0)
    c2 = (~s1) & (m00 > m11) & (m00 > m22)
    s = np.sqrt(np.maximum(1 + m00 - m11 - m22, 1e-12)) * 2
    q[c2] = np.stack([(m21 - m12) / s, 0.25 * s, (m01 + m10) / s, (m02 + m20) / s], 1)[c2]
    c3 = (~s1) & (~c2) & (m11 > m22)
    s = np.sqrt(np.maximum(1 + m11 - m00 - m22, 1e-12)) * 2
    q[c3] = np.stack([(m02 - m20) / s, (m01 + m10) / s, 0.25 * s, (m12 + m21) / s], 1)[c3]
    c4 = (~s1) & (~c2) & (~c3)
    s = np.sqrt(np.maximum(1 + m22 - m00 - m11, 1e-12)) * 2
    q[c4] = np.stack([(m10 - m01) / s, (m02 + m20) / s, (m12 + m21) / s, 0.25 * s], 1)[c4]
    q /= np.linalg.norm(q, axis=1, keepdims=True)
    return q.astype(np.float32)


def write_ply(path, S, color, origin_b, opacity=0.995):
    ns = len(S["pos"])
    pos = (S["pos"] - origin_b) @ C_B2T.T
    n = S["fn"] @ C_B2T.T
    t1 = S["t1"] @ C_B2T.T
    t1 = t1 - n * np.sum(t1 * n, 1, keepdims=True)
    t1 /= np.linalg.norm(t1, axis=1, keepdims=True) + 1e-12
    t2 = np.cross(n, t1)
    M = np.stack([t1, t2, n], axis=2)  # columns
    q = quat_from_mat(M)
    sig = S["sig"]
    sn = np.maximum(sig * 0.03, 1.2e-5)
    scales = np.log(np.stack([sig, sig, sn], 1))
    fdc = (color - 0.5) / SH_C0
    op = np.full(ns, math.log(opacity / (1 - opacity)), np.float32)
    data = np.zeros((ns, 17), np.float32)
    data[:, 0:3] = pos
    data[:, 6:9] = fdc
    data[:, 9] = op
    data[:, 10:13] = scales
    data[:, 13:17] = q
    props = ["x", "y", "z", "nx", "ny", "nz", "f_dc_0", "f_dc_1", "f_dc_2", "opacity", "scale_0", "scale_1", "scale_2", "rot_0", "rot_1", "rot_2", "rot_3"]
    hdr = "ply\nformat binary_little_endian 1.0\nelement vertex %d\n" % ns + "".join("property float %s\n" % p for p in props) + "end_header\n"
    with open(path, "wb") as f:
        f.write(hdr.encode())
        f.write(data.astype("<f4").tobytes())


def bake(root, n_target, out_ply, ao_bvhs, ao_dist, vis_dirs, seed=1, max_sigma=0.004, k_sigma=0.66, origin=None, amax=2.5e-4, self_ao=True):
    t0 = time.time()
    rng = np.random.default_rng(seed)
    objs = descendants(root)
    T = collect(objs)
    P = T["P"]
    fn = np.cross(P[:, 1] - P[:, 0], P[:, 2] - P[:, 0])
    ln = np.linalg.norm(fn, axis=1)
    good = ln > 1e-14
    for k in KEYS:
        T[k] = T[k][good]
    self_bvh = bvh_from(T["P"])
    T = subdivide(T, amax)
    P = T["P"]
    fn = np.cross(P[:, 1] - P[:, 0], P[:, 2] - P[:, 0])
    T["FN"] = (fn / (np.linalg.norm(fn, axis=1, keepdims=True) + 1e-20)).astype(np.float32)
    md = np.array([MATS.get(m, {}).get("dens", 1.0) for m in T["mats"]], np.float32)
    T["DENS"] = np.maximum(md[T["MI"]], T["OD"])  # object override or material density, whichever is higher
    ntri = len(T["P"])
    if vis_dirs is not None:
        keep = visible_tris(T, self_bvh, vis_dirs)
        for k in KEYS + ("FN", "DENS"):
            T[k] = T[k][keep]
    t1 = time.time()
    S = sample(T, n_target, rng, max_sigma, k_sigma)
    ao = ambient_occlusion(S, ([self_bvh] if self_ao else []) + list(ao_bvhs), ao_dist, rng)
    t2 = time.time()
    col = shade(S, T["mats"], ao)
    origin_b = np.array(origin if origin is not None else root.matrix_world.translation[:], np.float32)
    write_ply(out_ply, S, col, origin_b)
    print(f"[bake] {root.name}: tris {ntri} -> {len(T['P'])} visible, splats {len(S['pos'])}, "
          f"median spacing {np.median(S['spacing'])*1000:.2f} mm, vis {t1-t0:.1f}s ao {t2-t1:.1f}s", flush=True)
    return len(S["pos"])


def to_three(v, origin=(0, 0, 0)):
    x, y, z = (v[0] - origin[0], v[1] - origin[1], v[2] - origin[2])
    return [round(float(x), 5), round(float(z), 5), round(float(-y), 5)]


def part_meta(root):
    """anchors + bbox (three axes, relative to root origin)."""
    o = root.matrix_world.translation
    anchors = {}
    mins, maxs = np.full(3, 1e9), np.full(3, -1e9)
    stack = list(root.children)
    while stack:
        c = stack.pop()
        stack.extend(c.children)
        if c.get("anchor"):
            anchors[re.sub(r"\.\d{3}$", "", c.name[2:])] = to_three(c.matrix_world.translation, o)
        elif c.type in ("MESH", "CURVE") and not c.get("nosplat") and not c.hide_render:
            for corner in c.bound_box:
                w = c.matrix_world @ Vector(corner)
                p = np.array(to_three(w, o))
                mins = np.minimum(mins, p)
                maxs = np.maximum(maxs, p)
    return dict(origin=to_three(o), anchors=anchors, bbox=[[round(float(v), 4) for v in mins], [round(float(v), 4) for v in maxs]])


def scene_bvh(roots):
    objs = []
    for r in roots:
        objs += descendants(r)
    T = collect(objs)
    return bvh_from(T["P"])


def write_json(path, data):
    with open(path, "w") as f:
        json.dump(data, f, ensure_ascii=False, indent=1)
