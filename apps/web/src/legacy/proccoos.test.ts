import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";
import { describe, expect, it } from "vitest";

/** 过程图解补充（18-proc-coos.js）：Cache 读写、文件打开与读取、SPOOLing */
interface Step { t: string; d?: string; tip?: string; on?: string[]; go?: string[]; kv?: Record<string, string>; set?: Record<string, Record<string, unknown>> }
interface Node { id: string; x: number; y: number; w: number; h: number; k?: string }
interface Spec { w: number; h: number; nodes: Node[]; edges: { id: string; a: string; b: string }[]; steps: Step[] }
interface Mode { name: string; make?: (inp: Record<string, string>) => Spec }
interface Proc { id: string; sub: string; name: string; note?: string[]; modes: Mode[] }

function load(): Proc[] {
  const dir = resolve(__dirname, "../../legacy-src/js");
  const win: Record<string, unknown> = { __LEGACY_LOADER__: true, addEventListener: () => undefined };
  const ctx: Record<string, unknown> = { window: win, document: { readyState: "complete" }, setTimeout, Math, Number, String, parseInt, isNaN, Error, Object, Array, JSON };
  win.X = { reduced: true };
  ctx.X = win.X;
  for (const f of ["11-proc-core.js", "18-proc-coos.js"]) {
    runInNewContext(readFileSync(resolve(dir, f), "utf8"), new Proxy(ctx, { get: (t, k) => (k in t ? t[k as string] : win[k as string]), has: () => true, set: (t, k, v) => { t[k as string] = v; win[k as string] = v; return true; } }));
  }
  return win.PROC as Proc[];
}

const PROC = load();
const byId = (id: string) => PROC.find((p) => p.id === id)!;
const mode = (id: string, name: string) => byId(id).modes.find((m) => m.name === name)!.make!({});
const lastKv = (s: Spec) => s.steps.reduce<Record<string, string>>((a, st) => ({ ...a, ...(st.kv ?? {}) }), {});
/** 某个部件在最后一步时的累积状态 */
const finalSet = (s: Spec, id: string) => s.steps.reduce<Record<string, unknown>>((a, st) => ({ ...a, ...(st.set?.[id] ?? {}) }), {});

describe("过程图解补充：Cache 读写 / 文件打开 / SPOOLing", () => {
  it("注册了 3 个图解，学科正确", () => {
    expect(PROC.map((p) => [p.id, p.sub])).toEqual([["cachewrite", "co"], ["fileopen", "os"], ["spooling", "os"]]);
    for (const p of PROC) {
      expect(p.note!.length).toBeGreaterThanOrEqual(3);
      expect(p.note!.length).toBeLessThanOrEqual(5);
    }
    expect(byId("cachewrite").modes.map((m) => m.name)).toEqual(["读命中", "读缺失", "写命中·写回法", "写命中·全写法", "写缺失·写分配", "写缺失·非写分配"]);
  });

  it("每个模式的步骤引用的部件与连线都存在，部件互不重叠", () => {
    for (const p of PROC) {
      for (const m of p.modes) {
        const spec = m.make!({});
        const nodes = new Set(spec.nodes.map((n) => n.id));
        const edges = new Set(spec.edges.map((e) => e.id));
        expect(nodes.size, `${p.id}/${m.name} 部件 id 唯一`).toBe(spec.nodes.length);
        expect(edges.size, `${p.id}/${m.name} 连线 id 唯一`).toBe(spec.edges.length);
        expect(spec.steps.length, `${p.id}/${m.name}`).toBeGreaterThan(3);
        for (const e of spec.edges) {
          expect(nodes.has(e.a), `${p.id} 连线 ${e.id} 起点`).toBe(true);
          expect(nodes.has(e.b), `${p.id} 连线 ${e.id} 终点`).toBe(true);
        }
        for (const st of spec.steps) {
          expect(st.t, `${p.id} 步骤标题`).toBeTruthy();
          expect(st.d, `${p.id}「${st.t}」说明`).toBeTruthy();
          for (const id of st.on ?? []) expect(nodes.has(id), `${p.id}「${st.t}」部件 ${id}`).toBe(true);
          for (const id of st.go ?? []) expect(edges.has(id), `${p.id}「${st.t}」连线 ${id}`).toBe(true);
          for (const id of Object.keys(st.set ?? {})) expect(nodes.has(id), `${p.id}「${st.t}」set ${id}`).toBe(true);
        }
        const solid = spec.nodes.filter((n) => n.k !== "zone");
        for (const n of solid) {
          expect(n.x + n.w, `${p.id} ${n.id} 超出宽度`).toBeLessThanOrEqual(spec.w);
          expect(n.y + n.h, `${p.id} ${n.id} 超出高度`).toBeLessThanOrEqual(spec.h);
        }
        for (let i = 0; i < solid.length; i++) {
          for (let j = i + 1; j < solid.length; j++) {
            const a = solid[i]!, b = solid[j]!;
            const overlap = a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
            expect(overlap, `${p.id} ${a.id} 与 ${b.id} 重叠`).toBe(false);
          }
        }
      }
    }
  });

  it("Cache：写回法置脏位且不访存，全写法经写缓冲访存 1 次", () => {
    const wb = mode("cachewrite", "写命中·写回法");
    const rows = finalSet(wb, "CACHE").rows as string[][];
    expect(rows[3]).toEqual(["组1·行0", "1", "1", "1A", "块 1A·1（已改）"]);
    expect(lastKv(wb)["访问主存次数"]).toBe("0");
    const wt = mode("cachewrite", "写命中·全写法");
    expect((finalSet(wt, "CACHE").rows as string[][])[3]![2]).toBe("—");
    expect(lastKv(wt)["访问主存次数"]).toBe("1");
    expect(lastKv(mode("cachewrite", "读命中"))["访问主存次数"]).toBe("0");
    expect(lastKv(mode("cachewrite", "读缺失"))["访问主存次数"]).toBe("2");
    expect(lastKv(mode("cachewrite", "写缺失·写分配"))["访问主存次数"]).toBe("2");
    expect(lastKv(mode("cachewrite", "写缺失·非写分配"))["访问主存次数"]).toBe("1");
  });

  it("文件：open 读盘 3 次并返回 fd 3，close 打开计数减到 0", () => {
    const open = mode("fileopen", "open 打开");
    expect(lastKv(open)["读盘次数"]).toBe("3");
    expect(lastKv(open)["打开计数"]).toBe("1");
    expect(finalSet(open, "FD").v).toBe("3");
    const read = mode("fileopen", "read 读取");
    expect(lastKv(read)["物理块号"]).toBe("377");
    expect(lastKv(read)["读写指针"]).toBe("2000");
    expect(lastKv(mode("fileopen", "close 关闭"))["打开计数"]).toBe("0");
  });

  it("SPOOLing：三个请求入队后全部打印完", () => {
    const s = byId("spooling").modes[0]!.make!({});
    expect(s.steps.some((st) => st.kv?.["请求数"] === "3")).toBe(true);
    expect(lastKv(s)["请求数"]).toBe("0");
    expect(lastKv(s)["打印机"]).toBe("空闲");
  });
});
