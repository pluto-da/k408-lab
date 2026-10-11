import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";
import { describe, expect, it } from "vitest";

/** 性质与公式 · 数据结构（24-prop-ds.js）：注册内容、纯计算函数、链接校验，并在 jsdom 里挂载每个验证动画 */
type Nodes = { l: number; r: number; p: number; k?: number }[];
interface Graph { n: number; directed: boolean; edges: [number, number][] }
interface DSU {
  rng(seed: number): () => number;
  ceilLog2(x: number): number;
  randomBinaryTree(n: number, rnd?: () => number): Nodes;
  addRandomNode(nodes: Nodes, rnd?: () => number): number;
  binaryCounts(nodes: Nodes): { n: number; n0: number; n1: number; n2: number; branches: number; nullPtr: number };
  treeHeight(nodes: Nodes, root?: number): number;
  levelMax(i: number): number;
  heightMax(h: number): number;
  completeHeight(n: number): number;
  completeInfo(n: number): { h: number; h2: number; leaves: number; lastInternal: number; n1: number };
  completeRel(n: number, i: number): { parent: number | null; left: number | null; right: number | null };
  nullPointers(n: number): { total: number; nonNull: number; nul: number };
  catalan(n: number): number;
  isStackSeq(seq: number[]): boolean;
  stackSeqs(n: number): number[][];
  parseSeq(s: string, n: number): { seq?: number[]; err?: string };
  randomForest(n: number, k: number, m: number, rnd?: () => number): { p: number; ch: number[] }[];
  forestCounts(nodes: { p: number; ch: number[] }[]): { n: number; k: number; edges: number; degSum: number; n0: number; rhs: number };
  huffman(w: number[], m?: number): { total: number; wpl: number; n1: number; dummy: number; n: number };
  huffmanDummy(n: number, m: number): number;
  parseWeights(s: string): { w?: number[]; err?: string };
  randomGraph(n: number, e: number, directed: boolean, rnd?: () => number): Graph;
  degreeSum(g: Graph): { sum: number; inSum: number; outSum: number; e: number; deg: number[] };
  edgeBounds(n: number): { complete: number; dcomplete: number; minConnected: number; maxDisconnected: number; guarantee: number; strongMin: number };
  isConnected(n: number, edges: [number, number][]): boolean;
  worstGraph(n: number, e: number): [number, number][];
  avlMin(h: number): number;
  avlMinTree(h: number): Nodes;
  balanceFactors(nodes: Nodes): number[];
  btreeKeys(m: number): { rootMin: number; min: number; max: number };
  btreeLevelKeys(m: number, h: number): { min: number; max: number };
  btreeHeight(m: number, n: number): { hMin: number; hMax: number; fail: number };
  rbInsertAll(keys: number[]): { nodes: unknown[]; root: number };
  rbStats(t: { nodes: unknown[]; root: number }): { n: number; h: number; bh: number; shortest: number; longest: number; bound: number; minInternal: number; valid: boolean };
  bsearchHeight(n: number): number;
  bsearchMaxCmp(n: number): { succ: number; fail: number };
  buildHeapCmp(a: number[]): { heap: number[]; cmp: number };
  log2Fact(n: number): number;
  sortWorstCmp(n: number, alg: string): number;
  SORTS: { name: string; stable: boolean }[];
}
interface Prop {
  id: string; sub: string; ch: string; name: string; def: string; stmt: string[]; cond: string; proof: string[]; traps: string[];
  ex: { q: string; opts: string[]; a: number; why: string; src: string };
  links: { lab: string[]; proc: string[] };
  demo: (box: HTMLElement) => { destroy: () => void };
}

const DIR = resolve(__dirname, "../../public/legacy/js");

function load(): { PROP: Prop[]; DS: DSU } {
  const win: Record<string, unknown> = { __LEGACY_LOADER__: true, addEventListener: () => undefined };
  const ctx: Record<string, unknown> = {
    window: win, document, setTimeout, clearTimeout, Math, Number, String, parseInt, parseFloat, isNaN, isFinite, Error, Object, Array, JSON, Infinity, Boolean, RegExp,
  };
  runInNewContext(readFileSync(resolve(DIR, "24-prop-ds.js"), "utf8"), new Proxy(ctx, {
    get: (t, k) => (k in t ? t[k as string] : win[k as string]),
    has: () => true,
    set: (t, k, v) => { t[k as string] = v; win[k as string] = v; return true; },
  }));
  return { PROP: win.PROP as Prop[], DS: (win.PROPU as { ds: DSU }).ds };
}

