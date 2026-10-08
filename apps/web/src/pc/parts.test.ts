import { describe, expect, it } from "vitest";
import manifest from "./manifest.json";
import { LINKS, PARTS } from "./parts";

type Meta = { tris: number; bytes: number; anchors: Record<string, number[]>; bbox: number[][]; origin: number[] };
const ext = manifest.exterior as Record<string, Meta>;
const int = manifest.interior as Record<string, Meta>;

const FORBIDDEN = /高斯|泼溅|点云|three\.?js|webgl|渲染|cdn|blender/i;

describe("整机拆解 data", () => {
  it("every part has an exterior model and, when declared, an interior model", () => {
    for (const p of PARTS) {
      expect(ext[p.id], p.id).toBeTruthy();
      if (p.hasInterior) expect(int[p.id], `${p.id} interior`).toBeTruthy();
    }
  });

  it("every callout points at an anchor that exists in the model it is shown on", () => {
    for (const p of PARTS) {
      const meta = p.hasInterior ? int[p.id] : ext[p.id];
      for (const c of p.callouts) expect(meta?.anchors[c.anchor], `${p.id}.${c.anchor}`).toBeTruthy();
    }
  });

  it("every connection line endpoint resolves to an exterior anchor", () => {
    for (const l of LINKS) {
      expect(l.points.length).toBeGreaterThanOrEqual(2);
      for (const [part, key] of l.points) expect(ext[part]?.anchors[key], `${l.id}: ${part}.${key}`).toBeTruthy();
    }
  });

  it("stays inside the tablet budget (first load ≤ 8 MB, lazy interiors)", () => {
    const closed = Object.values(ext).reduce((s, m) => s + m.bytes, 0);
    expect(closed).toBeLessThanOrEqual(8 * 1024 * 1024);
    const tris = Object.values(ext).reduce((s, m) => s + m.tris, 0);
    expect(tris).toBeLessThanOrEqual(700_000);
    for (const [id, m] of Object.entries(int)) expect(m.tris, id).toBeLessThanOrEqual(300_000);
  });

  it("every material the models use is defined, and its texture is packed", () => {
    const mats = manifest.materials as Record<string, { tex?: string }>;
    const tex = manifest.textures as Record<string, number>;
    for (const m of Object.values(mats)) if (m.tex) expect(tex[m.tex], m.tex).toBeGreaterThan(0);
    for (const t of ["fin_brushed", "fin_powder", "fin_braid", "fin_mesh"]) expect(tex[t], t).toBeGreaterThan(0);
  });

  it("visible copy avoids implementation jargon", () => {
    const text = JSON.stringify({ PARTS, LINKS });
    expect(text).not.toMatch(FORBIDDEN);
  });
});
