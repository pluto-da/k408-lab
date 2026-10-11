import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";
import { describe, expect, it } from "vitest";

/** 在最小沙箱里执行数据结构 · 图实验脚本，测 window.LABU 上的纯计算函数，并在 jsdom 里挂载每个实验走到底 */
interface Edge { u: number; v: number; w: number; s: string }
interface Graph { n: number; V: string[]; E: Edge[]; directed: boolean; err?: string }
interface Err { err?: string }
interface Trav { order: number[]; tree: [number, number, number][]; roots: number[]; frames: { t: string; d: string }[] }
interface Mst extends Err { edges: [number, number, number, number][]; total: number; frames: { d: string }[] }
interface Topo { order: number[]; cycle: boolean; rest: number[]; frames: { t: string; d: string }[] }
interface Act { k: number; u: number; v: number; w: number; e: number; l: number; d: number }
interface Crit extends Err { order: number[]; ve: number[]; vl: number[]; acts: Act[]; crit: number[]; paths: number[][]; len: number; frames: { d: string }[] }
interface Floyd extends Err { A: number[][]; path: number[][]; frames: { k: number; ch: number[][]; d: string }[] }
interface LabU {
  dsParseVerts(s: string): Err & { V: string[] | null };
  dsParseEdges(vs: string, es: string, o?: { directed?: boolean; weighted?: boolean; allowNeg?: boolean }): Graph;
  dsAdj(g: Graph, ord?: string): { v: number; w: number; k: number }[][];
  dsConnected(g: Graph): boolean;
  dsDfs(g: Graph, s: number, ord?: string): Trav;
  dsBfs(g: Graph, s: number, ord?: string): Trav;
  dsPrim(g: Graph, s: number): Mst;
  dsKruskal(g: Graph): Mst;
  dsTopo(g: Graph, useQueue?: boolean): Topo;
  dsCritical(g: Graph, useQueue?: boolean): Crit;
  dsFloyd(g: Graph): Floyd;
  dsFloydPath(A: number[][], path: number[][], i: number, j: number): number[];
}
interface Demo { step(): boolean; reset(): void; done(): boolean }
interface K { opts: HTMLElement; stage: HTMLElement; out: HTMLElement; restart: () => void }
interface Lab { id: string; color: string; name: string; note: string; mount: (panel: HTMLElement, k: K) => Demo }

function load() {
  const file = resolve(__dirname, "../../public/legacy/js/20-lab-ds2.js");
  const win: Record<string, unknown> = { LAB: [] };
  const NS = "http://www.w3.org/2000/svg";
  const X = {
    reduced: true,
    svg(tag: string, attrs: Record<string, unknown>, parent?: Element) {
      const n = document.createElementNS(NS, tag);
      for (const k in attrs) n.setAttribute(k, String(attrs[k]));
      if (parent) parent.appendChild(n);
      return n;
    },
    el(tag: string, attrs?: Record<string, unknown>, html?: string) {
      const n = document.createElement(tag);
      for (const k in attrs ?? {}) n.setAttribute(k, String((attrs ?? {})[k]));
      if (html != null) n.innerHTML = html;
      return n;
    },
  };
  win.X = X;
  const ctx: Record<string, unknown> = { window: win, X, document, Error, Object, Array, JSON, Math, Number, String, parseInt, parseFloat, isNaN, isFinite };
  runInNewContext(readFileSync(file, "utf8"), new Proxy(ctx, {
    get: (t, k) => (k in t ? t[k as string] : win[k as string]),
    has: () => true,
    set: (t, k, v) => { t[k as string] = v; win[k as string] = v; return true; },
  }));
  return { U: win.LABU as LabU, LAB: win.LAB as Lab[] };
}

const { U, LAB } = load();
const INF = Infinity;