function ids(files: string[]): Set<string> {
  const s = new Set<string>();
  for (const f of files) {
    const src = readFileSync(resolve(DIR, f), "utf8");
    for (const m of src.matchAll(/\bid:\s*"([a-z0-9]+)",\s*name:/g)) s.add(m[1]!);
  }
  return s;
}

const { PROP, DS } = load();

describe("注册", () => {
  it("14 条数据结构性质，id 唯一，字段齐全", () => {
    expect(PROP.length).toBe(14);
    expect(new Set(PROP.map((p) => p.id)).size).toBe(14);
    for (const p of PROP) {
      expect(p.sub).toBe("ds");
      expect(p.id).toMatch(/^ds-[a-z0-9-]+$/);
      expect(p.ch).toMatch(/^第 \d+ 章 /);
      for (const k of ["name", "def", "cond"] as const) expect(p[k].length).toBeGreaterThan(4);
      expect(p.stmt.length).toBeGreaterThanOrEqual(1);
      expect(p.proof.length).toBeGreaterThanOrEqual(3);
      expect(p.proof.length).toBeLessThanOrEqual(8);
      expect(p.traps.length).toBeGreaterThanOrEqual(2);
      expect(p.traps.length).toBeLessThanOrEqual(3);
      expect(p.ex.opts.length).toBe(4);
      expect(Number.isInteger(p.ex.a) && p.ex.a >= 0 && p.ex.a <= 3).toBe(true);
      expect(new Set(p.ex.opts).size).toBe(4);
      expect(p.ex.q.length).toBeGreaterThan(8);
      expect(p.ex.why.length).toBeGreaterThan(8);
      expect(p.ex.src).toMatch(/^(20\d\d 年真题|典型题)$/);
      expect(typeof p.demo).toBe("function");
      for (const s of [p.name, p.def, p.cond, ...p.stmt, ...p.proof, ...p.traps, p.ex.q, p.ex.why]) expect(s).not.toMatch(/<\/?(b|i|br|p|div|span|em|strong|sub|sup|a)\b[^>]*>/i);
    }
  });
  it("相关链接都指向真实存在的实验与图解", () => {
    const labs = ids(["08-lab.js", "15-lab-cn.js", "16-lab-coos.js", "19-lab-ds1.js", "20-lab-ds2.js", "21-lab-ds3.js"]);
    const procs = ids(["12-proc-circuit.js", "13-proc-co.js", "14-proc-os.js", "17-proc-cn.js", "18-proc-coos.js", "22-proc-ds.js"]);
    expect(labs.has("bst") && procs.has("rbtree")).toBe(true);
    for (const p of PROP) {
      for (const l of p.links.lab) expect(labs.has(l), `${p.id} → lab ${l}`).toBe(true);
      for (const l of p.links.proc) expect(procs.has(l), `${p.id} → proc ${l}`).toBe(true);
      expect(p.links.lab.length + p.links.proc.length).toBeGreaterThan(0);
    }
  });
  it("例题答案与公式一致（抽查）", () => {
    const by = (id: string) => PROP.find((p) => p.id === id)!;
    const ans = (id: string) => by(id).ex.opts[by(id).ex.a];
    expect(ans("ds-catalan")).toBe(String(DS.catalan(4)));
    expect(ans("ds-avlmin")).toBe(String(DS.avlMin(6)));
    expect(ans("ds-huffman")).toBe(String((115 + 1) / 2));
    expect(ans("ds-connect")).toBe(String(DS.edgeBounds(7).guarantee));
    expect(ans("ds-btree")).toBe(String(DS.btreeLevelKeys(5, 2).min));
    expect(ans("ds-bsearch")).toBe(String(DS.bsearchMaxCmp(16).fail));
    expect(ans("ds-sortbound")).toBe(String(DS.log2Fact(5)));
    expect(ans("ds-forest")).toBe("10");
  });
});

