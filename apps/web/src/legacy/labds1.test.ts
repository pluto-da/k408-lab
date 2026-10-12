import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";
import { describe, expect, it } from "vitest";

/** 在最小沙箱里执行数据结构实验脚本（一），测 window.LABU 上的纯计算函数，并在 jsdom 中挂载每个实验走到最后一帧 */
interface Err { err?: string }
interface BNode { id: number; keys: number[]; ch: BNode[] }
interface TNode { k: number; l: TNode | null; r: TNode | null }
interface UfState { n: number; p: number[]; rk: number[] }
interface CqState { N: number; q: (string | null)[]; front: number; rear: number; size: number; tag: number }
interface LabU {
  dsInfix(s: string): Err & { postfix: string; maxDepth: number; maxOps: number; numeric: boolean; value?: number; steps: unknown[] };
  dsKmpNext(p: string): { next: number[] };
  dsKmpNextval(p: string, next?: number[]): number[];
  dsKmpMatch(s: string, p: string, arr: number[]): { pos: number; cmp: number };
  dsNaiveMatch(s: string, p: string): { pos: number; cmp: number };
  dsHuffman(items: string | { ch: string; w: number }[]): Err & { wpl: number; total: number; innerSum: number; codes: { code: string; len: number; w: number }[] };
  dsAvlInsert(root: TNode | null, k: number): { root: TNode; rot: string | null; dup?: boolean };
  dsBstInsert(root: TNode | null, k: number): { root: TNode };
  dsBstDelete(root: TNode | null, k: number, pred?: boolean): { root: TNode | null; found: boolean; kind?: string };
  dsBstFrames(keys: number[], opt: { avl?: boolean; dels?: number[]; pred?: boolean }): { frames: { d: string }[]; root: TNode | null; rots: string[]; asl: { sum: number; n: number } };
  dsInorder(n: TNode | null): number[];
  dsHeight(n: TNode | null): number;
  dsBf(n: TNode): number;
  dsBtree(m: number, keys: number[], dels?: number[]): Err & { frames: { d: string }[]; root: BNode | null; check: { ok: boolean; height?: number; count?: number; msg?: string } };
  dsBtreeInsert(root: BNode | null, k: number, m: number): BNode;
  dsBtreeDelete(root: BNode | null, k: number, m: number): BNode | null;
  dsBtreeCheck(root: BNode | null, m: number): { ok: boolean; height?: number; count?: number; msg?: string };
  dsBtreeKeys(root: BNode | null): number[];
  dsParseKeys(s: string, opt?: Record<string, unknown>): Err & { keys?: number[] };
  dsUfInit(n: number): UfState;
  dsUnion(st: UfState, a: number, b: number, mode: string, compress?: boolean): { same: boolean };
  dsFind(st: UfState, x: number, compress?: boolean): { root: number; path: number[] };
  dsUfHeight(st: UfState): number;
  dsUfParse(s: string, n: number): Err & { ops?: (string | number)[][] };
  dsUfRun(n: number, ops: unknown[], mode: string, compress: boolean): Err & { height: number; frames: unknown[] };
  dsCqRun(N: number, sc: string, ops: string[][]): Err & { frames: { ok: boolean; d: string }[]; s: CqState };
  dsCqLen(s: CqState, sc: string): number;
  CQ_DEF: string[][];
}
interface Demo { step(): boolean; reset(): void; done(): boolean }
interface KObj { opts: HTMLElement; stage: HTMLElement; out: HTMLElement; restart: () => void }
interface Lab { id: string; name: string; color: string; note: string; mount: (panel: HTMLElement, K: KObj) => Demo }

const SRC = readFileSync(resolve(__dirname, "../../legacy-src/js/19-lab-ds1.js"), "utf8");

function load(withDom: boolean) {
  const win: Record<string, unknown> = { LAB: [] };
  const ctx: Record<string, unknown> = { window: win, Error, Object, Array, JSON, Math, Number, String, parseInt, parseFloat, isNaN, isFinite };
  if (withDom) {
    const NS = "http://www.w3.org/2000/svg";
    win.X = {
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
    ctx.document = document;
  } else win.X = { reduced: true };
  ctx.X = win.X;
  runInNewContext(SRC, new Proxy(ctx, {
    get: (t, k) => (k in t ? t[k as string] : win[k as string]),
    has: () => true,
    set: (t, k, v) => { t[k as string] = v; win[k as string] = v; return true; },
  }));
  return { U: win.LABU as LabU, LAB: win.LAB as Lab[] };
}

const { U, LAB } = load(false);

/** 可复现的伪随机数 */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}
function shuffled(n: number, r: () => number, max = 999): number[] {
  const pool: number[] = [];
  for (let i = 1; i <= max; i++) pool.push(i);
  for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); const t = pool[i]!; pool[i] = pool[j]!; pool[j] = t; }
  return pool.slice(0, n);
}
function avlOk(n: TNode | null): boolean {
  if (!n) return true;
  return Math.abs(U.dsBf(n)) <= 1 && avlOk(n.l) && avlOk(n.r);
}

