import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";
import { describe, expect, it } from "vitest";

/** 在最小沙箱里执行组成原理 / 操作系统实验脚本，只测 window.LABU 上的纯计算函数 */
interface Err { err?: string }
interface Ieee extends Err { hex: string; bits: string; kind: string; value: number; text: string; exact: string; steps: { k: string; v: string; r: string; d: string }[] }
interface BoothRow { no: string; cond: string; op: string; a: string; q: string; q1: string }
interface Booth extends Err { product: string; value: number; ok: boolean; xc: string; nxc: string; yc: string; rows: BoothRow[] }
interface HamEnc extends Err { k: number; m: number; code: string; groups: { p: number; covers: number[]; v: number }[] }
interface HamChk extends Err { syn: string; S: number; pos: number; corrected: string; data: string }
interface Addr extends Err { ea: number | null; operand: number; count: number; expr: string }
interface Disk extends Err { total: number; avg: number; order: number[]; moves: { from: number; to: number; dist: number; total: number; kind: string }[] }
interface Block { s: number; z: number; j: string | null }
interface PFrame { op: { j: string; size?: number; free?: boolean } | null; ok?: boolean; fail?: boolean; frag?: boolean; merge?: string; chosen?: { s: number; z: number }; free: { s: number; z: number }[]; blocks: Block[]; d: string }
interface PcFrame { pid: string | null; stmt?: string; sem: Record<string, number>; q: Record<string, string[]>; buf: (string | null)[]; inp: number; outp: number; procs: Record<string, { state: string; on: string | null }>; deadlock: boolean; d: string }
interface LabU {
  ieee754Encode(s: string): Ieee;
  ieee754Decode(s: string): Ieee;
  booth(x: number, y: number, n?: number): Booth;
  hammingEncode(d: string, p?: string): HamEnc;
  hammingCheck(c: string, p?: string): HamChk;
  addressing(o: { mode: string; A?: number; r?: number }): Addr;
  diskSchedule(o: { req: number[]; start: number; min: number; max: number; dir: string; alg: string }): Disk;
  partitionParse(s: string): Err & { ops?: { j: string; size?: number; free?: boolean }[] };
  partitionSim(ops: unknown[], alg: string, total?: number, os?: number): Err & { frames: PFrame[] };
  pcSim(o: { n?: number; wrong?: boolean; seq: string[] }): Err & { frames: PcFrame[] };
  PART_DEF: string;
  PC_SCRIPT: string[];
  PC_SCRIPT_BAD: string[];
}
interface Lab { id: string; color: string; name: string; mount: unknown }

function load() {
  const file = resolve(__dirname, "../../public/legacy/js/16-lab-coos.js");
  const win: Record<string, unknown> = { LAB: [] };
  const ctx: Record<string, unknown> = { window: win, Error, Object, Array, JSON, Math, Number, String, parseInt, parseFloat, isNaN, isFinite };
  win.X = { reduced: true };
  ctx.X = win.X;
  runInNewContext(readFileSync(file, "utf8"), new Proxy(ctx, {
    get: (t, k) => (k in t ? t[k as string] : win[k as string]),
    has: () => true,
    set: (t, k, v) => { t[k as string] = v; win[k as string] = v; return true; },
  }));
  return { U: win.LABU as LabU, LAB: win.LAB as Lab[] };
}

const { U, LAB } = load();

describe("实验注册", () => {
  it("注册 7 个实验，组成原理 4 个、操作系统 3 个", () => {
    expect(LAB.map((l) => l.id)).toEqual(["ieee754", "booth", "hamming", "addressing", "disk", "partition", "prodcons"]);
    expect(LAB.filter((l) => l.color === "var(--x-co)").length).toBe(4);
    expect(LAB.filter((l) => l.color === "var(--x-os)").length).toBe(3);
    for (const l of LAB) expect(typeof l.mount).toBe("function");
  });
});