describe("纯函数 · 七.2 关键数值", () => {
  it("卡特兰数 5、14、42，并与枚举一致", () => {
    expect([3, 4, 5].map(DS.catalan)).toEqual([5, 14, 42]);
    expect([0, 1, 2, 6].map(DS.catalan)).toEqual([1, 1, 2, 132]);
    for (let n = 1; n <= 6; n++) expect(DS.stackSeqs(n).length).toBe(DS.catalan(n));
    expect(DS.isStackSeq([3, 1, 2])).toBe(false);
    expect(DS.isStackSeq([3, 2, 4, 1])).toBe(true);
    expect(DS.parseSeq("1 2", 3).err).toContain("3 个数");
    expect(DS.parseSeq("1 1 2", 3).err).toContain("两次");
    expect(DS.parseSeq("1，3，2", 3).seq).toEqual([1, 3, 2]);
  });
  it("AVL 最少结点 N(4) = 7、N(5) = 12，最瘦树形与递推一致", () => {
    expect(DS.avlMin(4)).toBe(7);
    expect(DS.avlMin(5)).toBe(12);
    expect([0, 1, 2, 3, 6, 7].map(DS.avlMin)).toEqual([0, 1, 2, 4, 20, 33]);
    for (let h = 1; h <= 7; h++) {
      const t = DS.avlMinTree(h);
      expect(t.length).toBe(DS.avlMin(h));
      expect(DS.treeHeight(t)).toBe(h);
      expect(DS.balanceFactors(t).every((b) => b === 0 || b === 1)).toBe(true);
    }
  });
  it("结点数上界、完全二叉树、空指针", () => {
    expect(DS.levelMax(5)).toBe(16);
    expect(DS.heightMax(5)).toBe(31);
    expect(DS.completeHeight(8)).toBe(4);
    expect(DS.completeHeight(7)).toBe(3);
    expect(DS.completeInfo(768).leaves).toBe(384);
    for (let n = 1; n <= 200; n++) { const c = DS.completeInfo(n); expect(c.h).toBe(c.h2); expect(c.leaves + c.lastInternal).toBe(n); }
    expect(DS.completeRel(12, 6)).toEqual({ parent: 3, left: 12, right: null });
    expect(DS.nullPointers(10)).toEqual({ total: 20, nonNull: 9, nul: 11 });
  });
  it("哈夫曼树与虚结点", () => {
    const h = DS.huffman([2, 3, 5, 7, 11, 13]);
    expect(h.total).toBe(11);
    expect(h.n1).toBe(0);
    expect(DS.huffman([1, 2, 3, 4]).wpl).toBe(19);
    expect(DS.huffmanDummy(8, 3)).toBe(1);
    expect(DS.huffmanDummy(9, 3)).toBe(0);
    expect(DS.huffmanDummy(6, 4)).toBe(1);
    expect(DS.huffman([1, 2, 3, 4, 5, 6, 7, 8], 3).dummy).toBe(1);
    expect(DS.parseWeights("1").err).toBeTruthy();
    expect(DS.parseWeights("1 a").err).toContain("a");
  });
  it("图的边数界与最坏放法", () => {
    expect(DS.edgeBounds(7)).toMatchObject({ complete: 21, dcomplete: 42, minConnected: 6, maxDisconnected: 15, guarantee: 16, strongMin: 7 });
    for (let n = 3; n <= 8; n++) {
      const b = DS.edgeBounds(n);
      expect(DS.isConnected(n, DS.worstGraph(n, b.maxDisconnected))).toBe(false);
      expect(DS.isConnected(n, DS.worstGraph(n, b.guarantee))).toBe(true);
    }
  });
  it("B 树关键字范围与高度", () => {
    expect(DS.btreeKeys(5)).toMatchObject({ rootMin: 1, min: 2, max: 4 });
    expect(DS.btreeLevelKeys(5, 2).min).toBe(5);
    expect(DS.btreeLevelKeys(3, 3)).toEqual({ min: 7, max: 26 });
    expect(DS.btreeHeight(5, 5)).toMatchObject({ hMin: 2, hMax: 2, fail: 6 });
    expect(DS.btreeHeight(3, 26)).toMatchObject({ hMin: 3, hMax: 4 });
  });
  it("红黑树：随机插入后满足性质与高度上界", () => {
    const rnd = DS.rng(7);
    for (let t = 0; t < 60; t++) {
      const n = 1 + Math.floor(rnd() * 40), keys: number[] = [];
      while (keys.length < n) { const k = 1 + Math.floor(rnd() * 200); if (!keys.includes(k)) keys.push(k); }
      const s = DS.rbStats(DS.rbInsertAll(keys));
      expect(s.valid).toBe(true);
      expect(s.n).toBe(n);
      expect(s.h).toBeLessThanOrEqual(s.bound + 1e-9);
      expect(s.longest).toBeLessThanOrEqual(2 * s.shortest);
      expect(s.n).toBeGreaterThanOrEqual(s.minInternal);
    }
    const seq = DS.rbStats(DS.rbInsertAll(Array.from({ length: 20 }, (_, i) => i + 1)));
    expect(seq.valid).toBe(true);
  });
  it("折半查找判定树、建堆、比较排序下界", () => {
    expect(DS.bsearchHeight(16)).toBe(5);
    for (let n = 1; n <= 64; n++) { const m = DS.bsearchMaxCmp(n); expect(m.succ).toBe(DS.bsearchHeight(n)); expect(m.fail).toBe(DS.bsearchHeight(n)); }
    const rnd = DS.rng(3);
    for (let t = 0; t < 50; t++) {
      const a = Array.from({ length: 1 + Math.floor(rnd() * 60) }, () => Math.floor(rnd() * 100));
      const r = DS.buildHeapCmp(a);
      expect(r.cmp).toBeLessThanOrEqual(4 * a.length);
      for (let i = 1; i < r.heap.length; i++) expect(r.heap[Math.floor((i - 1) / 2)]!).toBeGreaterThanOrEqual(r.heap[i]!);
    }
    expect([1, 2, 3, 4, 5, 6].map(DS.log2Fact)).toEqual([0, 1, 3, 5, 7, 10]);
    for (let n = 2; n <= 6; n++) for (const alg of ["insert", "binsert", "merge", "select"]) expect(DS.sortWorstCmp(n, alg)).toBeGreaterThanOrEqual(DS.log2Fact(n));
    expect(DS.SORTS.length).toBe(10);
    expect(DS.SORTS.filter((s) => !s.stable).map((s) => s.name)).toEqual(["希尔排序", "快速排序", "简单选择排序", "堆排序"]);
  });
});