describe("实验注册", () => {
  it("注册 7 个数据结构实验", () => {
    expect(LAB.map((l) => l.id)).toEqual(["infix", "cqueue", "kmp", "huffman", "bst", "btree", "ufset"]);
    for (const l of LAB) {
      expect(l.color).toBe("var(--x-ds)");
      expect(l.note.length).toBeGreaterThan(40);
      expect(typeof l.mount).toBe("function");
    }
  });
});

describe("中缀转后缀与求值", () => {
  it("a*(b-c)+d/e-f → abc-*de/+f-", () => {
    const r = U.dsInfix("a*(b-c)+d/e-f");
    expect(r.err).toBeUndefined();
    expect(r.postfix).toBe("abc-*de/+f-");
    expect(r.maxDepth).toBe(3);
    expect(r.maxOps).toBe(2);
    expect(r.numeric).toBe(false);
  });
  it("3+4*(2-1)-6/3 = 5", () => {
    const r = U.dsInfix("3+4*(2-1)-6/3");
    expect(r.postfix).toBe("3421-*+63/-");
    expect(r.value).toBe(5);
  });
  it("2012 真题：栈中最多 5 个", () => {
    const r = U.dsInfix("a+b-a*((c+d)/e-f)+g");
    expect(r.postfix).toBe("ab+acd+e/f-*-g+");
    expect(r.maxDepth).toBe(5);
  });
  it("多位数与中文括号", () => {
    expect(U.dsInfix("（15-3）/(2+2)*5").value).toBe(15);
  });
  it("非法输入给中文提示", () => {
    expect(U.dsInfix("(a+b").err).toMatch(/括号不匹配/);
    expect(U.dsInfix("a+b)").err).toMatch(/括号不匹配/);
    expect(U.dsInfix("a+").err).toMatch(/缺少操作数/);
    expect(U.dsInfix("ab").err).toMatch(/缺少运算符/);
    expect(U.dsInfix("a&b").err).toMatch(/不支持/);
    expect(U.dsInfix("").err).toBeTruthy();
  });
});

describe("循环队列", () => {
  it("牺牲一个单元：入队 5 个即满，出队两次再入队两次 rear 绕回 1，长度 5", () => {
    const r = U.dsCqRun(6, "sac", U.CQ_DEF);
    expect(r.frames.map((f) => f.ok)).toEqual([true, true, true, true, true, true, false, true, true, true, true]);
    expect(r.s.front).toBe(2);
    expect(r.s.rear).toBe(1);
    expect(U.dsCqLen(r.s, "sac")).toBe(5);
  });
  it("size / tag 方案能存满 MaxSize 个", () => {
    for (const sc of ["size", "tag"]) {
      const r = U.dsCqRun(6, sc, U.CQ_DEF);
      expect(r.frames.every((f) => f.ok)).toBe(true);
      expect(U.dsCqLen(r.s, sc)).toBe(6);
    }
    expect(U.dsCqRun(6, "tag", [["D"]]).frames[1]!.ok).toBe(false);
    expect(U.dsCqRun(2, "sac", []).err).toBeTruthy();
  });
});