describe("IEEE 754", () => {
  it("十进制 → 十六进制", () => {
    expect(U.ieee754Encode("-0.75").hex).toBe("BF400000");
    expect(U.ieee754Encode("−0.75").hex).toBe("BF400000");
    expect(U.ieee754Encode("12.375").hex).toBe("41460000");
    expect(U.ieee754Encode("0").hex).toBe("00000000");
    expect(U.ieee754Encode("-0").hex).toBe("80000000");
    const p1 = U.ieee754Encode("0.1");
    expect(p1.hex).toBe("3DCCCCCD");
    expect(p1.steps.some((s) => s.k.includes("舍入"))).toBe(true);
    expect(p1.steps.some((s) => s.d.includes("无限循环"))).toBe(true);
    expect(p1.exact).toBe("0.100000001490116119384765625");
  });
  it("−0.75 的逐步过程与脚本一致", () => {
    const st = U.ieee754Encode("-0.75").steps.map((s) => s.r);
    expect(st).toContain("S = 1");
    expect(st).toContain("0.11");
    expect(st).toContain("E = −1");
    expect(st).toContain("01111110");
  });
  it("舍入、边界与特殊值", () => {
    expect(U.ieee754Encode("16777217").hex).toBe("4B800000");
    expect(U.ieee754Encode("3.4028235e38").hex).toBe("7F7FFFFF");
    expect(U.ieee754Encode("1e39").kind).toBe("inf");
    expect(U.ieee754Encode("1e-45").hex).toBe("00000001");
    expect(U.ieee754Encode("1e-40").hex).toBe("000116C2");
    expect(U.ieee754Encode("-inf").hex).toBe("FF800000");
    expect(U.ieee754Encode("abc").err).toMatch(/不是合法/);
    expect(U.ieee754Encode("").err).toBeTruthy();
  });
  it("十六进制 → 十进制", () => {
    const c = U.ieee754Decode("C1480000");
    expect(c.value).toBe(-12.5);
    expect(c.kind).toBe("normal");
    const inf = U.ieee754Decode("7F800000");
    expect(inf.kind).toBe("inf");
    expect(inf.text).toBe("+∞");
    expect(inf.value).toBe(Number.POSITIVE_INFINITY);
    expect(U.ieee754Decode("FF800000").text).toBe("−∞");
    expect(U.ieee754Decode("7FC00000").kind).toBe("nan");
    expect(U.ieee754Decode("00000000").kind).toBe("zero");
    expect(U.ieee754Decode("00000001").kind).toBe("denormal");
    expect(U.ieee754Decode("3DCCCCCD").exact).toBe("0.100000001490116119384765625");
    expect(U.ieee754Decode("12345").err).toMatch(/8 位十六进制/);
  });
  it("编码再解码与 Math.fround 一致", () => {
    for (const x of [1, -2.5, 3.14159, 1e-38, 123456.789, 0.2, 5e-42, 65504]) {
      const e = U.ieee754Encode(String(x));
      expect(U.ieee754Decode(e.hex).value).toBe(Math.fround(x));
    }
  });
});

describe("Booth 补码一位乘法", () => {
  it("5 × (−3) = −15 → 11110001", () => {
    const r = U.booth(5, -3, 4);
    expect(r.product).toBe("11110001");
    expect(r.value).toBe(-15);
    expect(r.xc).toBe("0101");
    expect(r.nxc).toBe("11 1011");
    expect(r.yc).toBe("1101");
    expect(r.rows[0]!.a).toBe("00 0000");
    expect(r.rows[1]!.cond).toBe("10");
    expect(r.rows[1]!.a).toBe("11 1011");
    expect(r.rows.filter((x) => x.cond).map((x) => x.cond)).toEqual(["10", "01", "10", "11"]);
    expect(r.rows.filter((x) => x.op === "→1").length).toBe(3);
  });
  it("(−8) × (−8) = 64", () => {
    const r = U.booth(-8, -8, 4);
    expect(r.value).toBe(64);
    expect(r.product).toBe("01000000");
  });
  it("4 / 6 / 8 位全部输入结果正确", () => {
    for (const n of [4, 6, 8]) {
      const m = 2 ** (n - 1);
      for (let x = -m; x < m; x += n === 8 ? 3 : 1) for (let y = -m; y < m; y += n === 8 ? 3 : 1) expect(U.booth(x, y, n).ok).toBe(true);
    }
  });
  it("超范围给出提示", () => {
    expect(U.booth(8, 1, 4).err).toMatch(/超出 4 位补码范围/);
    expect(U.booth(1, 1, 5).err).toBeTruthy();
  });
});