describe("等式型性质 · 100 次随机验证", () => {
  it("随机二叉树 n₀ = n₂ + 1，空指针 = n + 1", () => {
    const rnd = DS.rng(2024);
    for (let t = 0; t < 100; t++) {
      const n = 1 + Math.floor(rnd() * 60);
      const c = DS.binaryCounts(DS.randomBinaryTree(n, rnd));
      expect(c.n).toBe(n);
      expect(c.n0).toBe(c.n2 + 1);
      expect(c.branches).toBe(n - 1);
      expect(c.nullPtr).toBe(DS.nullPointers(n).nul);
    }
  });
  it("随机图度之和 = 2e，有向图入度和 = 出度和 = e", () => {
    const rnd = DS.rng(408);
    for (let t = 0; t < 100; t++) {
      const n = 2 + Math.floor(rnd() * 9), dir = t % 2 === 1;
      const max = dir ? n * (n - 1) : (n * (n - 1)) / 2;
      const s = DS.degreeSum(DS.randomGraph(n, Math.floor(rnd() * (max + 1)), dir, rnd));
      expect(s.sum).toBe(2 * s.e);
      expect(s.inSum).toBe(s.e);
      expect(s.outSum).toBe(s.e);
      expect(s.deg.filter((d) => d % 2).length % 2).toBe(0);
    }
  });
  it("随机森林边数 = n − k，n₀ = k + Σ(i−1)nᵢ", () => {
    const rnd = DS.rng(99);
    for (let t = 0; t < 100; t++) {
      const n = 1 + Math.floor(rnd() * 30), k = 1 + Math.floor(rnd() * Math.min(n, 5)), m = 2 + Math.floor(rnd() * 3);
      const c = DS.forestCounts(DS.randomForest(n, k, m, rnd));
      expect(c.edges).toBe(n - k);
      expect(c.degSum).toBe(c.edges);
      expect(c.n0).toBe(c.rhs);
    }
  });
  it("随机权值哈夫曼树结点数 = 2n − 1", () => {
    const rnd = DS.rng(5);
    for (let t = 0; t < 100; t++) {
      const w = Array.from({ length: 2 + Math.floor(rnd() * 9) }, () => 1 + Math.floor(rnd() * 50));
      const h = DS.huffman(w);
      expect(h.total).toBe(2 * w.length - 1);
      expect(h.n1).toBe(0);
    }
  });
});