describe("KMP", () => {
  it("abaabc：next = 0 1 1 2 2 3，nextval = 0 1 0 2 1 3", () => {
    const n = U.dsKmpNext("abaabc").next;
    expect(n).toEqual([0, 1, 1, 2, 2, 3]);
    expect(U.dsKmpNextval("abaabc", n)).toEqual([0, 1, 0, 2, 1, 3]);
  });
  it("示例 next / nextval", () => {
    expect(U.dsKmpNext("abaabcabab").next).toEqual([0, 1, 1, 2, 2, 3, 1, 2, 3, 4]);
    expect(U.dsKmpNextval("abaabcabab")).toEqual([0, 1, 0, 2, 1, 3, 0, 1, 0, 4]);
    expect(U.dsKmpMatch("abaababaabcababc", "abaabcabab", U.dsKmpNext("abaabcabab").next).pos).toBe(6);
    expect(U.dsKmpNextval("aabaab")).toEqual([0, 0, 2, 0, 0, 2]);
  });
  it("2019 真题：比较 10 次，位置 10；朴素匹配更多", () => {
    const s = "abaabaabcabaabc", p = "abaabc";
    const k = U.dsKmpMatch(s, p, U.dsKmpNext(p).next);
    expect(k.cmp).toBe(10);
    expect(k.pos).toBe(4);
    const nv = U.dsKmpMatch(s, p, U.dsKmpNextval(p));
    expect(nv.pos).toBe(4);
    const nb = U.dsNaiveMatch(s, p);
    expect(nb.pos).toBe(4);
    expect(nb.cmp).toBeGreaterThan(k.cmp);
    expect(U.dsKmpMatch("aaaa", "ab", U.dsKmpNext("ab").next).pos).toBe(0);
  });
  it("随机串：KMP / nextval / 朴素找到同一位置", () => {
    const r = rng(7);
    for (let t = 0; t < 200; t++) {
      const s = Array.from({ length: 20 }, () => "ab"[Math.floor(r() * 2)]).join("");
      const p = Array.from({ length: 1 + Math.floor(r() * 5) }, () => "ab"[Math.floor(r() * 2)]).join("");
      const want = s.indexOf(p) + 1;
      expect(U.dsKmpMatch(s, p, U.dsKmpNext(p).next).pos).toBe(want);
      expect(U.dsKmpMatch(s, p, U.dsKmpNextval(p)).pos).toBe(want);
      expect(U.dsNaiveMatch(s, p).pos).toBe(want);
    }
  });
});

describe("哈夫曼树", () => {
  it("8 3 5 2 → WPL 33，结点 2n − 1", () => {
    const r = U.dsHuffman("8, 3, 5, 2");
    expect(r.err).toBeUndefined();
    expect(r.wpl).toBe(33);
    expect(r.total).toBe(7);
    expect(r.innerSum).toBe(33);
  });
  it("带字符写法、前缀码", () => {
    const r = U.dsHuffman("a:6 b:21 c:9 d:4 e:15 f:27 g:2 h:16");
    expect(r.wpl).toBe(270);
    expect(r.total).toBe(15);
    const codes = r.codes.map((c) => c.code);
    for (const a of codes) for (const b of codes) if (a !== b) expect(b.startsWith(a)).toBe(false);
    expect(U.dsHuffman("3 4 5 6 8 10").wpl / 36).toBe(2.5);
  });
  it("校验", () => {
    expect(U.dsHuffman("5").err).toBeTruthy();
    expect(U.dsHuffman("a:1 a:2").err).toMatch(/重复/);
    expect(U.dsHuffman("a:1 2").err).toMatch(/混用/);
    expect(U.dsHuffman(Array.from({ length: 16 }, (_, i) => String(i + 1)).join(" ")).err).toMatch(/最多 15/);
  });
});

describe("二叉排序树与 AVL", () => {
  it("3, 2, 1 → LL，根变为 2", () => {
    let root: TNode | null = null;
    let rot: string | null = null;
    for (const k of [3, 2, 1]) { const r = U.dsAvlInsert(root, k); root = r.root; rot = r.rot; }
    expect(rot).toBe("LL");
    expect(root!.k).toBe(2);
    expect(root!.r!.k).toBe(3);
  });
  it("四种旋转都能触发", () => {
    const f = U.dsBstFrames([20, 10, 5, 30, 40, 25, 23, 8, 9], { avl: true });
    expect(f.rots).toEqual(["LL", "RR", "RL", "LR"]);
    expect(avlOk(f.root)).toBe(true);
  });
  it("随机序列：每次插入后都平衡、中序有序", () => {
    const r = rng(42);
    for (let t = 0; t < 60; t++) {
      const keys = shuffled(15, r);
      let root: TNode | null = null;
      for (const k of keys) {
        root = U.dsAvlInsert(root, k).root;
        expect(avlOk(root)).toBe(true);
      }
      expect(U.dsInorder(root)).toEqual(keys.slice().sort((a, b) => a - b));
      expect(U.dsHeight(root)).toBeLessThanOrEqual(5);
    }
  });
  it("BST 三种删除后中序仍有序", () => {
    const f = U.dsBstFrames([50, 30, 70, 20, 40, 60, 80, 35, 45, 65], { dels: [20, 60, 30, 50] });
    expect(U.dsInorder(f.root)).toEqual([35, 40, 45, 65, 70, 80]);
    const r = rng(3);
    for (let t = 0; t < 40; t++) {
      const keys = shuffled(12, r, 60);
      let root: TNode | null = null;
      for (const k of keys) root = U.dsBstInsert(root, k).root;
      const left = keys.slice();
      for (const k of shuffled(6, r, 60)) {
        const d = U.dsBstDelete(root, k, t % 2 === 0);
        root = d.root;
        const i = left.indexOf(k);
        expect(d.found).toBe(i >= 0);
        if (i >= 0) left.splice(i, 1);
        expect(U.dsInorder(root)).toEqual(left.slice().sort((a, b) => a - b));
      }
    }
  });
  it("每一帧都有说明文字", () => {
    const f = U.dsBstFrames([3, 2, 1, 4, 5, 6, 7, 16, 15, 14], { avl: true });
    expect(f.frames.every((x) => x.d.length > 6)).toBe(true);
    expect(U.dsParseKeys("1 2 2").err).toMatch(/重复/);
    expect(U.dsParseKeys(Array.from({ length: 16 }, (_, i) => String(i)).join(",")).err).toMatch(/最多 15/);
  });
});

