import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";
import { describe, expect, it } from "vitest";

/** 在沙箱里执行“性质与公式 · 组成原理”脚本：校验注册数据、PROPU.co 纯函数，并在 jsdom 中挂载每个验证动画 */
interface Err { err?: string }
interface Range extends Err { min: number; max: number; count: number; zeros: number; ulp: number }
interface Ovf extends Err { m1: boolean; m2: boolean; m3: boolean; of: boolean; agree: boolean; top: string; Cn: number; Cn1: number; S: string; value: number; kind: string | null }
interface Lim extends Err { bias: number; maxNorm: number; minNorm: number; maxDen: number; minDen: number; pat: Record<string, string[]> }
interface Cache extends Err { tag: number; index: number; offset: number; lines: number; sets: number; perLine: number; total: number }
interface OpStep { avail: number; num: number; left: number; ok: boolean }
interface CoU {
  fixedRange(n: number, code: string, frac?: boolean): Range;
  encode(x: number, n: number, code: string): string | null;
  overflow(x: number, y: number, n: number, op: string): Ovf;
  floatLimits(e: number, m: number): Lim;
  floatClass(x: number, e: number, m: number): Err & { kind: string };
  f32Hex(x: number): string;
  hammingK(n: number, secded?: boolean): Err & { k: number; base: number; total: number };
  hammingMaxN(k: number): number;
  parseSize(s: string): number;
  parseWB(s: string): { words: number; bits: number } | null;
  memExpand(c: unknown, t: unknown): Err & { count: number; rows: number; cols: number; kind: string; sel: number; chipAddr: number; totalAddr: number };
  interleave(m: number, T: number, r: number, n: number): Err & { finish: number; formula: number; seq: number; ideal: boolean; wait: number };
  cacheFields(o: Record<string, unknown>): Cache;
  cacheLocate(addr: number, blk: number, sets: number): { block: number; set: number; tag: number; offset: number };
  hitRate(nc: number, nm: number): Err & { h: number };
  cacheTa(h: number, tc: number, tm: number, mode: string): Err & { ta: number; e: number };
  avgCPI(mix: { p: number; cpi: number }[]): Err & { cpi: number };
  cpuTime(ic: number, cpi: number, f: number): Err & { t: number; mips: number };
  mips(f: number, cpi: number): number;
  amdahl(f: number, s: number): Err & { S: number; limit: number };
  amdahlMax(f: number): number;
  pipeline(k: number, n: number, dt: number): Err & { T: number; TP: number; S: number; E: number };
  opcodeCheck(L: number, A: number, cs: { addr: number; num: number }[]): Err & { ok: boolean; steps: OpStep[]; maxLast: number | null };
  opcodeMinLen(A: number, cs: { addr: number; num: number }[]): Err & { bits: number; bytes: number };
  busBW(w: number, f: number, cpb?: number, tpc?: number): Err & { bw: number };
  burstBW(w: number, f: number, addr: number, n: number, cpb?: number): Err & { bw: number };
  ioShare(o: Record<string, number>): Err & { poll: number; intr: number; dma: number };
}
interface Ex { q: string; opts: string[]; a: number; why: string; src: string }
interface Prop {
  id: string; sub: string; ch: string; name: string; def: string; stmt: string[]; cond: string;
  proof: string[]; traps: string[]; ex: Ex; links: { lab: string[]; proc: string[] };
  demo: (box: HTMLElement) => { destroy: () => void };
}

const DIR = resolve(__dirname, "../../public/legacy/js");
const SRC = readFileSync(resolve(DIR, "25-prop-co.js"), "utf8");

function load() {
  const win: Record<string, unknown> = {};
  const ctx: Record<string, unknown> = {
    window: win, document, Error, Object, Array, JSON, Math, Number, String, parseInt, parseFloat, isNaN, isFinite,
    Float32Array, Uint32Array, setTimeout, clearTimeout, setInterval, clearInterval, Infinity, NaN,
  };
  runInNewContext(SRC, new Proxy(ctx, {
    get: (t, k) => (k in t ? t[k as string] : win[k as string]),
    has: () => true,
    set: (t, k, v) => { t[k as string] = v; win[k as string] = v; return true; },
  }));
  return { P: win.PROP as Prop[], U: (win.PROPU as { co: CoU }).co };
}