describe("验证动画在 jsdom 中挂载", () => {
  for (const p of PROP) {
    it(`${p.id} 挂载、点击全部按钮、改输入、销毁`, () => {
      const box = document.createElement("div");
      document.body.appendChild(box);
      const errs: unknown[] = [];
      const onErr = (e: ErrorEvent) => errs.push(e.error);
      window.addEventListener("error", onErr);
      const d = p.demo(box);
      expect(typeof d.destroy).toBe("function");
      const svg = box.querySelector("svg");
      expect(svg).not.toBeNull();
      const vb = svg!.getAttribute("viewBox")!.split(" ").map(Number);
      expect(vb[2]).toBeLessThanOrEqual(720);
      expect(box.querySelector(".x-pd__out")!.textContent!.length).toBeGreaterThan(0);
      const buttons = Array.from(box.querySelectorAll("button"));
      expect(buttons.length).toBeGreaterThan(0);
      for (let round = 0; round < 2; round++) for (const b of buttons) if (b.isConnected && !b.disabled) b.click();
      for (const r of Array.from(box.querySelectorAll<HTMLInputElement>('input[type="range"]'))) {
        for (const v of [r.min, r.max, String(Math.round((Number(r.min) + Number(r.max)) / 2))]) { r.value = v; r.dispatchEvent(new Event("input")); }
      }
      for (const n of Array.from(box.querySelectorAll<SVGGElement>('[role="button"]')).slice(0, 3)) n.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      /* 非法输入给出中文提示，不抛异常 */
      const txt = Array.from(box.querySelectorAll<HTMLInputElement>('input[type="text"]'));
      if (txt.length) {
        for (const t of txt) t.value = "abc";
        box.querySelector<HTMLButtonElement>(".x-lab__btn--main")!.click();
        const err = box.querySelector(".x-pd__err");
        expect(err, `${p.id} 应显示错误提示`).not.toBeNull();
        expect(err!.textContent).toMatch(/[\u4e00-\u9fa5]/);
      }
      for (const t of Array.from(box.querySelectorAll("text"))) expect(t.textContent).not.toMatch(/NaN|undefined|Infinity/);
      expect(box.textContent).not.toMatch(/NaN|undefined/);
      expect(box.querySelector(".x-pd__eq.is-bad"), `${p.id} 有不成立的等式`).toBeNull();
      d.destroy();
      expect(box.children.length).toBe(0);
      window.removeEventListener("error", onErr);
      expect(errs).toEqual([]);
      box.remove();
    });
  }
  it("每个验证动画在随机参数下等式都成立（各 20 次）", () => {
    for (const p of PROP) {
      const box = document.createElement("div");
      const d = p.demo(box);
      for (let t = 0; t < 20; t++) {
        const r = Array.from(box.querySelectorAll<HTMLInputElement>('input[type="range"]'));
        for (const x of r) { x.value = String(Number(x.min) + Math.floor(Math.random() * (Number(x.max) - Number(x.min) + 1))); x.dispatchEvent(new Event("input")); }
        const main = box.querySelector<HTMLButtonElement>(".x-lab__btn--main");
        if (main && !main.disabled) main.click();
        expect(box.querySelector(".x-pd__eq.is-bad"), `${p.id} 第 ${t} 次`).toBeNull();
      }
      d.destroy();
    }
  });
});