describe("B 树", () => {
  it("2020 真题：4 阶依次插入 5 6 9 13 8 2 12 15，根为 6 9", () => {
    const r = U.dsBtree(4, [5, 6, 9, 13, 8, 2, 12, 15]);
    expect(r.root!.keys).toEqual([6, 9]);
    expect(r.check.ok).toBe(true);
  });
  it("3 阶插入 10 20 30：20 上移成新根", () => {
    const r = U.dsBtree(3, [10, 20, 30]);
    expect(r.root!.keys).toEqual([20]);
    expect(r.root!.ch.map((c) => c.keys)).toEqual([[10], [30]]);
  });
  it.each([3, 4, 5])("%i 阶：随机插入删除后关键字数在界内、叶结点同层", (m) => {
    const r = rng(100 + m);
    for (let t = 0; t < 40; t++) {
      const keys = shuffled(30, r, 200);
      let root: BNode | null = null;
      for (const k of keys) {
        root = U.dsBtreeInsert(root, k, m);
        const c = U.dsBtreeCheck(root, m);
        expect(c.ok, c.msg).toBe(true);
      }
      expect(U.dsBtreeKeys(root)).toEqual(keys.slice().sort((a, b) => a - b));
      const left = keys.slice();
      for (const k of shuffled(25, r, 200)) {
        root = U.dsBtreeDelete(root, k, m);
        const i = left.indexOf(k);
        if (i >= 0) left.splice(i, 1);
        const c = U.dsBtreeCheck(root, m);
        expect(c.ok, c.msg).toBe(true);
        expect(U.dsBtreeKeys(root)).toEqual(left.slice().sort((a, b) => a - b));
      }
    }
  });
  it("删除演示覆盖借与合并", () => {
    const r = U.dsBtree(3, [42, 18, 77, 63, 95, 25, 51, 88, 9, 70], [25, 95, 42, 70]);
    const txt = r.frames.map((f) => f.d).join("\n");
    expect(txt).toMatch(/借/);
    expect(txt).toMatch(/合并/);
    expect(r.check.ok).toBe(true);
    expect(U.dsBtree(6, [1]).err).toBeTruthy();
  });
});

describe("并查集", () => {
  it("按秩合并：树高 ≤ ⌊log₂n⌋ + 1", () => {
    const r = rng(9);
    for (const n of [2, 5, 8, 15, 64]) {
      for (let t = 0; t < 30; t++) {
        for (const comp of [false, true]) {
          const st = U.dsUfInit(n);
          for (let q = 0; q < n * 2; q++) U.dsUnion(st, Math.floor(r() * n), Math.floor(r() * n), "rank", comp);
          expect(U.dsUfHeight(st)).toBeLessThanOrEqual(Math.floor(Math.log2(n)) + 1);
        }
      }
    }
  });
  it("普通合并会退化成链；路径压缩把路径挂到根下", () => {
    const st = U.dsUfInit(5);
    for (let i = 1; i < 5; i++) U.dsUnion(st, i, i - 1, "plain");
    expect(U.dsUfHeight(st)).toBe(5);
    expect(st.p[4]).toBe(-5);
    const f = U.dsFind(st, 0, true);
    expect(f.root).toBe(4);
    expect(f.path).toEqual([0, 1, 2, 3, 4]);
    expect(U.dsUfHeight(st)).toBe(2);
  });
  it("操作解析与校验", () => {
    expect(U.dsUfParse("Union(1,2) Find(3) U 0 1 F 2", 8).ops).toEqual([["U", 1, 2], ["F", 3], ["U", 0, 1], ["F", 2]]);
    expect(U.dsUfParse("U 1 9", 8).err).toMatch(/超出范围/);
    expect(U.dsUfParse("X 1", 8).err).toMatch(/无法识别/);
    expect(U.dsUfRun(16, [], "plain", false).err).toBeTruthy();
  });
});

