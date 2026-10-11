import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";
import { describe, expect, it } from "vitest";

/** 过程图解 · 数据结构（22-proc-ds.js）：链表、循环队列、递归栈、线索化、树森林转换、堆、红黑树、外部排序 */
type Seg = { t: string; v?: string; on?: boolean };
interface Step { t: string; d?: string; tip?: string; on?: string[]; go?: string[]; kv?: Record<string, string>; set?: Record<string, Record<string, unknown>>; rb?: Record<string, [number, string]> }
interface Node { id: string; x: number; y: number; w: number; h: number; k?: string; t?: string; v?: string; segs?: Seg[]; rows?: string[][]; rh?: number }
interface Edge { id: string; a: string; b: string; as?: string; bs?: string; ao?: number; bo?: number; pts?: number[][]; mx?: number; my?: number; t?: string; lp?: number[] }
interface Spec { w: number; h: number; nodes: Node[]; edges: Edge[]; steps: Step[] }
interface Mode { name: string; make?: (inp: Record<string, string>) => Spec }
interface Proc { id: string; sub: string; name: string; note?: string[]; modes: Mode[] }
interface DSU {
  dummy: (n: number, k: number) => number;
  loser: (v: number[]) => { ls: number[]; champion: number };
  bestTree: (l: number[], k: number) => { dummy: number; wpl: number; io: number };
  buildHeap: (a: number[]) => { heap: number[]; cmp: number };
  isMinHeap: (h: number[]) => boolean;
  replSel: (d: number[], w: number) => { runs: number[][] };
  rbInsert: (k: number[]) => { slots: Record<string, [number, string]>; rot: number };
}

function load(): { PROC: Proc[]; DS: DSU } {
  const dir = resolve(__dirname, "../../public/legacy/js");
  const win: Record<string, unknown> = { __LEGACY_LOADER__: true, addEventListener: () => undefined };
  const ctx: Record<string, unknown> = { window: win, document: { readyState: "complete" }, setTimeout, Math, Number, String, parseInt, isNaN, Error, Object, Array, JSON, Infinity, Boolean, RegExp };
  win.X = { reduced: true };
  ctx.X = win.X;
  for (const f of ["11-proc-core.js", "22-proc-ds.js"]) {
    runInNewContext(readFileSync(resolve(dir, f), "utf8"), new Proxy(ctx, { get: (t, k) => (k in t ? t[k as string] : win[k as string]), has: () => true, set: (t, k, v) => { t[k as string] = v; win[k as string] = v; return true; } }));
  }
  return { PROC: win.PROC as Proc[], DS: (win.PROCU as { ds: DSU }).ds };
}

const { PROC, DS } = load();
const IDS = ["linklist", "cqueue", "recursion", "thread", "forest", "heapop", "rbtree", "extsort"];
const byId = (id: string) => PROC.find((p) => p.id === id)!;
const mode = (id: string, i: number, inp: Record<string, string> = {}) => byId(id).modes[i]!.make!(inp);
const lastKv = (s: Spec) => s.steps.reduce<Record<string, string>>((a, st) => ({ ...a, ...(st.kv ?? {}) }), {});
const finalSet = (s: Spec, id: string, upto = s.steps.length) => s.steps.slice(0, upto).reduce<Record<string, unknown>>((a, st) => ({ ...a, ...(st.set?.[id] ?? {}) }), {});
const segVals = (s: Spec, id: string) => ((finalSet(s, id).segs as Seg[] | undefined) ?? s.nodes.find((n) => n.id === id)!.segs!).map((x) => x.v);