const { P, U } = load();

/** 从实验与图解脚本里提取注册的 id */
function registered(files: string[], re: RegExp): Set<string> {
  const ids = new Set<string>();
  for (const f of files) {
    const s = readFileSync(resolve(DIR, f), "utf8");
    for (const m of s.matchAll(re)) ids.add(m[1]!);
  }
  return ids;
}
const LAB_IDS = registered(["08-lab.js", "15-lab-cn.js", "16-lab-coos.js", "19-lab-ds1.js", "20-lab-ds2.js", "21-lab-ds3.js"], /\bid:\s*"([a-z0-9]+)",\s*name:\s*"[^"]*",\s*color:/g);
const PROC_IDS = registered(["12-proc-circuit.js", "13-proc-co.js", "14-proc-os.js", "17-proc-cn.js", "18-proc-coos.js", "22-proc-ds.js"], /\bid:\s*"([a-z0-9]+)",\s*name:\s*"[^"]*",\s*sub:/g);

function rng(seed: number) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}
const ri = (r: () => number, lo: number, hi: number) => lo + Math.floor(r() * (hi - lo + 1));

describe("注册数据", () => {
  it("14 条组成原理性质，id 唯一且带 co- 前缀", () => {
    expect(P.length).toBe(14);
    const ids = P.map((p) => p.id);
    expect(new Set(ids).size).toBe(14);
    for (const p of P) {
      expect(p.id).toMatch(/^co-[a-z0-9-]+$/);
      expect(p.sub).toBe("co");
      expect(p.ch).toMatch(/^第 [1-7] 章 /);
    }
  });
  it("每条都有定义、结论、条件、≥3 步推导、2~3 条易错点和四选一例题", () => {
    for (const p of P) {
      expect(p.name.length, p.id).toBeGreaterThan(2);
      expect(p.def.length, p.id).toBeGreaterThan(10);
      expect(p.stmt.length, p.id).toBeGreaterThanOrEqual(1);
      expect(p.stmt.length, p.id).toBeLessThanOrEqual(3);
      expect(p.cond.length, p.id).toBeGreaterThan(10);
      expect(p.proof.length, p.id).toBeGreaterThanOrEqual(3);
      expect(p.proof.length, p.id).toBeLessThanOrEqual(8);
      expect(p.traps.length, p.id).toBeGreaterThanOrEqual(2);
      expect(p.traps.length, p.id).toBeLessThanOrEqual(3);
      expect(p.ex.opts.length, p.id).toBe(4);
      expect(new Set(p.ex.opts).size, p.id).toBe(4);
      expect(Number.isInteger(p.ex.a) && p.ex.a >= 0 && p.ex.a <= 3, p.id).toBe(true);
      expect(p.ex.why.length, p.id).toBeGreaterThan(10);
      expect(p.ex.src, p.id).toMatch(/^(20\d\d 年真题|典型题)$/);
      expect(typeof p.demo, p.id).toBe("function");
      for (const s of [p.def, p.cond, ...p.stmt, ...p.proof, ...p.traps, p.ex.q, p.ex.why, ...p.ex.opts]) expect(s, p.id).not.toMatch(/<[a-z/]/i);
    }
  });
  it("相关链接都指向真实存在的实验或图解", () => {
    expect(LAB_IDS.has("ieee754") && LAB_IDS.has("cache") && LAB_IDS.has("pipeline")).toBe(true);
    expect(PROC_IDS.has("cachewrite") && PROC_IDS.has("dma")).toBe(true);
    for (const p of P) {
      for (const id of p.links.lab) expect(LAB_IDS.has(id), p.id + " → lab " + id).toBe(true);
      for (const id of p.links.proc) expect(PROC_IDS.has(id), p.id + " → proc " + id).toBe(true);
    }
  });
  it("标注真题年份的只有经过核实的那几道", () => {
    const years = Object.fromEntries(P.filter((p) => p.ex.src !== "典型题").map((p) => [p.id, p.ex.src]));
    expect(years).toEqual({
      "co-ieee754": "2011 年真题", "co-mem-expand": "2009 年真题", "co-interleave": "2017 年真题", "co-cache-addr": "2009 年真题",
      "co-cpu-perf": "2017 年真题", "co-pipeline": "2013 年真题", "co-opcode": "2017 年真题", "co-bus-bw": "2009 年真题", "co-io-overhead": "2009 年真题",
    });
  });
});