/* 可复现的伪随机数 */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}
function at<T>(a: readonly T[], i: number): T { const v = a[i]; if (v === undefined) throw new Error("越界 " + i); return v; }
function cell(m: number[][], i: number, j: number): number { return at(at(m, i), j); }
/** 随机连通无向带权图：先随机生成树再加边 */
function randConnected(r: () => number, n: number, extra: number, wmax: number): string {
  const es: string[] = [], seen = new Set<string>();
  const add = (a: number, b: number) => {
    const key = Math.min(a, b) + "-" + Math.max(a, b);
    if (a === b || seen.has(key)) return;
    seen.add(key); es.push(`${a + 1}-${b + 1}:${1 + Math.floor(r() * wmax)}`);
  };
  for (let i = 1; i < n; i++) add(i, Math.floor(r() * i));
  for (let t = 0; t < extra * 3 && es.length < n - 1 + extra; t++) add(Math.floor(r() * n), Math.floor(r() * n));
  return es.join(", ");
}
function bruteMst(g: Graph): number {
  const m = g.E.length, need = g.n - 1;
  let best = INF;
  const pick: number[] = [];
  function find(p: number[], x: number): number { while (at(p, x) !== x) x = at(p, x); return x; }
  function rec(start: number) {
    if (pick.length === need) {
      const p = Array.from({ length: g.n }, (_, i) => i);
      let w = 0;
      for (const k of pick) {
        const e = at(g.E, k), a = find(p, e.u), b = find(p, e.v);
        if (a === b) return;
        p[a] = b; w += e.w;
      }
      best = Math.min(best, w);
      return;
    }
    for (let k = start; k <= m - (need - pick.length); k++) { pick.push(k); rec(k + 1); pick.pop(); }
  }
  rec(0);
  return best;
}
function bellman(g: Graph, s: number): number[] {
  const d: number[] = Array.from({ length: g.n }, () => INF);
  d[s] = 0;
  const arcs: [number, number, number][] = [];
  for (const e of g.E) { arcs.push([e.u, e.v, e.w]); if (!g.directed) arcs.push([e.v, e.u, e.w]); }
  for (let it = 0; it < g.n; it++) for (const [a, b, w] of arcs) if (at(d, a) + w < at(d, b)) d[b] = at(d, a) + w;
  return d;
}
function dijkstra(g: Graph, s: number): number[] {
  const d: number[] = Array.from({ length: g.n }, () => INF), done: boolean[] = Array.from({ length: g.n }, () => false);
  d[s] = 0;
  const adj = U.dsAdj(g);
  for (;;) {
    let u = -1;
    for (let i = 0; i < g.n; i++) if (!at(done, i) && at(d, i) < INF && (u < 0 || at(d, i) < at(d, u))) u = i;
    if (u < 0) break;
    done[u] = true;
    for (const a of at(adj, u)) if (at(d, u) + a.w < at(d, a.v)) d[a.v] = at(d, u) + a.w;
  }
  return d;
}

describe("实验注册", () => {
  it("注册 4 个数据结构实验", () => {
    expect(LAB.map((l) => l.id)).toEqual(["graphtrav", "mst", "topo", "floyd"]);
    for (const l of LAB) { expect(l.color).toBe("var(--x-ds)"); expect(typeof l.mount).toBe("function"); expect(l.note.length).toBeGreaterThan(40); }
  });
});

describe("输入解析与校验", () => {
  it("顶点表与区间写法", () => {
    expect(U.dsParseVerts("1-8").V).toEqual(["1", "2", "3", "4", "5", "6", "7", "8"]);
    expect(U.dsParseVerts("A-D").V).toEqual(["A", "B", "C", "D"]);
    expect(U.dsParseVerts("V0, V1 V2").V).toEqual(["V0", "V1", "V2"]);
    expect(U.dsParseVerts("A A").err).toMatch(/重复/);
    expect(U.dsParseVerts("1-11").err).toMatch(/最多/);
  });
  it("边表各种写法", () => {
    const g = U.dsParseEdges("", "1-2:6，1-3:1；2->3 : 5\n3→4:−2", { allowNeg: true, directed: true });
    expect(g.err).toBeUndefined();
    expect(g.V).toEqual(["1", "2", "3", "4"]);
    expect(g.E.map((e) => [e.u, e.v, e.w])).toEqual([[0, 1, 6], [0, 2, 1], [1, 2, 5], [2, 3, -2]]);
  });
  it("中文错误提示", () => {
    expect(U.dsParseEdges("1-4", "1-9:3", {}).err).toMatch(/顶点 9 不存在/);
    expect(U.dsParseEdges("1-4", "2-2:3", {}).err).toMatch(/自环/);
    expect(U.dsParseEdges("1-4", "1-2:3, 2-1:4", {}).err).toMatch(/重复/);
    expect(U.dsParseEdges("1-4", "1->2:3, 2->1:4", { directed: true }).err).toBeUndefined();
    expect(U.dsParseEdges("1-4", "1->2:3, 1->2:4", { directed: true }).err).toMatch(/重复/);
    expect(U.dsParseEdges("1-4", "1-2", { weighted: true }).err).toMatch(/缺少权值/);
    expect(U.dsParseEdges("1-4", "1-2:-3", {}).err).toMatch(/为负/);
    expect(U.dsParseEdges("1-4", "1-2:3x", {}).err).toMatch(/无法识别/);
    expect(U.dsParseEdges("1-4", "", {}).err).toMatch(/为空/);
  });
});