describe("海明码", () => {
  it("1010 偶校验 → 1011010", () => {
    const e = U.hammingEncode("1010", "even");
    expect(e.k).toBe(3);
    expect(e.code).toBe("1011010");
    expect(e.groups.map((g) => g.v)).toEqual([1, 0, 1]);
    expect(e.groups[0]!.covers).toEqual([3, 5, 7]);
  });
  it("第 5 位出错 → S = 101 → 第 5 位", () => {
    const c = U.hammingCheck("1011110", "even");
    expect(c.syn).toBe("101");
    expect(c.S).toBe(5);
    expect(c.pos).toBe(5);
    expect(c.corrected).toBe("1011010");
    expect(c.data).toBe("1010");
    expect(U.hammingCheck("1011010", "even").S).toBe(0);
  });
  it("任意一位出错都能定位（含奇校验）", () => {
    for (const p of ["even", "odd"]) {
      for (const d of ["1", "1101", "10011010", "1111000011110000"]) {
        const e = U.hammingEncode(d, p);
        expect(U.hammingCheck(e.code, p).S).toBe(0);
        for (let i = 1; i <= e.m; i++) {
          const rc = e.code.slice(0, i - 1) + (e.code[i - 1] === "1" ? "0" : "1") + e.code.slice(i);
          expect(U.hammingCheck(rc, p).S).toBe(i);
        }
      }
    }
  });
  it("非法输入", () => {
    expect(U.hammingEncode("10a1").err).toMatch(/0 和 1/);
    expect(U.hammingEncode("").err).toBeTruthy();
  });
});

describe("寻址方式", () => {
  it("访存次数与 EA", () => {
    const ind = U.addressing({ mode: "indirect" });
    expect(ind.count).toBe(2);
    expect(ind.ea).toBe(0x2500);
    expect(ind.operand).toBe(0x7777);
    expect(U.addressing({ mode: "imm" }).count).toBe(0);
    expect(U.addressing({ mode: "imm" }).operand).toBe(0x0200);
    expect(U.addressing({ mode: "direct" }).count).toBe(1);
    expect(U.addressing({ mode: "reg" }).count).toBe(0);
    const rel = U.addressing({ mode: "rel" });
    expect(rel.expr).toBe("EA = (PC) + A");
    expect(rel.ea).toBe(0x1000 + 0x0200);
    expect(U.addressing({ mode: "rel", A: 0xff00 }).ea).toBe(0x0f00);
    expect(U.addressing({ mode: "base" }).ea).toBe(0x3200);
    expect(U.addressing({ mode: "index" }).ea).toBe(0x0300);
    expect(U.addressing({ mode: "regind" }).ea).toBe(0x2000);
    expect(U.addressing({ mode: "xx" }).err).toBeTruthy();
  });
});

