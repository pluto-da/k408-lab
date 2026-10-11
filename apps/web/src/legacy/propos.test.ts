import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";
import { describe, expect, it } from "vitest";

/** 性质与公式 · 操作系统：在 node:vm 沙箱里执行 26-prop-os.js，测注册表、PROPU.os 纯函数，并在 jsdom 中挂载每个验证动画 */
interface Ex { q: string; opts: string[]; a: number; why: string; src: string }
interface Demo { destroy(): void }
interface Prop {
  id: string; sub: string; ch: string; name: string; def: string; stmt: string[]; cond: string;
  proof: string[]; traps: string[]; ex: Ex; links: { lab: string[]; proc: string[] }; demo(box: HTMLElement): Demo;
}
interface Err { err?: string }
interface Step { i: number; before: number[]; after: number[] }
interface Sem { init: number; v: number; holders: string[]; queue: string[]; next: number; msg: string }
interface SchedRow { name: string; a: number; b: number; start: number; finish: number; tat: number; wtat: number; wait: number }
interface Sched { rows: SchedRow[]; order: number[]; avgTat: number; avgWtat: number; avgWait: number; end: number; gantt: { i: number; s: number; e: number }[] }
interface Job { name: string; a: number; b: number }
interface OsU {
  deadlockMin(n: number, k: number): number;
  deadlockMinMulti(ks: number[]): number;
  maxProcs(m: number, k: number): number;
  deadlockPossible(n: number, k: number, m: number): boolean;
  worstAlloc(n: number, k: number, m: number): { alloc: number[]; free: number; finish: number; deadlock: boolean };
  needFromMax(max: number[][], alloc: number[][]): Err & { v?: number[][] };
  bankerCheck(a: number[][], n: number[][], v: number[]): Err;
  bankerSafe(a: number[][], n: number[][], v: number[]): { safe: boolean; seq: number[]; steps: Step[]; work: number[]; left: number[] };
  bankerAll(a: number[][], n: number[][], v: number[], limit?: number): { count: number; list: number[][] };
  semInit(v: number): Sem; semWait(s: Sem): Sem; semSignal(s: Sem): Sem; semMeaning(v: number): string;
  schedule(jobs: Job[], alg: string): Sched;
  parseJobs(s: string): Err & { v?: Job[] };
  eat(o: { t: number; lam: number; a: number; mode: string; p?: number; fault?: number }): { none: number; seq: number; par: number; base: number; total: number };
  pageLevels(L: number, page: number, E: number): Err & { P: number; per: number; bits: number; vpn: number; levels: number; split: number[]; topEntries: number };
  pageTableSize(L: number, page: number, E: number): Err & { entries: number; bytes: number; pages: number; vpn: number };
  replace(refs: number[], frames: number, alg: string): { faults: number; trace: { ref: number; mem: number[]; fault: boolean; out: number | null }[] };
  beladyCurve(refs: number[], maxF: number): { fifo: number[]; lru: number[]; opt: number[] };
  anomalies(a: number[]): number[];
  diskTime(Ts: number, rpm: number, b: number, N: number): { rev: number; seek: number; rot: number; xfer: number; total: number };
  maxFileSize(o: { a: number; b: number; c: number; t?: number; B: number; d: number }): { per: number; totalBlocks: number; bytes: number };
  fmtBytes(x: number): string;
  bitmapToBlock(i: number, j: number, n: number, base: number): Err & { v?: number };
  bitmapFromBlock(b: number, n: number, base: number): Err & { i: number; j: number };
  bitmapBytes(blocks: number): number;
  pagingFrag(s: number, p: number): { pages: number; waste: number };
  fixedFrag(parts: number[], jobs: number[]): { place: number[]; waste: number };
  externalFrag(h: number[], r: number): { total: number; max: number; fits: boolean; frag: boolean };
  STATES: [string, string][];
  transition(a: string, b: string): { ok: boolean; why: string };
  vars(s: string, name: string): Err & { v?: string[] };
  bernstein(R1: string[], W1: string[], R2: string[], W2: string[]): { rw: string[]; wr: string[]; ww: string[]; ok: boolean };
  rwOf(s: string): Err & { R: string[]; W: string[] };
  num(s: string, o?: Record<string, unknown>): Err & { v?: number };
  size(s: string, name: string): Err & { v?: number };
  nums(s: string, o?: Record<string, unknown>): Err & { v?: number[] };
  matrix(s: string, name: string): Err & { v?: number[][] };
}