describe("DFS / BFS（示例一 · 8 顶点无向图，邻接点按编号）", () => {
  const g = U.dsParseEdges("1-8", "1-2, 1-3, 1-4, 2-5, 3-5, 3-6, 4-7, 5-8, 6-8, 7-8", {});
  const nm = (a: number[]) => a.map((i) => at(g.V, i)).join(" ");
  it("访问序列与手算一致，DFS 与 BFS 明显不同", () => {
    expect(nm(U.dsDfs(g, 0).order)).toBe("1 2 5 3 6 8 7 4");
    expect(nm(U.dsBfs(g, 0).order)).toBe("1 2 3 4 5 6 7 8");
    expect(nm(U.dsDfs(g, 2).order)).toBe("3 1 2 5 8 6 7 4");
    expect(nm(U.dsBfs(g, 2).order)).toBe("3 1 5 6 2 4 8 7");
    expect(U.dsDfs(g, 0).tree.map(([p, c]) => at(g.V, p) + at(g.V, c)).join(" ")).toBe("12 25 53 36 68 87 74");
  });
  it("生成树有 n−1 条边且都是图中的边", () => {
    for (const r of [U.dsDfs(g, 0), U.dsBfs(g, 0)]) {
      expect(r.tree.length).toBe(7);
      for (const [p, c, k] of r.tree) { const e = at(g.E, k); expect([e.u, e.v].sort()).toEqual([p, c].sort()); }
    }
    expect(U.dsBfs(g, 0).tree.map(([p, c]) => at(g.V, p) + at(g.V, c)).join(" ")).toBe("12 13 14 25 36 47 58");
  });
  it("按边表输入顺序建邻接表时序列随之改变", () => {
    const h = U.dsParseEdges("1-4", "1-3, 1-2, 2-4, 3-4", {});
    expect(U.dsDfs(h, 0, "input").order).toEqual([0, 2, 3, 1]);
    expect(U.dsDfs(h, 0, "num").order).toEqual([0, 1, 3, 2]);
  });
  it("有向图与非连通图", () => {
    const d = U.dsParseEdges("1-6", "1->2, 1->4, 2->5, 3->5, 3->6, 4->2, 5->4, 6->3", { directed: true });
    expect(U.dsDfs(d, 0).order.map((i) => at(d.V, i)).join(" ")).toBe("1 2 5 4 3 6");
    expect(U.dsBfs(d, 0).order.map((i) => at(d.V, i)).join(" ")).toBe("1 2 4 5 3 6");
    expect(U.dsDfs(d, 0).roots.length).toBe(2);
    const f = U.dsParseEdges("A-G", "A-B, A-C, B-D, C-D, E-F, F-G, E-G", {});
    expect(U.dsBfs(f, 0).roots.map((i) => at(f.V, i))).toEqual(["A", "E"]);
    expect(U.dsDfs(f, 0).tree.length).toBe(5);
  });
});