describe("磁盘调度", () => {
  const base = { req: [98, 183, 37, 122, 14, 124, 65, 67], start: 53, min: 0, max: 199, dir: "up" };
  const tot = (alg: string, dir = "up") => U.diskSchedule({ ...base, dir, alg }).total;
  it("教材序列六种算法总寻道长度", () => {
    expect(tot("fcfs")).toBe(640);
    expect(tot("sstf")).toBe(236);
    expect(tot("scan")).toBe(331);
    expect(tot("look")).toBe(299);
    expect(tot("cscan")).toBe(382);
    expect(tot("clook")).toBe(322);
  });
  it("访问顺序与平均", () => {
    const s = U.diskSchedule({ ...base, alg: "sstf" });
    expect(s.order).toEqual([65, 67, 37, 14, 98, 122, 124, 183]);
    expect(s.avg).toBe(29.5);
    const scan = U.diskSchedule({ ...base, alg: "scan" });
    expect(scan.moves.some((m) => m.to === 199 && m.kind === "end")).toBe(true);
    const cs = U.diskSchedule({ ...base, alg: "cscan" });
    expect(cs.moves.map((m) => m.to)).toEqual([65, 67, 98, 122, 124, 183, 199, 0, 14, 37]);
  });
  it("向小方向", () => {
    expect(tot("scan", "down")).toBe(236);
    expect(tot("look", "down")).toBe(208);
    expect(tot("cscan", "down")).toBe(386);
    expect(tot("clook", "down")).toBe(326);
  });
  it("非法输入", () => {
    expect(U.diskSchedule({ ...base, req: [], alg: "fcfs" }).err).toMatch(/为空/);
    expect(U.diskSchedule({ ...base, req: [250], alg: "fcfs" }).err).toMatch(/不在磁道范围/);
    expect(U.diskSchedule({ ...base, start: 300, alg: "fcfs" }).err).toBeTruthy();
  });
});

describe("动态分区分配", () => {
  const ops = U.partitionParse(U.PART_DEF).ops!;
  const sim = (alg: string) => U.partitionSim(ops, alg, 640, 40).frames;
  const at = (fr: PFrame[], label: string) => fr.find((f) => f.op && f.op.j + (f.op.free ? "-" : "+") === label)!;
  it("首次适应按脚本分配", () => {
    const f = sim("ff");
    expect(at(f, "A+").chosen).toEqual({ s: 40, z: 130 });
    expect(at(f, "D+").chosen).toEqual({ s: 330, z: 200 });
    expect(at(f, "C-").merge).toBe("up");
    expect(at(f, "C-").chosen).toEqual({ s: 170, z: 160 });
    expect(at(f, "E+").chosen).toEqual({ s: 170, z: 140 });
  });
  it("首次适应与最佳适应得到不同的空闲分区链", () => {
    const ff = sim("ff"), bf = sim("bf");
    expect(at(ff, "F+").chosen!.s).toBe(40);
    expect(at(bf, "F+").chosen!.s).toBe(530);
    expect(JSON.stringify(at(ff, "F+").free)).not.toBe(JSON.stringify(at(bf, "F+").free));
    const sizes = at(bf, "F+").free.map((x) => x.z);
    expect(sizes).toEqual([...sizes].sort((a, b) => a - b));
    const wf = sim("wf"), ws = at(wf, "F+").free.map((x) => x.z);
    expect(ws).toEqual([...ws].sort((a, b) => b - a));
  });
  it("四种合并情况", () => {
    const f = sim("ff");
    expect(at(f, "B-").merge).toBe("none");
    expect(at(f, "C-").merge).toBe("up");
    expect(at(f, "F-").merge).toBe("down");
    expect(at(f, "F-").chosen).toEqual({ s: 40, z: 130 });
    expect(at(f, "E-").merge).toBe("both");
    expect(at(f, "E-").chosen).toEqual({ s: 40, z: 290 });
    for (const fr of f) {
      const bl = fr.blocks;
      for (let i = 1; i < bl.length; i++) {
        expect(bl[i]!.s).toBe(bl[i - 1]!.s + bl[i - 1]!.z);
        expect(!bl[i]!.j && !bl[i - 1]!.j).toBe(false);
      }
    }
  });
  it("分配失败提示外部碎片", () => {
    const g = at(sim("ff"), "G+");
    expect(g.fail).toBe(true);
    expect(g.frag).toBe(true);
    expect(g.d).toMatch(/外部碎片/);
  });
  it("邻近适应从上次分配结束处继续", () => {
    const o2 = U.partitionParse("A 申请 100，B 申请 100，C 申请 100，A 释放，D 申请 50").ops!;
    const nf = U.partitionSim(o2, "nf").frames, ff = U.partitionSim(o2, "ff").frames;
    expect(nf[nf.length - 1]!.chosen!.s).toBe(340);
    expect(ff[ff.length - 1]!.chosen!.s).toBe(40);
  });
  it("输入校验", () => {
    expect(U.partitionParse("").err).toMatch(/为空/);
    expect(U.partitionParse("A 释放").err).toMatch(/释放不存在的作业/);
    expect(U.partitionParse("A 申请 10，A 申请 20").err).toMatch(/重复/);
    expect(U.partitionParse("hello world").err).toMatch(/无法识别/);
    expect(U.partitionSim([], "ff", 640, 700).err).toBeTruthy();
  });
});

