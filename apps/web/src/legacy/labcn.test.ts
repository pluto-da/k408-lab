import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";
import { describe, expect, it } from "vitest";

/** 在最小沙箱里执行计网实验脚本，只测挂在 window.LABU 上的纯计算函数（不碰 DOM） */
interface Err { err?: string }
interface DivStep { i: number; win: string; q: string; sub: string; xor: string; rem: string; down: string }
interface Crc extends Err { r: number; dividend: string; steps: DivStep[]; quotient: string; remainder: string; codeword?: string; ok?: boolean }
interface Frag { i: number; start: number; end: number; len: number; off: number; mf: number; total: number }
interface IpFrag extends Err { data: number; max: number; need: boolean; drop: boolean; frags: Frag[] }
interface Route { net: number | string; len: number; hop: string; ifc: string }
interface LpmRow { net: number; len: number; mask: number; and: number; match: boolean; hop: string; ifc: string }
interface Lpm extends Err { ip: number; rows: LpmRow[]; best: number; entry: LpmRow | null; isDefault: boolean }
type Wave = "nrz" | "nrzi" | "man" | "dman";
interface Enc extends Err { n: number; waves: Record<Wave, number[]>; mid: Record<Wave, boolean[]>; start: Record<Wave, boolean[]> }
interface Backoff extends Err { k: number; giveUp: boolean; min?: number; max?: number; m?: number }
interface SimStep { kind: string; t: number; text: string; resent: number[]; deliver: number[]; sent: number[]; i: number }
interface Tx { f: boolean; i: number; seq: number; lost: boolean; re?: boolean }
interface Sim extends Err { steps: SimStep[]; retx: number[]; tx: Tx[]; finished: boolean; M: number; sw: number; rw: number; sentCount: number }
interface RipEntry { net: string; d: number; hop: string }
interface RipRow { net: string; adv: number; nd: number; act: "add" | "same" | "shorter" | "keep"; why: string }
interface RipRes { table: RipEntry[]; rows: RipRow[]; untouched: string[] }
interface Round { from: string; A: RipEntry; B: RipEntry; text: string }
interface LabU {
  parsePoly: (s: string) => { bits?: string } & Err;
  crc: (data: string, gen: string) => Crc;
  crcCheck: (recv: string, gen: string) => Crc;
  ipFrag: (total: number | string, hdr: number | string, mtu: number | string, df: boolean) => IpFrag;
  parseIp: (s: string) => number;
  ipStr: (u: number) => string;
  parseTable: (text: string) => { rows?: Route[] } & Err;
  lpm: (table: Route[], ip: string) => Lpm;
  encode: (bits: string, inv?: boolean) => Enc;
  backoff: (k: number | string, slot?: number) => Backoff;
  minFrame: (rate: number, slot: number) => { bits: number; bytes: number } & Err;
  slideSim: (o: Record<string, unknown>) => Sim;
  parseList: (s: string) => number[] & Err;
  parseRip: (text: string, withHop: boolean, who: string) => { rows?: RipEntry[] } & Err;
  ripUpdate: (table: RipEntry[], from: string, vector: { net: string; d: number }[]) => RipRes;
  ripCountInf: () => Round[];
}
interface Lab { id: string; name: string; color: string; note: string; mount: unknown }

function load() {
  const file = resolve(__dirname, "../../public/legacy/js/15-lab-cn.js");
  const win: Record<string, unknown> = { __LEGACY_LOADER__: true, addEventListener: () => undefined, LAB: [] };
  const ctx: Record<string, unknown> = { window: win, document: { readyState: "complete" }, setTimeout, Math, Number, String, parseInt, parseFloat, isNaN, Error, Object, Array, JSON, RegExp };
  win.X = { reduced: true };
  ctx.X = win.X;
  runInNewContext(
    readFileSync(file, "utf8"),
    new Proxy(ctx, {
      get: (t, k) => (k in t ? t[k as string] : win[k as string]),
      has: () => true,
      set: (t, k, v) => { t[k as string] = v; win[k as string] = v; return true; },
    }),
  );
  return { U: win.LABU as LabU, LAB: win.LAB as Lab[] };
}

const { U, LAB } = load();
const DEF_TABLE = "128.96.39.0/25 直接交付 接口0\n128.96.39.128/25 直接交付 接口1\n128.96.40.0/25 R2 接口1\n192.4.153.0/26 R3 接口2\n0.0.0.0/0 R4 接口2";

describe("计网实验注册", () => {
  it("注册 7 个实验，id 唯一且都属于计算机网络", () => {
    expect(LAB.map((d) => d.id)).toEqual(["slidewin", "csmacd", "crc", "ipfrag", "lpm", "encoding", "rip"]);
    for (const d of LAB) {
      expect(d.color).toBe("var(--x-cn)");
      expect(d.note.length).toBeGreaterThan(20);
      expect(typeof d.mount).toBe("function");
    }
  });
});