describe("最小生成树", () => {
  it("示例一 · 6 顶点：权值和 14，Prim 与 Kruskal 加边顺序不同，等权边按约定先后", () => {
    const g = U.dsParseEdges("1-6", "1-2:4, 1-3:2, 2-3:3, 2-4:5, 3-4:6, 3-5:4, 4-5:3, 4-6:2, 5-6:5", { weighted: true });
    const p = U.dsPrim(g, 0), k = U.dsKruskal(g);
    const es = (m: Mst) => m.edges.map(([a, b]) => at(g.V, a) + at(g.V, b)).join(" ");
    expect(p.total).toBe(14);
    expect(k.total).toBe(14);
    expect(bruteMst(g)).toBe(14);
    expect(es(p)).toBe("13 32 35 54 46");
    expect(es(k)).toBe("13 46 23 45 35");
  });
  it("随机连通图：Prim = Kruskal = 穷举最小值", () => {
    const r = rng(408);
    for (let t = 0; t < 40; t++) {
      const n = 3 + Math.floor(r() * 5);
      const g = U.dsParseEdges("", randConnected(r, n, Math.floor(r() * 5), 9), { weighted: true });
      expect(g.err).toBeUndefined();
      expect(U.dsConnected(g)).toBe(true);
      const best = bruteMst(g), s = Math.floor(r() * g.n);
      const p = U.dsPrim(g, s), k = U.dsKruskal(g);
      expect(p.edges.length).toBe(g.n - 1);
      expect(p.total).toBe(best);
      expect(k.total).toBe(best);
    }
  });
  it("不连通图报错", () => {
    const g = U.dsParseEdges("1-4", "1-2:1, 3-4:2", { weighted: true });
    expect(U.dsConnected(g)).toBe(false);
    expect(U.dsPrim(g, 0).err).toMatch(/不连通/);
    expect(U.dsKruskal(g).err).toMatch(/不连通/);
  });
});

describe("拓扑排序", () => {
  const respects = (g: Graph, order: number[]) => g.E.every((e) => order.indexOf(e.u) < order.indexOf(e.v));
  it("示例 AOV（6 顶点，两个入度为 0）：栈与队列得到不同但都合法的拓扑序", () => {
    const g = U.dsParseEdges("1-6", "1->3, 1->4, 2->4, 2->5, 3->6, 4->6, 5->6", { directed: true });
    const want = ["2 5 1 4 3 6", "1 2 3 4 5 6"];
    [false, true].forEach((q, i) => {
      const t = U.dsTopo(g, q);
      expect(t.cycle).toBe(false);
      expect(t.order.map((v) => at(g.V, v)).join(" ")).toBe(want[i]);
      expect(respects(g, t.order)).toBe(true);
    });
  });
  it("随机 DAG：输出覆盖全部顶点且满足所有边", () => {
    const r = rng(42);
    for (let t = 0; t < 30; t++) {
      const n = 4 + Math.floor(r() * 6), perm = Array.from({ length: n }, (_, i) => i).sort(() => r() - 0.5), es: string[] = [], seen = new Set<string>();
      for (let c = 0; c < n * 2; c++) {
        const a = Math.floor(r() * n), b = Math.floor(r() * n);
        if (a >= b) continue;
        const u = at(perm, a) + 1, v = at(perm, b) + 1, key = u + ">" + v;
        if (seen.has(key)) continue;
        seen.add(key); es.push(`${u}->${v}`);
      }
      if (!es.length) continue;
      const g = U.dsParseEdges("1-" + n, es.join(","), { directed: true });
      for (const q of [false, true]) {
        const res = U.dsTopo(g, q);
        expect(res.cycle).toBe(false);
        expect(res.order.length).toBe(n);
        expect(respects(g, res.order)).toBe(true);
      }
    }
  });
  it("有回路时报告“存在回路”", () => {
    const g = U.dsParseEdges("1-6", "1->2, 2->3, 3->4, 4->2, 1->5, 5->6", { directed: true });
    const t = U.dsTopo(g);
    expect(t.cycle).toBe(true);
    expect(t.rest.map((i) => at(g.V, i)).sort()).toEqual(["2", "3", "4"]);
    expect(t.frames[t.frames.length - 1]?.d).toMatch(/存在回路/);
    expect(U.dsCritical(g).err).toMatch(/存在回路/);
  });
});