describe("验收关键数值（七.2）", () => {
  it("8 位补码 −128 ~ 127", () => {
    const r = U.fixedRange(8, "twos");
    expect([r.min, r.max, r.count]).toEqual([-128, 127, 256]);
    const s = U.fixedRange(8, "sign");
    expect([s.min, s.max, s.count, s.zeros]).toEqual([-127, 127, 255, 2]);
  });
  it("海明码 n = 8 → k = 4", () => {
    expect(U.hammingK(8).k).toBe(4);
    expect(U.hammingK(8, true).k).toBe(5);
  });
  it("流水线 k = 4、n = 10、Δt = 1 → T = 13", () => {
    const r = U.pipeline(4, 10, 1);
    expect(r.T).toBe(13);
    expect(r.E).toBeCloseTo(10 / 13, 12);
    expect(r.S).toBeCloseTo(40 / 13, 12);
  });
  it("Amdahl f = 0.5、s = 2 → 4/3", () => {
    expect(U.amdahl(0.5, 2).S).toBeCloseTo(4 / 3, 12);
    expect(U.amdahlMax(0.5)).toBe(2);
  });
});

describe("例题答案与公式一致", () => {
  const ans = (id: string) => { const p = P.find((x) => x.id === id)!; return p.ex.opts[p.ex.a]!; };
  it("各题选中的选项能由 PROPU 算出", () => {
    expect(ans("co-fixed-range")).toBe("128");
    expect(U.encode(128, 8, "twos")).toBeNull();
    expect(U.encode(-128, 8, "twos")).toBe("10000000");
    const o = U.overflow(112, 32, 8, "+");
    expect(o.S).toBe("10010000");
    expect([o.Cn, o.Cn1, o.top, o.kind]).toEqual([0, 1, "01", "正溢出"]);
    expect(ans("co-ieee754")).toBe("C104 0000H");
    expect(U.f32Hex(-8.25)).toBe("C1040000");
    expect(ans("co-hamming")).toBe(String(U.hammingK(16).k));
    const rom = U.memExpand(U.parseWB("2K×8"), U.parseWB("4K×8")), ram = U.memExpand(U.parseWB("4K×4"), U.parseWB("60K×8"));
    expect(ans("co-mem-expand")).toBe(rom.count + "、" + ram.count);
    const loc = U.cacheLocate(129, 32, 8);
    expect(ans("co-cache-addr")).toBe(String(loc.set));
    expect(ans("co-cache-ta")).toBe(Math.round(U.cacheTa(U.hitRate(950, 50).h, 5, 50, "seq").ta * 100) / 100 + " ns");
    const t1 = U.cpuTime(1e6, 2, 1.5e9).t, t2 = U.cpuTime(1e6, 1, 1.2e9).t;
    expect(ans("co-cpu-perf")).toBe(String(Math.round(t1 / t2 * 1000) / 1000));
    expect(ans("co-amdahl")).toBe(U.amdahl(0.6, 4).S.toFixed(2));
    const p = U.pipeline(4, 100, 1 / 1.03e9);
    expect(p.TP / 1e9).toBeCloseTo(1, 9);
    expect(ans("co-opcode")).toBe(U.opcodeMinLen(6, [{ addr: 3, num: 29 }, { addr: 2, num: 107 }]).bytes + " 位");
    expect(ans("co-bus-bw")).toBe(U.busBW(32, 10e6, 2).bw / 1e6 + " MB/s");
    const io = U.ioShare({ f: 500e6, rate: 0.5e6, unit: 4, pollCycles: 100, intrCycles: 100, block: 5000, dmaCycles: 500 });
    expect(ans("co-io-overhead")).toBe(io.intr * 100 + "%");
  });
});