describe("jsdom 挂载冒烟测试", () => {
  const dom = load(true);
  for (const lab of dom.LAB) {
    it(lab.id + "：默认数据播放到底，所有选项与预设也能走完", () => {
      const panel = document.createElement("div");
      panel.innerHTML = '<div class="x-lab__opts"></div><div class="x-lab__stage"></div><div class="x-lab__out"></div>';
      document.body.appendChild(panel);
      const q = (s: string) => panel.querySelector(s) as HTMLElement;
      let demo: Demo | null = null;
      const K: KObj = { opts: q(".x-lab__opts"), stage: q(".x-lab__stage"), out: q(".x-lab__out"), restart: () => { demo?.reset(); } };
      demo = lab.mount(panel, K);
      const errText = () => panel.querySelector(".x-lab__err")?.textContent ?? "";
      const runToEnd = () => {
        let n = 0;
        while (demo!.step()) { n++; if (n > 2000) throw new Error("帧数过多"); }
        expect(demo!.done()).toBe(true);
        return n;
      };
      expect(errText()).toBe("");
      expect(runToEnd()).toBeGreaterThan(3);
      expect(errText()).toBe("");
      const svg = K.stage.querySelector("svg");
      expect(svg).not.toBeNull();
      const vb = (svg!.getAttribute("viewBox") ?? "").split(" ").map(Number);
      expect(vb[2]).toBeLessThanOrEqual(720);
      for (const c of Array.from(K.stage.querySelectorAll("circle"))) expect(Number(c.getAttribute("r"))).toBeGreaterThanOrEqual(16);
      for (const t of Array.from(K.stage.querySelectorAll("text[font-size]"))) expect(Number(t.getAttribute("font-size"))).toBeGreaterThanOrEqual(13);
      expect((panel.querySelector(".x-d1-say")?.textContent ?? "").length).toBeGreaterThan(4);
      const buttons = Array.from(K.opts.querySelectorAll("button"));
      for (const b of buttons) {
        if (b.textContent === "清空重来") continue;
        b.click();
        demo.reset();
        expect(errText(), lab.id + " / " + (b.textContent ?? "")).toBe("");
        runToEnd();
        expect(errText(), lab.id + " / " + (b.textContent ?? "")).toBe("");
      }
      /* 非法输入：显示中文错误而不是抛出异常 */
      const inp = K.opts.querySelector("input.x-lab__in") as HTMLInputElement | null;
      if (inp) {
        inp.value = lab.id === "cqueue" ? "99" : lab.id === "ufset" ? "99" : "(((";
        inp.dispatchEvent(new Event("change"));
        expect(errText()).not.toBe("");
        expect(demo.step()).toBe(false);
      }
      panel.remove();
    });
  }
  it("循环队列：入队 / 出队按钮从当前步接着操作", () => {
    const lab = dom.LAB.find((l) => l.id === "cqueue")!;
    const panel = document.createElement("div");
    panel.innerHTML = '<div class="x-lab__opts"></div><div class="x-lab__stage"></div><div class="x-lab__out"></div>';
    const q = (s: string) => panel.querySelector(s) as HTMLElement;
    let demo: Demo | null = null;
    const K: KObj = { opts: q(".x-lab__opts"), stage: q(".x-lab__stage"), out: q(".x-lab__out"), restart: () => { demo?.reset(); } };
    demo = lab.mount(panel, K);
    const btn = (t: string) => Array.from(K.opts.querySelectorAll("button")).find((b) => b.textContent === t)!;
    btn("清空重来").click();
    btn("入队").click();
    btn("入队").click();
    btn("出队").click();
    expect(demo.done()).toBe(true);
    expect(panel.querySelector(".x-d1-say")!.textContent).toMatch(/出队/);
    expect(panel.querySelectorAll("tbody tr").length).toBe(3);
  });
});