describe("关键路径", () => {
  function longest(g: Graph, s: number, t: number): number {
    const topo = U.dsTopo(g).order, d: number[] = Array.from({ length: g.n }, () => -INF);
    d[s] = 0;
    for (const v of topo) for (const e of g.E) if (e.u === v && at(d, v) > -INF) d[e.v] = Math.max(at(d, e.v), at(d, v) + e.w);
    return at(d, t);
  }
  it("示例 AOE（7 事件 9 活动）：工期 11，三条关键路径，a3、a7 余量 3", () => {
    const g = U.dsParseEdges("1-7", "1->2:3, 1->3:4, 1->4:2, 2->5:4, 3->5:3, 3->6:5, 4->6:4, 5->7:4, 6->7:2", { directed: true, weighted: true });
    const c = U.dsCritical(g);
    expect(c.err).toBeUndefined();
    expect(c.ve).toEqual([0, 3, 4, 2, 7, 9, 11]);
    expect(c.vl).toEqual([0, 3, 4, 5, 7, 9, 11]);
    expect(c.crit.map((k) => "a" + (k + 1))).toEqual(["a1", "a2", "a4", "a5", "a6", "a8", "a9"]);
    expect(c.acts.filter((a) => a.d > 0).map((a) => ["a" + (a.k + 1), a.e, a.l, a.d])).toEqual([["a3", 0, 3, 3], ["a7", 2, 5, 3]]);
    expect(c.len).toBe(11);
    expect(c.paths.map((p) => p.map((i) => at(g.V, i)).join(""))).toEqual(["1257", "1357", "1367"]);
  });
  it("示例二 AOE（9 事件 11 活动，本站自拟）：工期 20，两条关键路径", () => {
    const g = U.dsParseEdges("1-9", "1->2:6, 1->3:3, 1->4:6, 2->5:2, 3->5:4, 4->6:3, 5->7:7, 5->8:7, 6->8:6, 7->9:3, 8->9:5", { directed: true, weighted: true });
    const c = U.dsCritical(g);
    expect(c.len).toBe(20);
    expect(c.crit.map((k) => "a" + (k + 1))).toEqual(["a1", "a3", "a4", "a6", "a8", "a9", "a11"]);
    expect(c.paths.length).toBe(2);
  });
  it("随机 AOE：关键活动 l − e = 0，ve(汇点) = 最长路径", () => {
    const r = rng(7);
    for (let t = 0; t < 30; t++) {
      const n = 4 + Math.floor(r() * 6), es: string[] = [], seen = new Set<string>();
      for (let i = 1; i < n - 1; i++) { const a = Math.floor(r() * i); es.push(`${a + 1}->${i + 1}:${1 + Math.floor(r() * 9)}`); seen.add(a + ">" + i); }
      for (let i = 0; i < n - 1; i++) {
        /* 每个非汇点至少有一条出边，且都能到汇点 n */
        const b = i + 1 + Math.floor(r() * (n - 1 - i));
        if (!seen.has(i + ">" + b)) { seen.add(i + ">" + b); es.push(`${i + 1}->${b + 1}:${1 + Math.floor(r() * 9)}`); }
      }
      const g = U.dsParseEdges("1-" + n, es.join(","), { directed: true, weighted: true });
      expect(g.err).toBeUndefined();
      const c = U.dsCritical(g);
      if (c.err) { expect(c.err).toMatch(/汇点|源点/); continue; }
      expect(c.len).toBe(longest(g, 0, n - 1));
      expect(at(c.ve, n - 1)).toBe(c.len);
      for (const a of c.acts) { expect(a.d).toBeGreaterThanOrEqual(0); expect(a.d === 0).toBe(c.crit.includes(a.k)); }
      for (const p of c.paths) {
        let len = 0;
        for (let i = 0; i + 1 < p.length; i++) len += at(g.E, g.E.findIndex((e) => e.u === at(p, i) && e.v === at(p, i + 1))).w;
        expect(len).toBe(c.len);
      }
    }
  });
  it("多个源点 / 汇点报错", () => {
    expect(U.dsCritical(U.dsParseEdges("1-4", "1->3:1, 2->3:1, 3->4:1", { directed: true, weighted: true })).err).toMatch(/源点/);
    expect(U.dsCritical(U.dsParseEdges("1-4", "1->2:1, 2->3:1, 2->4:1", { directed: true, weighted: true })).err).toMatch(/汇点/);
  });
});