describe("生产者—消费者", () => {
  it("缓冲区满时生产者阻塞在 empty，消费者 V(empty) 后被唤醒", () => {
    const f = U.pcSim({ n: 3, seq: U.PC_SCRIPT }).frames;
    const blk = f.findIndex((x) => x.pid === "P2" && x.stmt === "P(empty)" && x.procs.P2!.state === "blocked");
    expect(blk).toBeGreaterThan(0);
    expect(f[blk]!.sem.empty).toBe(-1);
    expect(f[blk]!.q.empty).toEqual(["P2"]);
    expect(f[blk]!.buf.every((b) => b !== null)).toBe(true);
    const wake = f.findIndex((x, i) => i > blk && x.pid === "C1" && x.stmt === "V(empty)");
    expect(wake).toBeGreaterThan(blk);
    expect(f[wake]!.sem.empty).toBe(0);
    expect(f[wake]!.procs.P2!.state).toBe("ready");
    expect(f[wake]!.q.empty).toEqual([]);
    const last = f[f.length - 1]!;
    expect(last.sem).toEqual({ mutex: 1, empty: 0, full: 3 });
    expect(last.deadlock).toBe(false);
  });
  it("循环缓冲区 in / out 指针", () => {
    const f = U.pcSim({ n: 3, seq: ["P1", "P1", "P1", "P1", "P1", "C1", "C1", "C1"] }).frames;
    expect(f[3]!.inp).toBe(1);
    expect(f[8]!.outp).toBe(1);
    expect(f[8]!.buf).toEqual([null, null, null]);
  });
  it("错误顺序（先 P(mutex) 后 P(empty)）导致死锁", () => {
    const f = U.pcSim({ n: 3, wrong: true, seq: U.PC_SCRIPT_BAD }).frames;
    const last = f[f.length - 1]!;
    expect(last.deadlock).toBe(true);
    expect(last.q.empty).toEqual(["P2"]);
    expect(last.q.mutex).toContain("C1");
    expect(last.d).toMatch(/死锁/);
    expect(U.pcSim({ n: 3, wrong: false, seq: U.PC_SCRIPT_BAD }).frames.some((x) => x.deadlock)).toBe(false);
  });
  it("信号量为负时绝对值等于阻塞进程数", () => {
    for (const wrong of [false, true]) {
      for (const fr of U.pcSim({ n: 2, wrong, seq: wrong ? U.PC_SCRIPT_BAD : U.PC_SCRIPT }).frames) {
        for (const s of ["mutex", "empty", "full"]) expect(fr.q[s]!.length).toBe(Math.max(0, -fr.sem[s]!));
      }
    }
  });
  it("缓冲区个数校验", () => {
    expect(U.pcSim({ n: 0, seq: [] }).err).toBeTruthy();
    expect(U.pcSim({ n: 9, seq: [] }).err).toBeTruthy();
  });
});