describe("CRC", () => {
  it("101001 ÷ 1101：余数 001，发送 101001001，逐步异或", () => {
    const c = U.crc("101001", "1101");
    expect(c.err).toBeUndefined();
    expect(c.r).toBe(3);
    expect(c.dividend).toBe("101001000");
    expect(c.remainder).toBe("001");
    expect(c.codeword).toBe("101001001");
    expect(c.quotient).toBe("110101");
    expect(c.steps.length).toBe(6);
    expect(c.steps[0]!.win).toBe("1010");
    expect(c.steps[0]!.xor).toBe("0111");
    expect(c.steps[1]!.win).toBe("1110");
    expect(c.steps[1]!.xor).toBe("0011");
  });
  it("多项式写法 x³+x²+1 与 1101 等价", () => {
    expect(U.parsePoly("x^3+x^2+1").bits).toBe("1101");
    expect(U.parsePoly("x³+x²+1").bits).toBe("1101");
    expect(U.parsePoly("x^4+x+1").bits).toBe("10011");
    expect(U.crc("1101011011", "x^4+x+1").remainder).toBe("1110");
  });
  it("接收端校验：101001001 余数为 0，101001011 余数非 0", () => {
    const ok = U.crcCheck("101001001", "1101");
    expect(ok.remainder).toBe("000");
    expect(ok.ok).toBe(true);
    const bad = U.crcCheck("101001011", "1101");
    expect(bad.remainder).not.toMatch(/^0+$/);
    expect(bad.ok).toBe(false);
  });
  it("非法输入给中文提示而不是抛错", () => {
    expect(U.crc("10a1", "1101").err).toMatch(/0 和 1/);
    expect(U.crc("101", "0101").err).toMatch(/最高位必须为 1/);
    expect(U.crc("", "1101").err).toBeTruthy();
    expect(U.crc("101", "y+1").err).toBeTruthy();
  });
});

describe("IP 分片", () => {
  it("4000 / 20 / 1500 → 三片", () => {
    const r = U.ipFrag(4000, 20, 1500, false);
    expect(r.err).toBeUndefined();
    expect(r.data).toBe(3980);
    expect(r.max).toBe(1480);
    expect(r.frags.map((f) => f.len)).toEqual([1480, 1480, 1020]);
    expect(r.frags.map((f) => f.off)).toEqual([0, 185, 370]);
    expect(r.frags.map((f) => f.mf)).toEqual([1, 1, 0]);
    expect(r.frags.map((f) => f.total)).toEqual([1500, 1500, 1040]);
  });
  it("DF = 1 且超过 MTU：丢弃", () => {
    const r = U.ipFrag(4000, 20, 1500, true);
    expect(r.drop).toBe(true);
    expect(r.frags).toEqual([]);
  });
  it("每片数据向下取 8 的倍数；不超过 MTU 不分片", () => {
    const r = U.ipFrag(1600, 20, 576, false);
    expect(r.max).toBe(552);
    expect(r.frags.map((f) => f.len)).toEqual([552, 552, 476]);
    expect(r.frags.map((f) => f.off)).toEqual([0, 69, 138]);
    const one = U.ipFrag(1400, 20, 1500, true);
    expect(one.need).toBe(false);
    expect(one.drop).toBe(false);
    expect(one.frags.length).toBe(1);
  });
  it("校验：MTU 不能小于首部 + 8", () => {
    expect(U.ipFrag(4000, 20, 27, false).err).toMatch(/首部长度 \+ 8/);
    expect(U.ipFrag(4000, 22, 1500, false).err).toMatch(/4 的倍数/);
    expect(U.ipFrag("abc", 20, 1500, false).err).toBeTruthy();
  });
});