describe("PROPU.co 纯函数", () => {
  it("定点数范围：小数、原反补编码", () => {
    const f = U.fixedRange(8, "twos", true);
    expect([f.min, f.max]).toEqual([-1, 1 - 1 / 128]);
    expect(U.fixedRange(8, "ones", true).min).toBe(-(1 - 1 / 128));
    expect(U.encode(-5, 8, "sign")).toBe("10000101");
    expect(U.encode(-5, 8, "ones")).toBe("11111010");
    expect(U.encode(-5, 8, "twos")).toBe("11111011");
    expect(U.encode(-128, 8, "sign")).toBeNull();
    expect(U.fixedRange(1, "twos").err).toMatch(/位数/);
  });
  it("溢出：三种方法在 2000 组随机加减法上与真实结果一致", () => {
    const r = rng(7);
    for (let i = 0; i < 2000; i++) {
      const n = ri(r, 3, 12), h = 2 ** (n - 1);
      const x = ri(r, -h, h - 1), y = ri(r, -h, h - 1), op = r() < 0.5 ? "+" : "-";
      const o = U.overflow(x, y, n, op);
      const truth = op === "+" ? x + y : x - y;
      expect(o.of).toBe(truth > h - 1 || truth < -h);
      expect(o.agree, `${x}${op}${y} n=${n}`).toBe(true);
      const M = 2 ** n;
      expect(((o.value - truth) % M + M) % M).toBe(0);
    }
    expect(U.overflow(0, -8, 4, "-").of).toBe(true);
    expect(U.overflow(-1, -1, 8, "+").m3).toBe(false);
    expect(U.overflow(200, 1, 8, "+").err).toMatch(/超出/);
  });
  it("IEEE 754 极值与机器数", () => {
    const L = U.floatLimits(8, 23);
    expect(L.bias).toBe(127);
    expect(L.maxNorm).toBe(Math.fround(3.4028234663852886e38));
    expect(L.minNorm).toBe(2 ** -126);
    expect(L.minDen).toBe(2 ** -149);
    expect(L.minNorm - L.maxDen).toBe(L.minDen);
    expect(U.f32Hex(L.maxNorm)).toBe("7F7FFFFF");
    expect(U.f32Hex(L.minNorm)).toBe("00800000");
    expect(U.f32Hex(L.minDen)).toBe("00000001");
    expect(L.pat.maxNorm!.join("")).toBe("0" + "11111110" + "1".repeat(23));
    const D = U.floatLimits(11, 52);
    expect(D.maxNorm).toBe(Number.MAX_VALUE);
    expect(D.minDen).toBe(Number.MIN_VALUE);
    expect(U.floatClass(1e39, 8, 23).kind).toBe("inf");
    expect(U.floatClass(1e-40, 8, 23).kind).toBe("denormal");
    expect(U.floatClass(1e-46, 8, 23).kind).toBe("underflow");
    expect(U.floatClass(-8.25, 8, 23).kind).toBe("normal");
    const r = rng(3);
    for (let i = 0; i < 100; i++) {
      const x = (r() - 0.5) * 10 ** ri(r, -30, 30);
      expect(U.floatClass(x, 8, 23).kind).toBe(Math.fround(x) === 0 ? "underflow" : Math.abs(Math.fround(x)) >= 2 ** -126 ? "normal" : "denormal");
    }
    expect(U.floatLimits(1, 23).err).toBeTruthy();
  });
  it("海明码：k 最小且满足 2^k ≥ n + k + 1", () => {
    for (let n = 1; n <= 300; n++) {
      const k = U.hammingK(n).k;
      expect(2 ** k).toBeGreaterThanOrEqual(n + k + 1);
      expect(2 ** (k - 1)).toBeLessThan(n + k);
      expect(n).toBeLessThanOrEqual(U.hammingMaxN(k));
    }
    expect([1, 4, 11, 26, 57].map((n) => U.hammingK(n).k)).toEqual([2, 3, 4, 5, 6]);
    expect(U.hammingK(0).err).toBeTruthy();
  });
  it("存储器扩展：芯片数 = 总容量 / 单片容量", () => {
    expect(U.parseSize("64KB")).toBe(65536);
    expect(U.parseSize("4 GB")).toBe(2 ** 32);
    expect(U.parseSize("32b")).toBe(32);
    expect(Number.isNaN(U.parseSize("abc"))).toBe(true);
    expect(U.parseWB("4K×4")).toEqual({ words: 4096, bits: 4 });
    expect(U.parseWB("2kx8")).toEqual({ words: 2048, bits: 8 });
    const r = U.memExpand(U.parseWB("1K×4"), U.parseWB("4K×8"));
    expect([r.count, r.rows, r.cols, r.kind, r.sel, r.chipAddr, r.totalAddr]).toEqual([8, 4, 2, "字位同时扩展", 2, 10, 12]);
    expect(U.memExpand(U.parseWB("1K×4"), U.parseWB("1K×8")).kind).toBe("位扩展");
    expect(U.memExpand(U.parseWB("2K×8"), U.parseWB("8K×8")).kind).toBe("字扩展");
    expect(U.memExpand(U.parseWB("1K×3"), U.parseWB("1K×8")).err).toMatch(/整数倍/);
    const g = rng(11);
    for (let i = 0; i < 100; i++) {
      const a = 2 ** ri(g, 8, 14), b = [1, 2, 4, 8][ri(g, 0, 3)]!, A = a * ri(g, 1, 16), B = b * ri(g, 1, 8);
      expect(U.memExpand({ words: a, bits: b }, { words: A, bits: B }).count).toBe((A * B) / (a * b));
    }
  });
  it("低位交叉：T ≤ m·r 时模拟结果等于 T + (n − 1)r", () => {
    expect(U.interleave(4, 4, 1, 4).finish).toBe(7);
    const g = rng(5);
    for (let i = 0; i < 100; i++) {
      const m = ri(g, 1, 8), r = ri(g, 1, 4), T = ri(g, 1, m * r), n = ri(g, 1, 20);
      const x = U.interleave(m, T, r, n);
      expect(x.finish).toBe(T + (n - 1) * r);
      expect(x.wait).toBe(0);
    }
    const c = U.interleave(2, 8, 1, 4);
    expect(c.ideal).toBe(false);
    expect(c.finish).toBe(c.formula + c.wait);
    expect(c.finish).toBe(17);
  });
  it("Cache 地址划分与总容量", () => {
    const r = U.cacheFields({ memBytes: 2 ** 32, cacheBytes: 65536, blockBytes: 32, ways: 8, wb: true, lru: true });
    expect([r.offset, r.index, r.tag, r.lines, r.perLine, r.total]).toEqual([5, 8, 19, 2048, 280, 573440]);
    const d = U.cacheFields({ memBytes: 2 ** 32, cacheBytes: 65536, blockBytes: 32, ways: 1, wb: false, lru: true });
    expect([d.index, d.tag, d.perLine]).toEqual([11, 16, 273]);
    const f = U.cacheFields({ memBytes: 2 ** 32, cacheBytes: 65536, blockBytes: 32, ways: "full", wb: true, lru: false });
    expect([f.index, f.tag]).toEqual([0, 27]);
    const g = rng(9);
    for (let i = 0; i < 100; i++) {
      const mb = ri(g, 20, 36), cb = ri(g, 9, Math.min(mb - 1, 22)), bb = ri(g, 2, Math.min(cb, 8)), w = 2 ** ri(g, 0, cb - bb);
      const x = U.cacheFields({ memBytes: 2 ** mb, cacheBytes: 2 ** cb, blockBytes: 2 ** bb, ways: w, wb: g() < 0.5, lru: true });
      expect(x.tag + x.index + x.offset).toBe(mb);
      expect(x.sets * w).toBe(x.lines);
    }
    expect(U.cacheFields({ memBytes: 1000, cacheBytes: 64, blockBytes: 8, ways: 1 }).err).toMatch(/2 的整数次幂/);
  });
  it("命中率与平均访问时间两种口径", () => {
    expect(U.hitRate(950, 50).h).toBe(0.95);
    expect(U.cacheTa(0.95, 5, 50, "par").ta).toBeCloseTo(7.25, 12);
    expect(U.cacheTa(0.95, 5, 50, "seq").ta).toBeCloseTo(7.5, 12);
    const g = rng(13);
    for (let i = 0; i < 100; i++) {
      const h = g(), tc = 1 + g() * 10, tm = tc + g() * 100;
      const a = U.cacheTa(h, tc, tm, "par").ta, b = U.cacheTa(h, tc, tm, "seq").ta;
      expect(b - a).toBeCloseTo((1 - h) * tc, 9);
      expect(b).toBeCloseTo(h * tc + (1 - h) * (tc + tm), 9);
    }
    expect(U.cacheTa(1.2, 5, 50, "par").err).toBeTruthy();
  });
  it("CPU 性能：CPI 加权、时间与 MIPS 互相一致", () => {
    const c = U.avgCPI([{ p: 0.8, cpi: 1 }, { p: 0.2, cpi: 10 }]);
    expect(c.cpi).toBeCloseTo(2.8, 12);
    expect(U.cpuTime(10000, c.cpi, 1e9).t).toBeCloseTo(28e-6, 15);
    expect(U.mips(1.2e9, 3)).toBeCloseTo(400, 9);
    expect(U.avgCPI([{ p: 0.5, cpi: 1 }]).err).toMatch(/100%/);
    const g = rng(17);
    for (let i = 0; i < 100; i++) {
      const ic = ri(g, 1, 1e7), cpi = 0.5 + g() * 5, f = 1e8 + g() * 4e9, r = U.cpuTime(ic, cpi, f);
      expect(r.t).toBeCloseTo(ic / (r.mips * 1e6), 12);
    }
  });
  it("Amdahl：不超过上限，随机验证 1/S = (1 − f) + f/s", () => {
    const g = rng(19);
    for (let i = 0; i < 100; i++) {
      const f = g(), s = 1 + g() * 100, a = U.amdahl(f, s);
      expect(1 / a.S).toBeCloseTo(1 - f + f / s, 12);
      expect(a.S).toBeLessThanOrEqual(a.limit + 1e-9);
    }
    expect(U.amdahl(1.5, 2).err).toBeTruthy();
  });
  it("流水线：E = S/k，随机 100 组", () => {
    const g = rng(23);
    for (let i = 0; i < 100; i++) {
      const k = ri(g, 1, 12), n = ri(g, 1, 500), dt = 0.1 + g() * 5, r = U.pipeline(k, n, dt);
      expect(r.T).toBeCloseTo((k + n - 1) * dt, 9);
      expect(r.E).toBeCloseTo(r.S / k, 12);
      expect(r.S).toBeLessThanOrEqual(k + 1e-12);
    }
  });
  it("扩展操作码：经典示例可行、2017 真题最短 23 位（按字节 24 位）", () => {
    const r = U.opcodeCheck(16, 4, [{ addr: 3, num: 15 }, { addr: 2, num: 15 }, { addr: 1, num: 15 }, { addr: 0, num: 16 }]);
    expect(r.ok).toBe(true);
    expect(r.steps.map((s) => s.avail)).toEqual([16, 16, 16, 16]);
    expect(U.opcodeCheck(16, 4, [{ addr: 3, num: 15 }, { addr: 2, num: 15 }, { addr: 1, num: 15 }, { addr: 0, num: 17 }]).ok).toBe(false);
    expect(U.opcodeMinLen(6, [{ addr: 3, num: 29 }, { addr: 2, num: 107 }])).toEqual({ bits: 23, bytes: 24 });
    expect(U.opcodeCheck(22, 6, [{ addr: 3, num: 29 }, { addr: 2, num: 107 }]).ok).toBe(false);
    const g = rng(29);
    for (let i = 0; i < 100; i++) {
      const A = ri(g, 2, 6), L = 3 * A + ri(g, 1, 6), x = ri(g, 0, 2 ** (L - 3 * A)), y = ri(g, 0, 200);
      const ok = U.opcodeCheck(L, A, [{ addr: 3, num: x }, { addr: 2, num: y }]).ok;
      expect(ok).toBe(x <= 2 ** (L - 3 * A) && y <= (2 ** (L - 3 * A) - x) * 2 ** A);
    }
    expect(U.opcodeCheck(8, 4, [{ addr: 3, num: 1 }]).err).toMatch(/放不下/);
  });
  it("总线带宽与 I/O 占用率", () => {
    expect(U.busBW(32, 10e6, 2).bw).toBe(20e6);
    expect(U.busBW(64, 1333e6, 1, 4).bw).toBeCloseTo(42.656e9, 0);
    expect(U.burstBW(32, 100e6, 1, 4).bw).toBeCloseTo(320e6, 3);
    const io = U.ioShare({ f: 500e6, rate: 5e6, unit: 4, pollCycles: 100, intrCycles: 100, block: 5000, dmaCycles: 500 });
    expect(io.dma).toBeCloseTo(0.001, 12);
    expect(io.intr).toBeCloseTo(0.25, 12);
    expect(U.ioShare({ f: 0, rate: 1, unit: 1, pollCycles: 1, intrCycles: 1, block: 1, dmaCycles: 1 }).err).toBeTruthy();
  });
});