describe("Floyd", () => {
  it("默认示例一（本站自拟）：每一轮都有更新，结果与手算一致", () => {
    const g = U.dsParseEdges("0-3", "0->1:5, 0->2:2, 1->0:6, 1->3:1, 2->1:2, 2->3:7, 3->0:3, 3->2:4", { directed: true, weighted: true });
    const f = U.dsFloyd(g);
    expect(f.A).toEqual([[0, 4, 2, 5], [4, 0, 5, 1], [6, 2, 0, 3], [3, 6, 4, 0]]);
    expect(f.frames.filter((x) => x.ch.length > 0).length).toBeGreaterThanOrEqual(4);
    expect(U.dsFloydPath(f.A, f.path, 0, 3)).toEqual([0, 2, 1, 3]);
    expect(U.dsFloydPath(f.A, f.path, 2, 0)).toEqual([2, 1, 3, 0]);
    expect(U.dsFloydPath(f.A, f.path, 3, 1)).toEqual([3, 2, 1]);
  });
  it("示例二 · 4 顶点有向图：多次经中转点缩短", () => {
    const g = U.dsParseEdges("0-3", "0->1:2, 0->2:9, 1->2:3, 1->3:8, 2->0:4, 2->3:1, 3->0:6", { directed: true, weighted: true });
    const f = U.dsFloyd(g);
    expect(f.A).toEqual([[0, 2, 5, 6], [7, 0, 3, 4], [4, 6, 0, 1], [6, 8, 11, 0]]);
    expect(f.path).toEqual([[-1, -1, 1, 2], [2, -1, -1, 2], [-1, 0, -1, -1], [-1, 0, 1, -1]]);
    expect(f.frames.length).toBe(5);
    expect(f.frames.map((fr) => fr.ch.length)).toEqual([0, 3, 3, 3, 0]);
    expect(U.dsFloydPath(f.A, f.path, 0, 3)).toEqual([0, 1, 2, 3]);
    expect(U.dsFloydPath(f.A, f.path, 3, 2)).toEqual([3, 0, 1, 2]);
  });
  it("随机图：与每个源点各跑一次 Dijkstra / Bellman-Ford 一致", () => {
    const r = rng(2026);
    for (let t = 0; t < 40; t++) {
      const n = 3 + Math.floor(r() * 5), directed = r() < 0.6, neg = directed && r() < 0.4, es: string[] = [], seen = new Set<string>();
      for (let c = 0; c < n * 2; c++) {
        const a = Math.floor(r() * n), b = Math.floor(r() * n);
        if (a === b) continue;
        const key = directed ? a + ">" + b : Math.min(a, b) + "-" + Math.max(a, b);
        if (seen.has(key)) continue;
        seen.add(key);
        es.push(`${a}${directed ? "->" : "-"}${b}:${neg ? Math.floor(r() * 12) - 3 : 1 + Math.floor(r() * 9)}`);
      }
      if (!es.length) continue;
      const g = U.dsParseEdges("0-" + (n - 1), es.join(","), { directed, weighted: true, allowNeg: true });
      expect(g.err).toBeUndefined();
      const f = U.dsFloyd(g);
      if (f.err) { expect(neg).toBe(true); expect(f.err).toMatch(/负权回路/); continue; }
      for (let s = 0; s < n; s++) {
        const ref = neg ? bellman(g, s) : dijkstra(g, s);
        expect(f.A[s]).toEqual(ref);
        for (let j = 0; j < n; j++) {
          const p = U.dsFloydPath(f.A, f.path, s, j);
          if (cell(f.A, s, j) === INF) { expect(p).toEqual([]); continue; }
          let len = 0;
          for (let i = 0; i + 1 < p.length; i++) {
            const a = at(p, i), b = at(p, i + 1), e = g.E.find((x) => (x.u === a && x.v === b) || (!directed && x.u === b && x.v === a));
            expect(e).toBeDefined();
            len += e ? e.w : 0;
          }
          expect(len).toBe(cell(f.A, s, j));
        }
      }
    }
  });
  it("负权回路报错", () => {
    const g = U.dsParseEdges("0-2", "0->1:1, 1->2:-3, 2->0:1", { directed: true, weighted: true, allowNeg: true });
    expect(U.dsFloyd(g).err).toMatch(/负权回路/);
    expect(U.dsFloyd(U.dsParseEdges("0-1", "0-1:-1", { weighted: true, allowNeg: true })).err).toMatch(/负权回路/);
  });
});