describe("最长前缀匹配", () => {
  it("128.96.39.10 → /25，接口0", () => {
    const t = U.parseTable(DEF_TABLE).rows!;
    const r = U.lpm(t, "128.96.39.10");
    expect(r.rows.map((x) => x.match)).toEqual([true, false, false, false, true]);
    expect(r.best).toBe(0);
    expect(r.entry!.ifc).toBe("接口0");
    expect(U.ipStr(r.rows[1]!.and)).toBe("128.96.39.0");
  });
  it("/16 与 /24 都匹配时选 /24", () => {
    const t = U.parseTable("172.16.0.0/16 R1 接口0\n172.16.5.0/24 R2 接口1\n0.0.0.0/0 R5 接口3").rows!;
    const r = U.lpm(t, "172.16.5.10");
    expect(r.rows.filter((x) => x.match).length).toBe(3);
    expect(r.entry!.len).toBe(24);
    expect(r.entry!.hop).toBe("R2");
  });
  it("都不匹配时走默认路由 0.0.0.0/0；无默认路由则无结果", () => {
    const t = U.parseTable(DEF_TABLE).rows!;
    const r = U.lpm(t, "8.8.8.8");
    expect(r.isDefault).toBe(true);
    expect(r.entry!.hop).toBe("R4");
    const none = U.lpm(t.slice(0, 4), "8.8.8.8");
    expect(none.best).toBe(-1);
    expect(none.entry).toBeNull();
  });
  it("校验非法 IP 与主机位不为 0 的表项", () => {
    expect(U.lpm([], "300.1.1.1").err).toBeTruthy();
    expect(U.parseTable("128.96.39.5/25 R1").err).toMatch(/128\.96\.39\.0/);
    expect(U.parseTable("").err).toBeTruthy();
  });
});

describe("数字编码", () => {
  it("0110：曼彻斯特每位中间都跳变", () => {
    const e = U.encode("0110");
    expect(e.mid.man).toEqual([true, true, true, true]);
    expect(e.mid.dman).toEqual([true, true, true, true]);
    expect(e.mid.nrz).toEqual([false, false, false, false]);
    /* 站内约定：1 = 高→低 */
    expect(e.waves.man.slice(2, 4)).toEqual([1, 0]);
    expect(e.waves.man.slice(0, 2)).toEqual([0, 1]);
    expect(U.encode("0110", true).waves.man.slice(2, 4)).toEqual([0, 1]);
  });
  it("差分曼彻斯特：0 在位开始处跳变，1 不跳变", () => {
    for (const bits of ["0110", "11001010", "0000", "1111"]) {
      const e = U.encode(bits);
      bits.split("").forEach((b, i) => expect(e.start.dman[i], `${bits}[${i}]`).toBe(b === "0"));
    }
  });
  it("NRZ 高 1 低 0；NRZI 遇 1 翻转", () => {
    const e = U.encode("0110");
    expect(e.waves.nrz).toEqual([0, 0, 1, 1, 1, 1, 0, 0]);
    expect(e.start.nrzi).toEqual([false, true, true, false]);
    expect(U.encode("01x").err).toBeTruthy();
  });
});

describe("CSMA/CD", () => {
  it("退避范围与 16 次放弃", () => {
    const b3 = U.backoff(3);
    expect([b3.min, b3.max]).toEqual([0, 7]);
    const b12 = U.backoff(12);
    expect([b12.min, b12.max]).toEqual([0, 1023]);
    expect(U.backoff(10).max).toBe(1023);
    expect(U.backoff(16).giveUp).toBe(true);
    expect(U.backoff(15).giveUp).toBe(false);
    expect(U.backoff(0).err).toBeTruthy();
  });
  it("10Mb/s、2τ = 51.2μs → 最短帧 512 bit = 64 字节", () => {
    const f = U.minFrame(10, 51.2);
    expect(f.bits).toBe(512);
    expect(f.bytes).toBe(64);
  });
});