const JS = resolve(__dirname, "../../public/legacy/js");
const SRC = readFileSync(resolve(JS, "26-prop-os.js"), "utf8");

function load(withDom: boolean) {
  const win: Record<string, unknown> = {};
  const ctx: Record<string, unknown> = { window: win, Error, Object, Array, JSON, Math, Number, String, parseInt, parseFloat, isNaN, isFinite, Infinity, setTimeout, clearTimeout };
  if (withDom) ctx.document = document;
  runInNewContext(SRC, new Proxy(ctx, {
    get: (t, k) => (k in t ? t[k as string] : win[k as string]),
    has: () => true,
    set: (t, k, v) => { t[k as string] = v; win[k as string] = v; return true; },
  }));
  return { PROP: win.PROP as Prop[], U: (win.PROPU as { os: OsU }).os };
}

/** 从实验 / 图解脚本里收集真实存在的 id（实验带 color，图解带 sub） */
function collectIds() {
  const files = readdirSync(JS).filter((f) => /\.js$/.test(f));
  const lab = new Set<string>(), proc = new Set<string>();
  for (const f of files) {
    const s = readFileSync(resolve(JS, f), "utf8");
    if (/lab/.test(f)) for (const m of s.matchAll(/id:\s*"([\w-]+)",\s*name:\s*"[^"]*",\s*color:/g)) lab.add(m[1]!);
    if (/proc/.test(f)) for (const m of s.matchAll(/id:\s*"([\w-]+)",\s*name:\s*"[^"]*",\s*sub:/g)) proc.add(m[1]!);
  }
  return { lab, proc };
}

function rng(seed: number) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}
const ri = (r: () => number, lo: number, hi: number) => lo + Math.floor(r() * (hi - lo + 1));

const { PROP, U } = load(false);

describe("注册表", () => {
  it("14 条操作系统性质，id 唯一，字段齐全", () => {
    expect(PROP.length).toBe(14);
    const ids = PROP.map((p) => p.id);
    expect(new Set(ids).size).toBe(14);
    for (const p of PROP) {
      expect(p.id).toMatch(/^os-[a-z0-9-]+$/);
      expect(p.sub).toBe("os");
      expect(p.ch).toMatch(/^第 \d 章 /);
      for (const k of ["name", "def", "cond"] as const) expect(p[k].trim().length, p.id + "." + k).toBeGreaterThan(3);
      expect(p.stmt.length).toBeGreaterThanOrEqual(1);
      expect(p.stmt.length).toBeLessThanOrEqual(3);
      expect(p.proof.length, p.id).toBeGreaterThanOrEqual(3);
      expect(p.proof.length, p.id).toBeLessThanOrEqual(8);
      expect(p.traps.length, p.id).toBeGreaterThanOrEqual(2);
      expect(p.traps.length, p.id).toBeLessThanOrEqual(3);
      for (const s of [...p.stmt, ...p.proof, ...p.traps]) expect(s.trim().length).toBeGreaterThan(3);
      expect(p.ex.opts.length).toBe(4);
      expect(new Set(p.ex.opts).size, p.id + " 选项重复").toBe(4);
      expect(Number.isInteger(p.ex.a) && p.ex.a >= 0 && p.ex.a <= 3).toBe(true);
      expect(p.ex.q.length).toBeGreaterThan(10);
      expect(p.ex.why.length).toBeGreaterThan(10);
      expect(p.ex.src).toMatch(/^(20\d{2} 年真题|典型题)$/);
      expect(typeof p.demo).toBe("function");
      /* 纯文本：不夹带 HTML 标签 */
      for (const s of [p.name, p.def, p.cond, ...p.stmt, ...p.proof, ...p.traps, p.ex.q, p.ex.why, ...p.ex.opts]) expect(s).not.toMatch(/<[a-z/]/i);
    }
  });
  it("覆盖第 2、3、4、5 章", () => {
    const chs = new Set(PROP.map((p) => p.ch));
    expect(chs).toEqual(new Set(["第 2 章 进程管理", "第 3 章 内存管理", "第 4 章 文件管理", "第 5 章 输入/输出（I/O）管理"]));
  });
  it("links 引用的实验和图解都存在", () => {
    const { lab, proc } = collectIds();
    expect(lab.has("banker")).toBe(true);
    expect(proc.has("pstate")).toBe(true);
    for (const p of PROP) {
      for (const id of p.links.lab) expect(lab.has(id), p.id + " → lab " + id).toBe(true);
      for (const id of p.links.proc) expect(proc.has(id), p.id + " → proc " + id).toBe(true);
    }
  });
  it("标注的真题年份只用核实过的那几题", () => {
    const years = Object.fromEntries(PROP.filter((p) => p.ex.src !== "典型题").map((p) => [p.id, p.ex.src]));
    expect(years).toEqual({
      "os-deadlock-min": "2009 年真题", "os-banker-safe": "2022 年真题", "os-semaphore": "2010 年真题",
      "os-pt-levels": "2010 年真题", "os-belady": "2014 年真题", "os-mixed-index": "2010 年真题",
      "os-bitmap": "2014 年真题", "os-fragment": "2019 年真题", "os-pstate": "2022 年真题", "os-bernstein": "2026 年真题",
    });
  });
});

describe("七.2 关键数值", () => {
  it("死锁：n = 3、k = 3 → m ≥ 7", () => {
    expect(U.deadlockMin(3, 3)).toBe(7);
    expect(U.deadlockPossible(3, 3, 6)).toBe(true);
    expect(U.deadlockPossible(3, 3, 7)).toBe(false);
    expect(U.maxProcs(8, 3)).toBe(3);
    expect(U.deadlockMinMulti([3, 4, 5])).toBe(10);
    expect(U.maxProcs(5, 1)).toBe(Infinity);
  });
  it("Belady：经典串 3 块 9 次、4 块 10 次", () => {
    const r = [1, 2, 3, 4, 1, 2, 5, 1, 2, 3, 4, 5];
    expect(U.replace(r, 3, "fifo").faults).toBe(9);
    expect(U.replace(r, 4, "fifo").faults).toBe(10);
    const c = U.beladyCurve(r, 6);
    expect(U.anomalies(c.fifo)).toEqual([4]);
    expect(U.anomalies(c.lru)).toEqual([]);
    expect(U.anomalies(c.opt)).toEqual([]);
  });
  it("多级页表：32 位 / 4 KB / 4 B → 2 级；2010 年真题顶级 128 项", () => {
    const a = U.pageLevels(32, 4096, 4);
    expect(a.levels).toBe(2);
    expect(a.split).toEqual([10, 10]);
    const b = U.pageLevels(26, 1024, 2);
    expect(b.levels).toBe(2);
    expect(b.topEntries).toBe(128);
    expect(U.pageLevels(48, 4096, 8).levels).toBe(4);
    expect(U.pageLevels(12, 4096, 4).err).toMatch(/大于/);
    expect(U.pageLevels(32, 3000, 4).err).toMatch(/2 的整数次幂/);
  });
});

describe("例题数值与公式", () => {
  it("银行家：2022 年真题 2 个安全序列", () => {
    const A = [[2, 0, 1], [0, 2, 0], [1, 0, 1]], N = [[0, 2, 1], [1, 2, 3], [0, 1, 3]];
    const r = U.bankerSafe(A, N, [1, 3, 2]);
    expect(r.safe).toBe(true);
    expect(r.seq).toEqual([0, 1, 2]);
    expect(r.steps[0]!.after).toEqual([3, 3, 3]);
    expect(U.bankerAll(A, N, [1, 3, 2]).list).toEqual([[0, 1, 2], [0, 2, 1]]);
    expect(U.bankerSafe(A, N, [1, 1, 1]).safe).toBe(false);
    expect(U.needFromMax([[1, 1]], [[2, 0]]).err).toMatch(/Max 小于/);
    expect(U.bankerCheck([[1, 1]], [[1]], [1, 1]).err).toBeTruthy();
  });
  it("有效访问时间：130 / 128 / 200 ns", () => {
    const r = U.eat({ t: 100, lam: 20, a: 0.9, mode: "seq" });
    expect(r.seq).toBeCloseTo(130, 9);
    expect(r.par).toBeCloseTo(128, 9);
    expect(r.none).toBe(200);
    expect(U.eat({ t: 100, lam: 20, a: 0.9, mode: "par", p: 0.001, fault: 8e6 }).total).toBeCloseTo(0.999 * 128 + 8000, 6);
  });
  it("页表大小、混合索引、磁盘、位示图、调度", () => {
    expect(U.pageTableSize(32, 4096, 4).bytes).toBe(4 * 1024 * 1024);
    expect(U.pageTableSize(32, 4096, 4).pages).toBe(1024);
    const m = U.maxFileSize({ a: 4, b: 2, c: 1, B: 256, d: 4 });
    expect(m.bytes).toBe(1082368);
    expect(U.fmtBytes(m.bytes)).toMatch(/^1057 KB/);
    expect(U.fmtBytes(4194304)).toBe("4 MB");
    expect(U.diskTime(5, 7200, 512, 500 * 512).total).toBeCloseTo(9.1833, 3);
    expect(Math.ceil(U.bitmapBytes((10 * 1024 * 1024) / 4) / 4096)).toBe(80);
    const s = U.schedule([{ name: "J1", a: 0, b: 6 }, { name: "J2", a: 0, b: 3 }, { name: "J3", a: 0, b: 1 }], "sjf");
    expect(s.avgTat).toBe(5);
    expect(s.avgWait).toBeCloseTo(5 / 3, 9);
    expect(U.schedule(U.parseJobs("A 0 7\nB 2 4\nC 4 1\nD 5 4").v!, "hrrn").order).toEqual([0, 2, 1, 3]);
    expect(U.schedule([{ name: "A", a: 5, b: 2 }], "fcfs").gantt[0]).toEqual({ i: -1, s: 0, e: 5 });
  });
  it("信号量含义、状态转换、Bernstein", () => {
    expect(U.semMeaning(1)).toMatch(/1 个可用资源/);
    expect(U.semMeaning(-2)).toMatch(/2 个进程/);
    expect(U.transition("block", "run").ok).toBe(false);
    expect(U.transition("ready", "block").ok).toBe(false);
    for (const k of ["new>ready", "ready>run", "run>ready", "run>block", "block>ready", "run>exit"]) {
      const [a, b] = k.split(">");
      expect(U.transition(a!, b!).ok, k).toBe(true);
    }
    expect(U.bernstein(["x", "y"], ["a"], ["z"], ["b"]).ok).toBe(true);
    const c = U.bernstein(["x", "y"], ["a"], ["a", "b"], ["c"]);
    expect(c.ok).toBe(false);
    expect(c.wr).toEqual(["a"]);
    expect(U.rwOf("x = x + 1")).toMatchObject({ R: ["x"], W: ["x"] });
    expect(U.vars("∅", "R").v).toEqual([]);
    expect(U.vars("", "R").err).toMatch(/请输入/);
  });
  it("输入校验给出中文错误", () => {
    expect(U.num("abc", { name: "t" }).err).toMatch(/不是合法的数/);
    expect(U.num("", { name: "t" }).err).toMatch(/请输入/);
    expect(U.num("1.5", { name: "n", int: true }).err).toMatch(/整数/);
    expect(U.num("５", {}).v).toBe(5);
    expect(U.size("4KB", "页").v).toBe(4096);
    expect(U.size("2^12", "页").v).toBe(4096);
    expect(U.size("4x", "页").err).toMatch(/格式不对/);
    expect(U.matrix("1 2\n3", "A").err).toMatch(/资源种类数/);
    expect(U.parseJobs("A 1").err).toMatch(/第 1 行/);
    expect(U.bitmapToBlock(0, 3, 16, 1).err).toMatch(/字号最小为 1/);
  });
});

describe("随机一致性检查（各 100 次）", () => {
  it("银行家：安全序列确实可执行；不安全时每条序列都走不通", () => {
    const r = rng(408);
    let safeCnt = 0;
    for (let k = 0; k < 100; k++) {
      const n = ri(r, 2, 5), m = ri(r, 1, 3);
      const A = Array.from({ length: n }, () => Array.from({ length: m }, () => ri(r, 0, 3)));
      const N = Array.from({ length: n }, () => Array.from({ length: m }, () => ri(r, 0, 4)));
      const V = Array.from({ length: m }, () => ri(r, 0, 4));
      const res = U.bankerSafe(A, N, V), all = U.bankerAll(A, N, V, 1000);
      expect(res.safe).toBe(all.count > 0);
      if (res.safe) {
        safeCnt++;
        let w = V.slice();
        for (const i of res.seq) { expect(N[i]!.every((x, j) => x <= w[j]!)).toBe(true); w = w.map((x, j) => x + A[i]![j]!); }
        expect(res.work).toEqual(w);
        expect(all.list.some((q) => q.join() === res.seq.join())).toBe(true);
      } else expect(res.left.length).toBeGreaterThan(0);
    }
    expect(safeCnt).toBeGreaterThan(10);
  });
  it("死锁下限：最坏分配在 m = n(k−1) 时卡死、m = n(k−1)+1 时有进程凑满", () => {
    const r = rng(7);
    for (let t = 0; t < 100; t++) {
      const n = ri(r, 1, 8), k = ri(r, 2, 6), m = ri(r, 1, n * k + 2);
      const w = U.worstAlloc(n, k, m);
      expect(w.alloc.reduce((a, b) => a + b, 0) + w.free).toBe(m);
      expect(w.deadlock).toBe(m < U.deadlockMin(n, k));
      if (w.deadlock) { expect(w.free).toBe(0); expect(w.alloc.every((x) => x < k)).toBe(true); }
      else expect(w.finish).toBe(0);
      expect(U.maxProcs(m, k) * (k - 1) + 1 <= m).toBe(true);
      expect((U.maxProcs(m, k) + 1) * (k - 1) + 1 > m).toBe(true);
    }
  });
  it("信号量：value < 0 时 |value| = 等待队列长度，value ≥ 0 时队列为空", () => {
    const r = rng(11);
    for (let t = 0; t < 100; t++) {
      let s = U.semInit(ri(r, 0, 4));
      for (let k = 0; k < 20; k++) {
        s = r() < 0.55 ? U.semWait(s) : U.semSignal(s);
        if (s.v < 0) expect(s.queue.length).toBe(-s.v); else expect(s.queue.length).toBe(0);
      }
    }
  });
  it("置换：LRU / OPT 缺页随块数不增，OPT ≤ LRU、OPT ≤ FIFO；内存不超过块数", () => {
    const r = rng(99);
    for (let t = 0; t < 100; t++) {
      const refs = Array.from({ length: ri(r, 5, 20) }, () => ri(r, 0, 6));
      const c = U.beladyCurve(refs, 6);
      for (let f = 1; f < 6; f++) { expect(c.lru[f]!).toBeLessThanOrEqual(c.lru[f - 1]!); expect(c.opt[f]!).toBeLessThanOrEqual(c.opt[f - 1]!); }
      for (let f = 0; f < 6; f++) { expect(c.opt[f]!).toBeLessThanOrEqual(c.lru[f]!); expect(c.opt[f]!).toBeLessThanOrEqual(c.fifo[f]!); }
      const tr = U.replace(refs, 3, "fifo").trace;
      for (const s of tr) { expect(s.mem.length).toBeLessThanOrEqual(3); expect(s.mem).toContain(s.ref); }
    }
  });
  it("调度：周转 = 完成 − 到达，等待 = 周转 − 运行；同时到达时 SJF 平均周转最小", () => {
    const r = rng(5);
    for (let t = 0; t < 100; t++) {
      const n = ri(r, 1, 6), same = r() < 0.5;
      const jobs = Array.from({ length: n }, (_, i) => ({ name: "J" + i, a: same ? 0 : ri(r, 0, 10), b: ri(r, 1, 9) }));
      const res = { fcfs: U.schedule(jobs, "fcfs"), sjf: U.schedule(jobs, "sjf"), hrrn: U.schedule(jobs, "hrrn") };
      for (const R of Object.values(res)) {
        expect(new Set(R.order).size).toBe(n);
        for (const row of R.rows) {
          expect(row.tat).toBeCloseTo(row.finish - row.a, 9);
          expect(row.wait).toBeCloseTo(row.tat - row.b, 9);
          expect(row.wtat).toBeGreaterThanOrEqual(1 - 1e-9);
          expect(row.start).toBeGreaterThanOrEqual(row.a);
        }
      }
      if (same) { expect(res.sjf.avgTat).toBeLessThanOrEqual(res.fcfs.avgTat + 1e-9); expect(res.sjf.avgTat).toBeLessThanOrEqual(res.hrrn.avgTat + 1e-9); }
    }
  });
  it("位示图正反换算互逆（两种编号），页表级数满足每级 ≤ 一页、级数最少", () => {
    const r = rng(3);
    for (let t = 0; t < 100; t++) {
      const n = ri(r, 2, 32), base = r() < 0.5 ? 0 : 1, b = ri(r, base, 5000);
      const f = U.bitmapFromBlock(b, n, base);
      expect(U.bitmapToBlock(f.i, f.j, n, base).v).toBe(b);
      expect(U.bitmapToBlock(f.i + (base ? -1 : 0), f.j + (base ? -1 : 0), n, 0).v).toBe(b - base);
      const P = ri(r, 9, 16), E = 2 ** ri(r, 1, 3), L = ri(r, P + 1, 64);
      const lv = U.pageLevels(L, 2 ** P, E);
      expect(lv.split.reduce((a, x) => a + x, 0)).toBe(L - P);
      expect(lv.split.every((x) => x >= 1 && 2 ** x * E <= 2 ** P)).toBe(true);
      expect((lv.levels - 1) * lv.bits).toBeLessThan(L - P);
    }
  });
  it("混合索引、EAT、Bernstein 与直接计算一致", () => {
    const r = rng(17);
    for (let t = 0; t < 100; t++) {
      const a = ri(r, 0, 12), b = ri(r, 0, 3), c = ri(r, 0, 2), d = 2 ** ri(r, 1, 3), B = 2 ** ri(r, 8, 12);
      const per = B / d;
      expect(U.maxFileSize({ a, b, c, B, d }).bytes).toBe((a + b * per + c * per * per) * B);
      const tt = ri(r, 10, 200), lam = ri(r, 0, 50), h = r();
      const e = U.eat({ t: tt, lam, a: h, mode: "seq" });
      expect(e.seq).toBeCloseTo(lam + tt + (1 - h) * tt, 9);
      expect(e.par).toBeLessThanOrEqual(e.seq + 1e-9);
      const pool = ["a", "b", "c", "x", "y"], pick = () => pool.filter(() => r() < 0.35);
      const R1 = pick(), W1 = pick(), R2 = pick(), W2 = pick();
      const ok = !R1.some((v) => W2.includes(v)) && !W1.some((v) => R2.includes(v)) && !W1.some((v) => W2.includes(v));
      expect(U.bernstein(R1, W1, R2, W2).ok).toBe(ok);
    }
  });
});

describe("jsdom：每个验证动画能挂载、点击、校验输入并销毁", () => {
  const dom = load(true);
  for (const p of dom.PROP) {
    it(p.id, () => {
      const box = document.createElement("div");
      document.body.appendChild(box);
      const inst = p.demo(box);
      expect(typeof inst.destroy).toBe("function");
      const errText = () => (box.querySelector(".x-po-err")?.textContent ?? "").trim();
      const checkSvg = () => {
        for (const svg of Array.from(box.querySelectorAll("svg"))) {
          const vb = (svg.getAttribute("viewBox") ?? "").split(" ").map(Number);
          expect(vb[2]).toBeLessThanOrEqual(720);
          for (const t of Array.from(svg.querySelectorAll("text"))) expect(Number(t.getAttribute("font-size")), p.id + "：" + t.textContent).toBeGreaterThanOrEqual(13);
        }
      };
      expect(errText()).toBe("");
      expect(box.querySelector("svg, table")).not.toBeNull();
      expect((box.querySelector(".x-po-out")?.textContent ?? "").length).toBeGreaterThan(4);
      checkSvg();
      /* 点每个按钮两遍（状态机型按钮如 wait/signal、起点/终点需要多次） */
      for (let round = 0; round < 2; round++) {
        for (const b of Array.from(box.querySelectorAll("button"))) {
          if ((b as HTMLButtonElement).disabled) continue;
          (b as HTMLButtonElement).click();
        }
      }
      checkSvg();
      for (const b of Array.from(box.querySelectorAll("button[aria-pressed]"))) expect(["true", "false"]).toContain(b.getAttribute("aria-pressed"));
      /* 每个可编辑的文本 / 数字输入：清空 → 出现中文错误；恢复 → 错误消失 */
      const inputs = Array.from(box.querySelectorAll("input, textarea")) as (HTMLInputElement | HTMLTextAreaElement)[];
      for (const inp of inputs) {
        if (inp.type === "range" || inp.disabled || !inp.isConnected) continue;
        const keep = inp.value;
        inp.value = "";
        inp.dispatchEvent(new Event("input"));
        expect(errText(), p.id + " 清空输入后应报错").toMatch(/[\u4e00-\u9fa5]/);
        inp.value = "@#";
        inp.dispatchEvent(new Event("input"));
        expect(errText(), p.id + " 非法输入应报错").not.toBe("");
        inp.value = keep;
        inp.dispatchEvent(new Event("input"));
        expect(errText(), p.id + " 恢复后应无错误").toBe("");
      }
      /* 滑块：拖到两端也不报错 */
      for (const inp of Array.from(box.querySelectorAll("input[type=range]")) as HTMLInputElement[]) {
        for (const v of [inp.min, inp.max]) { inp.value = v; inp.dispatchEvent(new Event("input")); expect(errText()).toBe(""); }
      }
      checkSvg();
      inst.destroy();
      expect(box.children.length).toBe(0);
      box.remove();
    });
  }

  it("死锁动画：m 从 n(k−1) 调到 n(k−1)+1 时结论翻转", () => {
    const p = dom.PROP.find((x) => x.id === "os-deadlock-min")!;
    const box = document.createElement("div");
    const inst = p.demo(box);
    const [nIn, kIn, mIn] = Array.from(box.querySelectorAll("input[type=range]")) as HTMLInputElement[];
    nIn!.value = "3"; nIn!.dispatchEvent(new Event("input"));
    kIn!.value = "3"; kIn!.dispatchEvent(new Event("input"));
    mIn!.value = "6"; mIn!.dispatchEvent(new Event("input"));
    expect(box.querySelector(".x-po-out")!.textContent).toMatch(/可能死锁/);
    mIn!.value = "7"; mIn!.dispatchEvent(new Event("input"));
    expect(box.querySelector(".x-po-out")!.textContent).toMatch(/一定不死锁/);
    inst.destroy();
  });

  it("银行家动画：单步走完得到 P0 → P1 → P2 与 2 个安全序列", () => {
    const p = dom.PROP.find((x) => x.id === "os-banker-safe")!;
    const box = document.createElement("div");
    const inst = p.demo(box);
    const next = Array.from(box.querySelectorAll("button")).find((b) => b.textContent === "下一步")!;
    for (let i = 0; i < 3; i++) next.click();
    expect(next.disabled).toBe(true);
    const txt = box.querySelector(".x-po-out")!.textContent!;
    expect(txt).toMatch(/P0 → P1 → P2/);
    expect(txt).toMatch(/共 2 个/);
    inst.destroy();
  });

  it("信号量动画：初值 1 连续 wait 三次后 value = −2、队列 2 个", () => {
    const p = dom.PROP.find((x) => x.id === "os-semaphore")!;
    const box = document.createElement("div");
    const inst = p.demo(box);
    const inp = box.querySelector("input")!;
    inp.value = "1"; inp.dispatchEvent(new Event("input"));
    const w = Array.from(box.querySelectorAll("button")).find((b) => b.textContent === "wait(S)")!;
    w.click(); w.click(); w.click();
    expect(box.querySelector(".x-po-out")!.textContent).toMatch(/2 个进程/);
    expect(box.querySelectorAll("rect.is-wait").length).toBe(2);
    inst.destroy();
  });

  it("Belady 动画：默认串标出 3 块 → 4 块的异常", () => {
    const p = dom.PROP.find((x) => x.id === "os-belady")!;
    const box = document.createElement("div");
    const inst = p.demo(box);
    expect(box.querySelector(".x-po-out")!.textContent).toMatch(/3 块 → 4 块：9 → 10/);
    expect(box.querySelectorAll("circle.x-po-ring").length).toBe(1);
    inst.destroy();
  });
});