/* 与 11-proc-core.js 相同的连线路由，用来做几何检查 */
function anchor(n: Node, side: string, off = 0): number[] {
  if (side === "l") return [n.x, n.y + n.h / 2 + off];
  if (side === "r") return [n.x + n.w, n.y + n.h / 2 + off];
  if (side === "t") return [n.x + n.w / 2 + off, n.y];
  return [n.x + n.w / 2 + off, n.y + n.h];
}
function route(e: Edge, N: Record<string, Node>): number[][] {
  const as = e.as || "r", bs = e.bs || "l";
  const p0 = anchor(N[e.a]!, as, e.ao), p1 = anchor(N[e.b]!, bs, e.bo);
  let pts = [p0];
  if (e.pts) pts = pts.concat(e.pts);
  else {
    const hA = as === "l" || as === "r", hB = bs === "l" || bs === "r";
    if (hA && hB) { if (p0[1] !== p1[1]) { const mx = e.mx ?? (p0[0]! + p1[0]!) / 2; pts.push([mx, p0[1]!], [mx, p1[1]!]); } }
    else if (!hA && !hB) { if (p0[0] !== p1[0]) { const my = e.my ?? (p0[1]! + p1[1]!) / 2; pts.push([p0[0]!, my], [p1[0]!, my]); } }
    else if (hA) pts.push([p1[0]!, p0[1]!]);
    else pts.push([p0[0]!, p1[1]!]);
  }
  pts.push(p1);
  return pts;
}
const tw = (s: string) => [...s].reduce((w, c) => w + (c.charCodeAt(0) > 255 ? 12.5 : 6.9), 0);
const ov = (a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

/** 按完全二叉树编号检查红黑性质 */
function rbOk(slots: Record<string, [number, string]>) {
  const S = (i: number) => slots[String(i)];
  if (!S(1)) return true;
  if (S(1)![1] !== "B") return false;
  const bh: number[] = [];
  let ok = true;
  (function walk(i: number, lo: number, hi: number, b: number) {
    const n = S(i);
    if (!n) { bh.push(b + 1); return; }
    if (n[0] <= lo || n[0] >= hi) ok = false;
    if (n[1] === "R" && i > 1 && S(i >> 1)![1] === "R") ok = false;
    const nb = b + (i > 1 && n[1] === "B" ? 1 : 0);
    walk(2 * i, lo, n[0], nb); walk(2 * i + 1, n[0], hi, nb);
  })(1, -Infinity, Infinity, 0);
  return ok && bh.every((h) => h === bh[0]);
}

describe("过程图解 · 数据结构", () => {
  it("注册了 8 个图解，全部属于数据结构，考点 3–5 条", () => {
    expect(PROC.map((p) => p.id)).toEqual(IDS);
    for (const p of PROC) {
      expect(p.sub).toBe("ds");
      expect(p.note!.length).toBeGreaterThanOrEqual(3);
      expect(p.note!.length).toBeLessThanOrEqual(5);
    }
    expect(byId("linklist").modes.map((m) => m.name)).toContain("双链表·错误顺序");
    expect(byId("cqueue").modes.map((m) => m.name)).toEqual(["牺牲一个单元", "增设 size", "增设 tag"]);
    expect(byId("extsort").modes.length).toBe(3);
  });

  it("每个模式：引用存在、步数 > 3、部件不重叠、连线横平竖直且不穿过部件、标签不重叠", () => {
    for (const p of PROC) {
      for (const m of p.modes) {
        const tag = `${p.id}/${m.name}`;
        const spec = m.make!({});
        expect(spec.w, tag).toBeGreaterThanOrEqual(860);
        expect(spec.w, tag).toBeLessThanOrEqual(980);
        expect(spec.h, tag).toBeGreaterThanOrEqual(380);
        expect(spec.h, tag).toBeLessThanOrEqual(640);
        const N: Record<string, Node> = {};
        spec.nodes.forEach((n) => { N[n.id] = n; });
        const edges = new Set(spec.edges.map((e) => e.id));
        expect(Object.keys(N).length, `${tag} 部件 id 唯一`).toBe(spec.nodes.length);
        expect(edges.size, `${tag} 连线 id 唯一`).toBe(spec.edges.length);
        expect(spec.steps.length, tag).toBeGreaterThan(3);
        for (const st of spec.steps) {
          expect(st.t, `${tag} 步骤标题`).toBeTruthy();
          expect(st.d, `${tag}「${st.t}」说明`).toBeTruthy();
          for (const id of st.on ?? []) expect(N[id], `${tag}「${st.t}」部件 ${id}`).toBeTruthy();
          for (const id of st.go ?? []) expect(edges.has(id), `${tag}「${st.t}」连线 ${id}`).toBe(true);
          for (const id of Object.keys(st.set ?? {})) expect(N[id], `${tag}「${st.t}」set ${id}`).toBeTruthy();
        }
        const solid = spec.nodes.filter((n) => n.k !== "zone");
        for (const n of spec.nodes) {
          expect(n.x >= 0 && n.y >= 0 && n.x + n.w <= spec.w && n.y + n.h <= spec.h, `${tag} ${n.id} 越界`).toBe(true);
        }
        for (let i = 0; i < solid.length; i++) {
          for (let j = i + 1; j < solid.length; j++) expect(ov(solid[i]!, solid[j]!), `${tag} ${solid[i]!.id} 与 ${solid[j]!.id} 重叠`).toBe(false);
        }
        const labels: { x: number; y: number; w: number; h: number; id: string }[] = [];
        for (const e of spec.edges) {
          expect(N[e.a] && N[e.b], `${tag} 连线 ${e.id} 两端`).toBeTruthy();
          const pts = route(e, N);
          for (let i = 0; i < pts.length - 1; i++) {
            const [a, b] = [pts[i]!, pts[i + 1]!];
            expect(a[0] === b[0] || a[1] === b[1], `${tag} 连线 ${e.id} 斜线`).toBe(true);
            const box = { x: Math.min(a[0]!, b[0]!), y: Math.min(a[1]!, b[1]!), w: Math.abs(a[0]! - b[0]!), h: Math.abs(a[1]! - b[1]!) };
            for (const n of solid) {
              if (n.id === e.a || n.id === e.b) continue;
              const hit = box.x < n.x + n.w - 1 && box.x + box.w > n.x + 1 && box.y < n.y + n.h - 1 && box.y + box.h > n.y + 1;
              expect(hit, `${tag} 连线 ${e.id} 穿过 ${n.id}`).toBe(false);
            }
          }
          if (e.t) {
            let lp = e.lp;
            if (!lp) {
              let best = -1, bi = 0;
              for (let i = 0; i < pts.length - 1; i++) { const d = Math.abs(pts[i + 1]![0]! - pts[i]![0]!) + Math.abs(pts[i + 1]![1]! - pts[i]![1]!); if (d > best) { best = d; bi = i; } }
              lp = [(pts[bi]![0]! + pts[bi + 1]![0]!) / 2, (pts[bi]![1]! + pts[bi + 1]![1]!) / 2];
            }
            const w = tw(e.t) + 10, L = { x: lp[0]! - w / 2, y: lp[1]! - 9, w, h: 18, id: e.id };
            for (const n of solid) expect(ov(L, n), `${tag} 标签 ${e.id} 压住 ${n.id}`).toBe(false);
            for (const o of labels) expect(ov(L, o), `${tag} 标签 ${e.id} 与 ${o.id} 重叠`).toBe(false);
            labels.push(L);
          }
        }
      }
    }
  });

  it("双链表插入：正确顺序 s->next = p->next; p->next->prior = s; s->prior = p; p->next = s", () => {
    const s = mode("linklist", 3);
    const code = s.nodes.find((n) => n.id === "CODE")!.rows!.map((r) => r[1]);
    expect(code).toEqual(["s->next = p->next;", "p->next->prior = s;", "s->prior = p;", "p->next = s;"]);
    /* 每条语句对应一步，依次点亮 n1 → n2 → n3 → n4 */
    const order = s.steps.filter((st) => st.go?.length === 1 && /^n\d$/.test(st.go[0]!)).map((st) => st.go![0]);
    expect(order).toEqual(["n1", "n2", "n3", "n4"]);
    expect(segVals(s, "s")).toEqual(["←a1", "e", "→a2"]);
    expect(segVals(s, "a1")[2]).toBe("→s");
    expect(segVals(s, "a2")[0]).toBe("←s");
    expect(lastKv(s)["a2 可达"]).toBe("是");
  });

  it("双链表错误顺序：先改 p->next 导致 s 自环、后继丢失", () => {
    const s = mode("linklist", 4);
    expect(s.nodes.find((n) => n.id === "CODE")!.rows![0]![1]).toBe("p->next = s;");
    expect(segVals(s, "s")[2]).toBe("→s");
    expect(segVals(s, "a2")[0]).toBe("←a1");
    expect(lastKv(s)["a2 可达"]).toMatch(/^否/);
  });

  it("单链表：头插两句顺序、删除后 a1 指向 a3", () => {
    const h = mode("linklist", 0);
    expect(h.nodes.find((n) => n.id === "CODE")!.rows!.map((r) => r[1])).toEqual(["s->next = L->next;", "L->next = s;"]);
    expect(segVals(h, "L")[1]).toBe("→s");
    const d = mode("linklist", 2);
    expect(segVals(d, "a1")[1]).toBe("→a3");
    expect(lastKv(d)["表长"]).toBe("2");
  });

  it("循环队列：牺牲单元存 5 个即满，size / tag 方案存 6 个；绕回后长度公式", () => {
    const sac = mode("cqueue", 0);
    const full = sac.steps.find((st) => /队满，拒绝/.test(st.t))!;
    expect(full.kv!["元素个数"]).toBe("5");
    expect(full.kv!.rear).toBe("5");
    expect(full.kv!.front).toBe("0");
    const kv = lastKv(sac);
    expect([kv.front, kv.rear, kv["队列长度"]]).toEqual(["2", "1", "5"]);
    for (const i of [1, 2]) {
      const s = mode("cqueue", i);
      const f = s.steps.find((st) => /队满，拒绝/.test(st.t))!;
      expect(f.kv!["元素个数"]).toBe("6");
      expect(f.kv!.front).toBe(f.kv!.rear);
    }
    expect(lastKv(mode("cqueue", 2)).tag).toBe("1");
  });

  it("递归：fact(4) 深度 4 返回 24；Fib(4) 调用 9 次、最大深度 4、结果 3", () => {
    const f = lastKv(mode("recursion", 0));
    expect(f["结果"]).toBe("24");
    expect(mode("recursion", 0).steps.some((st) => st.kv?.["最大深度"] === "4")).toBe(true);
    const g = lastKv(mode("recursion", 1));
    expect([g["调用次数"], g["最大深度"], g["结果"]]).toEqual(["9", "4", "3"]);
  });

  it("中序线索化：7 条线索，ltag/rtag 表与中序前驱后继一致", () => {
    const s = mode("thread", 0);
    const rows = finalSet(s, "TAG").rows as string[][];
    const inorder = ["D", "B", "A", "E", "C", "F"];
    const R: Record<string, string[]> = {};
    rows.slice(1).forEach((r) => { R[r[0]!] = r; });
    let threads = 0;
    inorder.forEach((k, i) => {
      const r = R[k]!;
      if (r[1] === "1") { threads++; expect(r[3]).toBe(i ? inorder[i - 1] : "NULL"); }
      if (r[2] === "1") { threads++; expect(r[4]).toBe(i < inorder.length - 1 ? inorder[i + 1] : "NULL"); }
    });
    expect(threads).toBe(7);
    expect(lastKv(mode("thread", 1))["访问序列"]).toBe("D B A E C F");
  });

  it("树与二叉树：先根 = 先序，后根 = 中序；森林根链 3 棵树", () => {
    const kv = lastKv(mode("forest", 2));
    expect(kv["树的先根"]).toBe(kv["二叉树先序"]);
    expect(kv["树的后根"]).toBe(kv["二叉树中序"]);
    expect(kv["树的先根"]).toBe("A B E F C D G");
    expect(kv["树的后根"]).toBe("E F B C G D A");
    expect(lastKv(mode("forest", 1))["森林中树的棵数"]).toBe("3");
    /* 转换结束后二叉树的每个结点都已填好 */
    const t = mode("forest", 0);
    for (const k of "ABCDEFG") expect(finalSet(t, "b" + k).t).toBe(k);
  });

  it("堆：建堆、插入、删除后都是小根堆，比较次数按约定累计", () => {
    /* 示例一：10 个关键字，i = 5、4、3 各下沉一层，i = 2 下沉两层，i = 1 下沉三层；比较 1 + 2 + 2 + 4 + 6 = 15 次 */
    const b = DS.buildHeap([57, 23, 91, 14, 68, 35, 82, 40, 9, 76]);
    expect(b.heap).toEqual([9, 14, 35, 23, 68, 91, 82, 40, 57, 76]);
    expect(b.cmp).toBe(15);
    const build = mode("heapop", 0);
    expect(segVals(build, "ARR").map(Number)).toEqual(b.heap);
    expect(lastKv(build)["比较次数"]).toBe("15");
    const ins = segVals(mode("heapop", 1), "ARR").map(Number);
    expect(ins).toEqual([9, 13, 35, 23, 14, 91, 82, 40, 57, 76, 68]);
    expect(lastKv(mode("heapop", 1))["比较次数"]).toBe("3");
    expect(DS.isMinHeap(ins)).toBe(true);
    const del = segVals(mode("heapop", 2), "ARR").filter((v) => v && v.trim()).map(Number);
    expect(del).toEqual([14, 23, 35, 40, 68, 91, 82, 76, 57]);
    expect(lastKv(mode("heapop", 2))["比较次数"]).toBe("6");
    expect(DS.isMinHeap(del)).toBe(true);
    for (let t = 0; t < 30; t++) {
      const a = Array.from({ length: 2 + (t % 9) }, (_, i) => (i * 37 + t * 11) % 50);
      expect(DS.isMinHeap(DS.buildHeap(a).heap)).toBe(true);
    }
    expect(() => mode("heapop", 0, { heap: "1 x 3" })).toThrow();
  });

  it("红黑树：每次插入调整完成后满足红黑性质；最终树与手算一致；覆盖全部情况", () => {
    const s = mode("rbtree", 0);
    const done = s.steps.filter((st) => st.rb);
    expect(done.length).toBe(9);
    for (const st of done) expect(rbOk(st.rb!), st.t).toBe(true);
    const fin = DS.rbInsert([20, 10, 5, 30, 40, 57, 3, 2]).slots;
    expect(fin).toEqual({ 1: [10, "B"], 2: [3, "B"], 3: [30, "R"], 4: [2, "R"], 5: [5, "R"], 6: [20, "B"], 7: [40, "B"], 15: [57, "R"] });
    expect(lastKv(s)["黑高"]).toBe("2");
    /* 画面上的最终状态（结点文字与颜色）与算法结果一致 */
    for (const [i, n] of Object.entries(fin)) {
      const f = finalSet(s, "s" + i);
      expect([f.t, f.v]).toEqual([String(n[0]), n[1] === "R" ? "红" : "黑"]);
    }
    const titles = s.steps.map((st) => st.t).join("\n") + "\n" + mode("rbtree", 1).steps.map((st) => st.t).join("\n");
    for (const c of ["根结点染黑", "为黑：插入结束", "父红叔红", "LL 型", "RR 型", "LR 型", "RL 型"]) expect(titles).toContain(c);
    for (const st of mode("rbtree", 1).steps.filter((x) => x.rb)) expect(rbOk(st.rb!), st.t).toBe(true);
    /* 任意插入序列也满足性质 */
    for (let t = 0; t < 40; t++) {
      const keys = Array.from(new Set(Array.from({ length: 10 }, (_, i) => (i * 29 + t * 13) % 97)));
      expect(rbOk(DS.rbInsert(keys).slots)).toBe(true);
    }
    expect(() => mode("rbtree", 0, { rb: "5 5" })).toThrow();
  });

  it("败者树：冠军是叶子中的最小值，输出序列递增", () => {
    const leaves = [17, 8, 26, 14, 11];
    const L = DS.loser(leaves);
    expect(leaves[L.champion]).toBe(Math.min(...leaves));
    const s = mode("extsort", 1);
    const first = s.steps.find((st) => st.kv?.["冠军"])!;
    expect(Number(first.kv!["冠军"])).toBe(Math.min(...leaves));
    const out = lastKv(s)["已输出"]!.split(" ").map(Number);
    expect(out).toEqual([8, 11, 14, 17]);
    for (let t = 0; t < 20; t++) {
      const v = Array.from({ length: 5 }, (_, i) => (i * 31 + t * 7) % 50);
      expect(v[DS.loser(v).champion]).toBe(Math.min(...v));
    }
  });

  it("置换—选择排序：默认输入（11 个记录，WA = 3）得到三个初始归并段", () => {
    expect(DS.replSel([36, 15, 48, 21, 9, 40, 27, 12, 33, 6, 45], 3).runs).toEqual([[15, 21, 36, 40, 48], [9, 12, 27, 33, 45], [6]]);
    expect(lastKv(mode("extsort", 0))["各段长度"]).toBe("5、5、1");
    for (let t = 0; t < 20; t++) {
      const d = Array.from({ length: 12 }, (_, i) => (i * 17 + t * 5) % 40);
      const runs = DS.replSel(d, 3).runs;
      expect(runs.flat().sort((a, b) => a - b)).toEqual(d.slice().sort((a, b) => a - b));
      for (const r of runs) expect(r).toEqual(r.slice().sort((a, b) => a - b));
    }
  });

  it("最佳归并树：虚段个数 (k−1) − (n−1) % (k−1)（余数非 0 时），读写次数 = 2 × WPL", () => {
    expect(DS.dummy(8, 3)).toBe(1);
    expect(DS.dummy(9, 3)).toBe(0);
    expect(DS.dummy(8, 4)).toBe(2);
    for (let k = 2; k <= 5; k++) {
      for (let n = 2; n <= 20; n++) {
        const r = (n - 1) % (k - 1), d = DS.dummy(n, k);
        expect(d).toBe(r === 0 ? 0 : (k - 1) - r);
        expect((n + d - 1) % (k - 1)).toBe(0);
      }
    }
    const T = DS.bestTree([4, 7, 10, 13, 15, 20, 26, 31], 3);
    expect([T.dummy, T.wpl, T.io]).toEqual([1, 232, 464]);
    const kv = lastKv(mode("extsort", 2));
    expect([kv["虚段数"], kv.WPL, kv["读写次数"]]).toEqual(["1", "232", "464"]);
    expect(lastKv(mode("extsort", 2, { bl: "5 11 8 22 14 3 19 27 9", bk: "3" }))["虚段数"]).toBe("0");
    expect(DS.bestTree([5, 11, 8, 22, 14, 3, 19, 27, 9], 3).wpl).toBe(225);
    expect(lastKv(mode("extsort", 2, { bl: "5 8 12 3 20 7 15 10", bk: "4" }))["虚段数"]).toBe("2");
  });
});