describe("滑动窗口", () => {
  const base = { bits: 3, n: 8, lost: "2" };
  it("GBN 3 位序号、窗口 7、丢第 2 帧：超时后重发 2 及其后已发的所有帧", () => {
    const s = U.slideSim({ ...base, mode: "gbn", sw: 7 });
    expect(s.err).toBeUndefined();
    const to = s.steps.filter((x) => x.kind === "to");
    expect(to.length).toBe(1);
    expect(to[0]!.resent).toEqual([2, 3, 4, 5, 6, 7]);
    expect(s.finished).toBe(true);
    expect(s.steps.every((x) => x.text.length > 0)).toBe(true);
  });
  it("GBN 窗口 4（逐步脚本）：先发 0–3，3 号帧被丢弃并重复 ACK2，超时重发 2、3、4、5", () => {
    const s = U.slideSim({ ...base, mode: "gbn", sw: 4 });
    expect(s.steps[1]!.sent).toEqual([0, 1, 2, 3]);
    const f3 = s.steps.find((x) => x.kind === "fa" && x.i === 3)!;
    expect(f3.deliver).toEqual([]);
    expect(f3.text).toMatch(/ACK2/);
    expect(s.retx).toEqual([2, 3, 4, 5]);
  });
  it("SR 只重发第 2 帧，缓存 3、4…并在 2 到达后一起交付", () => {
    const s = U.slideSim({ ...base, mode: "sr", sw: 4, rw: 4 });
    expect(s.err).toBeUndefined();
    expect(s.retx).toEqual([2]);
    const d = s.steps.find((x) => x.deliver.indexOf(2) >= 0)!;
    expect(d.deliver).toEqual([2, 3, 4, 5]);
    expect(s.finished).toBe(true);
  });
  it("停等：序号 0/1 交替，丢帧后超时重传", () => {
    const s = U.slideSim({ ...base, mode: "sw", sw: 5, rw: 5 });
    expect(s.M).toBe(2);
    expect(s.sw).toBe(1);
    expect(s.tx.filter((x) => x.f).map((x) => x.seq).slice(0, 4)).toEqual([0, 1, 0, 0]);
    expect(s.retx).toEqual([2]);
  });
  it("窗口规则校验", () => {
    expect(U.slideSim({ ...base, mode: "gbn", sw: 8 }).err).toMatch(/2\^n − 1 = 7/);
    expect(U.slideSim({ ...base, mode: "sr", sw: 4, rw: 5 }).err).toMatch(/2\^\(n−1\) = 4/);
    expect(U.slideSim({ ...base, mode: "sr", sw: 5, rw: 4 }).err).toMatch(/W_T \+ W_R ≤ 2\^n = 8/);
    expect(U.slideSim({ ...base, mode: "gbn", sw: 4, lost: "9" }).err).toMatch(/0–7/);
    expect(U.slideSim({ ...base, mode: "gbn", sw: 4, lost: "a" }).err).toBeTruthy();
  });
  it("GBN 丢 ACK1：累积确认 ACK2 弥补，无需重传", () => {
    const s = U.slideSim({ mode: "gbn", bits: 3, n: 8, sw: 4, lost: "", lostAck: "1" });
    expect(s.retx).toEqual([]);
    expect(s.tx.filter((x) => !x.f && x.lost).length).toBe(1);
    expect(s.finished).toBe(true);
  });
  it("无丢失时所有帧只发一次", () => {
    for (const mode of ["sw", "gbn", "sr"]) {
      const s = U.slideSim({ mode, bits: 3, n: 12, sw: 4, rw: 4 });
      expect(s.sentCount, mode).toBe(12);
      expect(s.finished, mode).toBe(true);
    }
  });
});

describe("RIP", () => {
  it("B 通告 N 距离 3，C 原来距离 5 经 A → 更新为 4 经 B", () => {
    const r = U.ripUpdate([{ net: "N", d: 5, hop: "A" }], "B", [{ net: "N", d: 3 }]);
    expect(r.table).toEqual([{ net: "N", d: 4, hop: "B" }]);
    expect(r.rows[0]!.act).toBe("shorter");
  });
  it("原下一跳就是 B：无论远近都更新", () => {
    expect(U.ripUpdate([{ net: "N", d: 2, hop: "B" }], "B", [{ net: "N", d: 5 }]).table).toEqual([{ net: "N", d: 6, hop: "B" }]);
    expect(U.ripUpdate([{ net: "N", d: 9, hop: "B" }], "B", [{ net: "N", d: 3 }]).table).toEqual([{ net: "N", d: 4, hop: "B" }]);
  });
  it("逐步脚本：N1 不更新、N2 替换为 3、N4 新增 4、N3 不变", () => {
    const c = U.parseRip("N1 3 A; N2 5 B; N3 2 D", true, "C").rows!;
    const v = U.parseRip("N1 4; N2 2; N4 3", false, "B").rows!;
    const r = U.ripUpdate(c, "B", v);
    expect(r.rows.map((x) => x.act)).toEqual(["keep", "same", "add"]);
    expect(r.table).toEqual([
      { net: "N1", d: 3, hop: "A" },
      { net: "N2", d: 3, hop: "B" },
      { net: "N3", d: 2, hop: "D" },
      { net: "N4", d: 4, hop: "B" },
    ]);
    expect(r.untouched).toEqual(["N3"]);
  });
  it("距离封顶 16；坏消息逐轮 +1 直到 16", () => {
    expect(U.ripUpdate([], "B", [{ net: "N", d: 16 }]).table[0]!.d).toBe(16);
    const rounds = U.ripCountInf();
    const last = rounds[rounds.length - 1]!;
    expect(last.A.d).toBe(16);
    expect(last.B.d).toBe(16);
    /* 每轮被更新一方的距离：3, 4, 5, …, 16 */
    const seq = rounds.slice(2).map((r) => (r.from === "B" ? r.A.d : r.B.d));
    expect(seq).toEqual([3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 16]);
  });
  it("RIP 输入校验", () => {
    expect(U.parseRip("N1 x A", true, "C 的路由表").err).toMatch(/1–16/);
    expect(U.parseRip("N1 3", true, "C 的路由表").err).toBeTruthy();
    expect(U.parseRip("N1 17", false, "B 的通告").err).toBeTruthy();
  });
});