describe("界面冒烟（jsdom）", () => {
  function mount(l: Lab) {
    const panel = document.createElement("div");
    panel.innerHTML = '<div class="x-lab__opts"></div><div class="x-lab__stage"></div><div class="x-lab__out"></div>';
    document.body.appendChild(panel);
    const q = (s: string) => { const n = panel.querySelector<HTMLElement>(s); if (!n) throw new Error(s); return n; };
    let demo: Demo | null = null;
    const k: K = { opts: q(".x-lab__opts"), stage: q(".x-lab__stage"), out: q(".x-lab__out"), restart: () => demo?.reset() };
    demo = l.mount(panel, k);
    return { panel, demo, k };
  }
  function runToEnd(d: Demo) {
    let n = 0;
    while (d.step() && n < 3000) n++;
    expect(d.done()).toBe(true);
    return n;
  }
  for (const id of ["graphtrav", "mst", "topo", "floyd"]) {
    it(`${id}：默认数据、每个按钮和例题都能走到底`, () => {
      const l = LAB.find((x) => x.id === id);
      if (!l) throw new Error(id);
      const { panel, demo, k } = mount(l);
      expect(k.out.querySelector(".x-lab__err")).toBeNull();
      expect(runToEnd(demo)).toBeGreaterThanOrEqual(3);
      const svg = k.stage.querySelector("svg");
      expect(svg?.querySelectorAll("circle").length).toBeGreaterThan(3);
      const vb = (svg?.getAttribute("viewBox") ?? "").split(" ").map(Number);
      expect(vb[2]).toBeLessThanOrEqual(720);
      for (const c of Array.from(svg?.querySelectorAll("circle") ?? [])) expect(Number(c.getAttribute("r"))).toBeGreaterThanOrEqual(16);
      const btns = Array.from(panel.querySelectorAll<HTMLButtonElement>(".x-lab__btn"));
      expect(btns.length).toBeGreaterThan(3);
      for (const b of btns) {
        b.click();
        runToEnd(demo);
        const errNode = k.out.querySelector(".x-lab__err");
        if (errNode) expect(errNode.textContent ?? "").toMatch(/负权回路/);
        expect((k.out.textContent ?? "").length).toBeGreaterThan(10);
      }
      /* 错误输入给出中文提示，不抛异常 */
      const ta = panel.querySelector("textarea");
      if (!ta) throw new Error("no textarea");
      ta.value = "1-99:3";
      demo.reset();
      expect(k.out.querySelector(".x-lab__err")?.textContent).toMatch(/不存在/);
      expect(demo.step()).toBe(false);
      expect(demo.done()).toBe(true);
    });
  }
  it("拓扑实验：有回路例题显示“存在回路”，关键路径表标出关键活动", () => {
    const l = LAB.find((x) => x.id === "topo");
    if (!l) throw new Error("topo");
    const { panel, demo, k } = mount(l);
    const btn = (t: string) => { const b = Array.from(panel.querySelectorAll<HTMLButtonElement>(".x-lab__btn")).find((x) => (x.textContent ?? "").includes(t)); if (!b) throw new Error(t); return b; };
    btn("有回路").click(); runToEnd(demo);
    expect(k.out.textContent).toMatch(/存在回路/);
    btn("示例 AOE").click(); runToEnd(demo);
    expect(k.out.textContent).toMatch(/1→2→5→7/);
    expect(k.out.textContent).toMatch(/1→3→6→7/);
    expect(k.out.querySelectorAll("tr.x-d2-crow").length).toBe(7);
  });
  it("Floyd 实验：变化格子高亮", () => {
    const l = LAB.find((x) => x.id === "floyd");
    if (!l) throw new Error("floyd");
    const { demo, k } = mount(l);
    let seen = 0;
    while (demo.step()) seen += k.out.querySelectorAll("td.x-d2-ch").length;
    expect(seen).toBeGreaterThan(0);
    expect(k.out.textContent).toMatch(/由 path 还原的最短路径/);
  });
});
