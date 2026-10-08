import { describe, expect, it } from "vitest";
import manifest from "./manifest.json";
import { LINKS, PARTS } from "./parts";

type Meta = { count: number; bytes: number; anchors: Record<string, number[]>; bbox: number[][]; origin: number[] };
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

  it("stays inside the tablet splat budget", () => {
    const closed = Object.values(ext).reduce((s, m) => s + m.count, 0);
    expect(closed).toBeLessThanOrEqual(720_000);
    for (const [id, m] of Object.entries(int)) expect(m.count, id).toBeLessThanOrEqual(250_000);
  });

  it("visible copy avoids implementation jargon", () => {
    const text = JSON.stringify({ PARTS, LINKS });
    expect(text).not.toMatch(FORBIDDEN);
  });
});