describe("jsdom：每个验证动画都能挂载、操作、销毁", () => {
  for (const p of P) {
    it(p.id, () => {
      const box = document.createElement("div");
      document.body.appendChild(box);
      const errors: unknown[] = [];
      const onErr = (e: ErrorEvent) => errors.push(e.error);
      window.addEventListener("error", onErr);
      const d = p.demo(box);
      expect(typeof d.destroy).toBe("function");
      const errText = () => box.querySelector(".x-pc__err")?.textContent ?? "";
      expect(errText(), p.id).toBe("");
      const svg = box.querySelector("svg");
      expect(svg, p.id).not.toBeNull();
      const vb = (svg!.getAttribute("viewBox") ?? "").split(" ").map(Number);
      expect(vb[2]).toBeLessThanOrEqual(720);
      for (const t of Array.from(box.querySelectorAll("text"))) expect(Number(t.getAttribute("font-size")), p.id).toBeGreaterThanOrEqual(13);
      expect((box.querySelector(".x-pc__out")?.textContent ?? "").length, p.id).toBeGreaterThan(10);
      /* 点每个按钮（含预设、分段切换） */
      for (const b of Array.from(box.querySelectorAll("button"))) {
        (b as HTMLButtonElement).click();
        expect(errText(), p.id + " / " + b.textContent).toBe("");
      }
      /* 拖动每个滑块到两端 */
      for (const r of Array.from(box.querySelectorAll<HTMLInputElement>("input[type=range]"))) {
        const old = r.value;
        for (const v of [r.min, r.max]) {
          r.value = v;
          r.dispatchEvent(new Event("input"));
          /* 参数组合越界时允许给出中文提示（例如位数调小后 x 超出范围），但不能抛异常 */
          if (errText()) expect(errText(), p.id + " / range " + v).toMatch(/[\u4e00-\u9fa5]/);
        }
        r.value = old;
        r.dispatchEvent(new Event("input"));
        expect(errText(), p.id + " / range 复原").toBe("");
      }
      /* 非法输入给出中文错误，改回后恢复 */
      const num = box.querySelector<HTMLInputElement>("input.x-pc__num:not([disabled])");
      if (num) {
        const old = num.value;
        num.value = "abc";
        num.dispatchEvent(new Event("input"));
        expect(errText(), p.id).toMatch(/[\u4e00-\u9fa5]/);
        num.value = old;
        num.dispatchEvent(new Event("input"));
      }
      /* SVG 里可点击的元素也点一下（海明码校验位） */
      for (const r of Array.from(box.querySelectorAll("svg rect[tabindex]"))) r.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      d.destroy();
      expect(box.children.length, p.id).toBe(0);
      window.removeEventListener("error", onErr);
      expect(errors).toEqual([]);
      box.remove();
    });
  }
  it("流水线逐拍播放：计时器在 destroy 后被清除", () => {
    const p = P.find((x) => x.id === "co-pipeline")!;
    const box = document.createElement("div");
    const d = p.demo(box);
    const play = Array.from(box.querySelectorAll("button")).find((b) => b.textContent === "逐拍播放")!;
    play.click();
    expect(box.querySelector(".x-pc__note")?.textContent).toMatch(/第 1 拍/);
    d.destroy();
    expect(box.children.length).toBe(0);
  });
  it("溢出动画：默认示例三种方法一致并判为正溢出", () => {
    const p = P.find((x) => x.id === "co-overflow")!;
    const box = document.createElement("div");
    const d = p.demo(box);
    expect(box.textContent).toMatch(/正溢出/);
    expect(box.querySelector(".x-pc__note.is-ok")).not.toBeNull();
    d.destroy();
  });
});
