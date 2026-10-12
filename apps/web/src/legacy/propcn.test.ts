import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";
import { describe, expect, it } from "vitest";

/** 性质与公式 · 计算机网络（27-prop-cn.js）：注册数据、PROPU.cn 纯函数、链接存在性，并在 jsdom 里挂载每个验证动画 */
interface Err { err?: string }
interface Ex { q: string; opts: string[]; a: number; why: string; src: string }
interface Prop {
  id: string; sub: string; ch: string; name: string; def: string; stmt: string[]; cond: string;
  proof: string[]; traps: string[]; ex: Ex; links: { lab?: string[]; proc?: string[] };
  demo: (box: HTMLElement) => { destroy: () => void };
}
interface Cidr { v: number; p: number; net: number }
interface Frag { i: number; data: number; len: number; off: number; off8: number; mf: number }
interface Reno { cwnd: number; ssthresh: number; phase: string; ev: string }
interface Seg { from: string; flags: string; seq: number; ack: number | null; len: number }
interface CnU {
  nyquist(W: number, V: number): { baud: number; bits: number; rate: number };
  dbToSN(dB: number): number;
  snToDb(sn: number): number;
  shannon(W: number, dB: number): number;
  limit(W: number, V: number, dB: number): { nyquist: number; shannon: number; rate: number; by: string };
  baudOf(r: number, s: string): number;
  encode(bits: string, s: string, hl?: boolean): number[];
  delays(L: number, R: number, d: number, v: number): { tx: number; prop: number; total: number; bdp: number };
  inFlight(t: number, L: number, R: number, d: number, v: number): number;
  swU(TD: number, RTT: number, TA?: number): number;
  arqU(W: number, TD: number, RTT: number, TA?: number): number;
  needWindow(u: number, TD: number, RTT: number): number;
  seqBits(W: number, proto: string): number;
  winMax(n: number): { M: number; gbn: number; sr: number };
  winCheck(proto: string, n: number, Wt: number, Wr: number): { ok: boolean; overlap: number[]; recv: number[] };
  tauOf(d: number, v: number): number;
  minFrame(R: number, tau: number): number;
  backoff(n: number, slot?: number): { k: number; maxR: number; maxWait: number; discard: boolean };
  etherFrame(d: number): Err & { pad?: number; frame?: number };
  domains(types: Record<string, string>, links: string[][]): { collision: number; broadcast: number };
  ipParse(s: string): Err & { v?: number };
  ipStr(v: number): string;
  maskOf(p: number): number;
  parseCidr(s: string): Err & Cidr;
  subnet(a: number, p: number): { mask: number; network: number; broadcast: number; hosts: number; size: number; first: number | null; last: number | null };
  split(p: number, s: number): { subnets: number; prefix: number; hosts: number };
  aggregate(list: Cidr[]): Err & { len: number; net: number; text: string; size: number; extra: number };
  lpm(list: Cidr[], dst: number): number;
  fragment(t: number, h: number, m: number): Err & { max?: number; frags?: Frag[] };
  renoNext(st: Reno, ev: string): Reno;
  renoRun(c: number, s: number, evs: string[]): Reno[];
  throughput(rw: number, cw: number, rtt: number, bw?: number): { win: number; tp: number; cap: number };
  maxRwnd(shift?: number): number;
  tcpWalk(x: number, y: number, lens: number[]): Seg[];
}

const DIR = resolve(__dirname, "../../legacy-src/js");

function load() {
  const win: Record<string, unknown> = {};
  const NS = "http://www.w3.org/2000/svg";
  win.X = {
    reduced: true,
    svg(tag: string, attrs: Record<string, unknown>, parent?: Element) {
      const n = document.createElementNS(NS, tag);
      for (const k in attrs) n.setAttribute(k, String(attrs[k]));
      if (parent) parent.appendChild(n);
      return n;
    },
  };
  const ctx: Record<string, unknown> = {
    window: win, document, setInterval, clearInterval, setTimeout, clearTimeout,
    Error, Object, Array, JSON, Math, Number, String, parseInt, parseFloat, isNaN, isFinite,
  };
  runInNewContext(readFileSync(resolve(DIR, "27-prop-cn.js"), "utf8"), new Proxy(ctx, {
    get: (t, k) => (k in t ? t[k as string] : win[k as string]),
    has: () => true,
    set: (t, k, v) => { t[k as string] = v; win[k as string] = v; return true; },
  }));
  return { PROP: win.PROP as Prop[], U: (win.PROPU as { cn: CnU }).cn };
}

/** 从源码里收集实验 / 图解 id（LAB 注册形如 id: "x", name: "…", color；PROC 注册形如 id: "x", name: "…", sub） */
function collectIds() {
  const lab = new Set<string>(), proc = new Set<string>();
  for (const f of readdirSync(DIR).filter((x) => /\.js$/.test(x) && !/prop/.test(x))) {
    const src = readFileSync(resolve(DIR, f), "utf8");
    for (const m of src.matchAll(/id: "([a-z0-9]+)", name: "[^"]*", color/g)) if (m[1]) lab.add(m[1]);
    for (const m of src.matchAll(/id: "([a-z0-9]+)", name: "[^"]*", sub/g)) if (m[1]) proc.add(m[1]);
  }
  return { lab, proc };
}

const { PROP, U } = load();
const CN = PROP.filter((p) => p.sub === "cn");

function rng(seed: number) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}
const ip = (s: string) => { const r = U.ipParse(s); if (r.v === undefined) throw new Error(r.err); return r.v; };
const cidr = (s: string): Cidr => { const r = U.parseCidr(s); if (r.err) throw new Error(r.err); return r; };

describe("注册", () => {
  it("14 条计算机网络性质，id 唯一，字段齐全", () => {
    expect(CN.length).toBe(14);
    const ids = CN.map((p) => p.id);
    expect(new Set(ids).size).toBe(14);
    expect(ids).toEqual(["cn-nyquist", "cn-shannon", "cn-delay", "cn-arqu", "cn-window", "cn-csmacd", "cn-encoding",
      "cn-subnet", "cn-aggregate", "cn-ipfrag", "cn-cwnd", "cn-tcpthru", "cn-tcpseq", "cn-ether"]);
    for (const p of CN) {
      expect(p.id, p.id).toMatch(/^cn-[a-z0-9-]+$/);
      expect(p.ch, p.id).toMatch(/^第 [1-5] 章 /);
      for (const k of ["name", "def", "cond"] as const) expect(p[k].trim().length, `${p.id}.${k}`).toBeGreaterThan(3);
      expect(p.stmt.length, p.id).toBeGreaterThanOrEqual(1);
      expect(p.proof.length, p.id).toBeGreaterThanOrEqual(3);
      expect(p.proof.length, p.id).toBeLessThanOrEqual(8);
      expect(p.traps.length, p.id).toBeGreaterThanOrEqual(2);
      expect(p.traps.length, p.id).toBeLessThanOrEqual(3);
      expect(p.ex.opts.length, p.id).toBe(4);
      expect(new Set(p.ex.opts).size, `${p.id} 选项重复`).toBe(4);
      expect(Number.isInteger(p.ex.a) && p.ex.a >= 0 && p.ex.a <= 3, p.id).toBe(true);
      expect(p.ex.why.length, p.id).toBeGreaterThan(10);
      expect(p.ex.src, p.id).toMatch(/^(20\d{2} 年真题|典型题)$/);
      expect(typeof p.demo, p.id).toBe("function");
      for (const s of [p.def, p.cond, ...p.stmt, ...p.proof, ...p.traps, p.ex.q, p.ex.why]) expect(s).not.toMatch(/<[a-z]/i);
    }
  });

  it("相关链接都指向存在的实验和图解", () => {
    const { lab, proc } = collectIds();
    expect(lab.size).toBeGreaterThan(20);
    expect(proc.size).toBeGreaterThan(20);
    for (const p of CN) {
      for (const id of p.links.lab ?? []) expect(lab.has(id), `${p.id} → lab ${id}`).toBe(true);
      for (const id of p.links.proc ?? []) expect(proc.has(id), `${p.id} → proc ${id}`).toBe(true);
      expect((p.links.lab ?? []).length + (p.links.proc ?? []).length, p.id).toBeGreaterThan(0);
    }
  });

  it("引擎 23-prop-core.js 的 validate（存在时）不报错", () => {
    let src = "";
    try { src = readFileSync(resolve(DIR, "23-prop-core.js"), "utf8"); } catch { return; }
    const win: Record<string, unknown> = { X: { reduced: true }, addEventListener: () => undefined };
    const ctx: Record<string, unknown> = { window: win, document, setTimeout: () => 0, clearTimeout: () => undefined, setInterval, clearInterval,
      Error, Object, Array, JSON, Math, Number, String, RegExp, parseInt, parseFloat, isNaN, isFinite };
    const px = new Proxy(ctx, { get: (t, k) => (k in t ? t[k as string] : win[k as string]), has: () => true, set: (t, k, v) => { t[k as string] = v; win[k as string] = v; return true; } });
    runInNewContext(src, px);
    runInNewContext(readFileSync(resolve(DIR, "27-prop-cn.js"), "utf8"), px);
    const v = (win.PROPU as { validate?: (l: unknown[], o: object) => string[] }).validate;
    expect(typeof v).toBe("function");
    const { lab, proc } = collectIds();
    expect(v!(win.PROP as unknown[], { labIds: [...lab], procIds: [...proc] })).toEqual([]);
  });
});

describe("物理层", () => {
  it("奈奎斯特：3 kHz、V = 16 → 24 kb/s", () => {
    const r = U.nyquist(3000, 16);
    expect(r.baud).toBe(6000);
    expect(r.bits).toBeCloseTo(4, 10);
    expect(r.rate).toBeCloseTo(24000, 6);
    expect(U.nyquist(4e6, 64).rate).toBeCloseTo(48e6, 0);
  });
  it("香农：3 kHz、30 dB ≈ 29.9 kb/s；dB ↔ S/N", () => {
    expect(U.dbToSN(30)).toBeCloseTo(1000, 6);
    expect(U.snToDb(100)).toBeCloseTo(20, 10);
    const c = U.shannon(3000, 30);
    expect(c / 1000).toBeCloseTo(29.9, 1);
    expect(Math.abs(c - 29902)).toBeLessThan(1);
    const r = rng(1);
    for (let i = 0; i < 100; i++) {
      const dB = r() * 60 - 10;
      expect(U.snToDb(U.dbToSN(dB))).toBeCloseTo(dB, 8);
    }
  });
  it("取两者较小值", () => {
    const L = U.limit(4000, 8, 30);
    expect(L.nyquist).toBeCloseTo(24000, 6);
    expect(L.shannon / 1000).toBeCloseTo(39.9, 1);
    expect(L.rate).toBe(L.nyquist);
    expect(L.by).toBe("nyquist");
    expect(U.limit(3000, 1024, 10).by).toBe("shannon");
  });
  it("编码：曼彻斯特波特率翻倍，每位中间跳变", () => {
    expect(U.baudOf(10e6, "man")).toBe(20e6);
    expect(U.baudOf(10e6, "dman")).toBe(20e6);
    expect(U.baudOf(10e6, "nrz")).toBe(10e6);
    const r = rng(2);
    for (let t = 0; t < 50; t++) {
      let bits = "";
      const n = 1 + Math.floor(r() * 20);
      for (let i = 0; i < n; i++) bits += r() < 0.5 ? "0" : "1";
      for (const s of ["man", "dman"]) {
        const lv = U.encode(bits, s);
        expect(lv.length).toBe(2 * n);
        for (let i = 0; i < n; i++) expect(lv[2 * i]).not.toBe(lv[2 * i + 1]);
      }
      const nrz = U.encode(bits, "nrz");
      for (let i = 0; i < n; i++) expect(nrz[2 * i]).toBe(bits[i] === "1" ? 1 : 0);
      const dm = U.encode(bits, "dman");
      for (let i = 1; i < n; i++) expect(dm[2 * i] !== dm[2 * i - 1]).toBe(bits[i] === "0");
    }
    expect(U.encode("10", "man")).toEqual([1, 0, 0, 1]);
    expect(U.encode("10", "man", false)).toEqual([0, 1, 1, 0]);
  });
});

describe("时延", () => {
  it("发送、传播时延与时延带宽积", () => {
    const d = U.delays(8000, 1e6, 1e6, 2e8);
    expect(d.tx).toBeCloseTo(0.008, 12);
    expect(d.prop).toBeCloseTo(0.005, 12);
    expect(d.bdp).toBeCloseTo(5000, 6);
  });
  it("链路上比特数不超过 min(L, 时延带宽积)，最大值恰好达到", () => {
    const r = rng(3);
    for (let i = 0; i < 100; i++) {
      const L = 100 + r() * 1e5, R = 1e3 + r() * 1e8, dist = 1 + r() * 1e7, v = 2e8;
      const D = U.delays(L, R, dist, v), cap = Math.min(L, D.bdp);
      let mx = 0;
      for (let k = 0; k <= 200; k++) mx = Math.max(mx, U.inFlight(D.total * k / 200, L, R, dist, v));
      expect(mx).toBeLessThanOrEqual(cap * (1 + 1e-9));
      expect(U.inFlight(Math.min(D.tx, D.prop), L, R, dist, v)).toBeCloseTo(cap, 3);
      expect(U.inFlight(D.total + 1e-9, L, R, dist, v)).toBeCloseTo(0, 3);
    }
  });
});

describe("数据链路层", () => {
  it("停等与连续 ARQ 利用率（2015 年卫星链路题）", () => {
    expect(U.swU(62.5, 500)).toBeCloseTo(62.5 / 562.5, 12);
    expect(U.arqU(8, 62.5, 500)).toBeCloseTo(500 / 562.5, 12);
    expect(U.arqU(100, 62.5, 500)).toBe(1);
    expect(U.needWindow(0.8, 62.5, 500)).toBe(8);
    expect(U.seqBits(8, "gbn")).toBe(4);
    expect(U.seqBits(8, "sr")).toBe(4);
    expect(U.seqBits(7, "gbn")).toBe(3);
  });
  it("窗口上限：恰好在上限不混淆，超过 1 就混淆", () => {
    for (let n = 1; n <= 5; n++) {
      const m = U.winMax(n);
      expect(m.gbn).toBe(2 ** n - 1);
      expect(m.sr).toBe(2 ** (n - 1));
      expect(U.winCheck("gbn", n, m.gbn, 1).ok).toBe(true);
      expect(U.winCheck("gbn", n, m.gbn + 1, 1).ok).toBe(false);
      for (let wt = 1; wt <= 2 ** n; wt++) for (let wr = 1; wr <= 2 ** n; wr++) {
        expect(U.winCheck("sr", n, wt, wr).ok, `n=${n} ${wt}+${wr}`).toBe(wt + wr <= 2 ** n);
      }
    }
    const c = U.winCheck("gbn", 3, 8, 1);
    expect(c.overlap).toEqual([0]);
  });
  it("CSMA/CD：10 Mb/s、τ = 25.6 μs → 512 bit；2009 年距离题", () => {
    expect(U.minFrame(10e6, 25.6e-6)).toBeCloseTo(512, 9);
    expect(U.tauOf(5120, 2e8)).toBeCloseTo(25.6e-6, 15);
    const a = U.minFrame(1e9, U.tauOf(1000, 2e8)), b = U.minFrame(1e9, U.tauOf(920, 2e8));
    expect(a - b).toBeCloseTo(800, 6);
    const bo = U.backoff(11, 51.2e-6);
    expect(bo.k).toBe(10);
    expect(bo.maxWait).toBeCloseTo(1023 * 51.2e-6, 12);
    expect(U.backoff(4, 51.2e-6).maxWait).toBeCloseTo(768e-6, 12);
    expect(U.backoff(16).discard).toBe(true);
    expect(U.backoff(15).discard).toBe(false);
  });
  it("以太网帧长与冲突域 / 广播域", () => {
    expect(U.etherFrame(30)).toMatchObject({ pad: 16, frame: 64 });
    expect(U.etherFrame(1500)).toMatchObject({ pad: 0, frame: 1518 });
    expect(U.etherFrame(1501).err).toMatch(/分片/);
    const star = (t: string) => U.domains({ D: t, A: "host", B: "host", C: "host" }, [["D", "A"], ["D", "B"], ["D", "C"]]);
    expect(star("hub")).toMatchObject({ collision: 1, broadcast: 1 });
    expect(star("switch")).toMatchObject({ collision: 3, broadcast: 1 });
    expect(star("router")).toMatchObject({ collision: 3, broadcast: 3 });
    const mix = U.domains({ R: "router", S: "switch", H: "hub", A: "host", B: "host", H2: "hub", C: "host", E: "host" },
      [["R", "S"], ["R", "H"], ["S", "A"], ["S", "B"], ["S", "H2"], ["H", "C"], ["H", "E"]]);
    expect(mix).toMatchObject({ collision: 5, broadcast: 2 });
  });
});

describe("网络层", () => {
  it("IP 解析与错误提示", () => {
    expect(U.ipStr(ip("192.168.5.37"))).toBe("192.168.5.37");
    expect(U.ipParse("256.1.1.1").err).toMatch(/0 ~ 255/);
    expect(U.ipParse("1.2.3").err).toMatch(/格式/);
    expect(U.parseCidr("1.2.3.4/33").err).toMatch(/前缀/);
    expect(U.parseCidr("1.2.3.4").err).toMatch(/地址\/前缀/);
  });
  it("/26 → 62 台主机；2010、2023 年子网题", () => {
    const r = U.subnet(ip("192.168.5.37"), 26);
    expect(r.hosts).toBe(62);
    expect(U.ipStr(r.network)).toBe("192.168.5.0");
    expect(U.ipStr(r.broadcast)).toBe("192.168.5.63");
    const s = U.split(24, 5);
    expect(s).toMatchObject({ subnets: 32, hosts: 6, prefix: 29 });
    const q = U.subnet(ip("168.16.84.24"), 20);
    expect(U.ipStr(q.first ?? 0)).toBe("168.16.80.1");
    expect(U.ipStr(q.last ?? 0)).toBe("168.16.95.254");
    expect(U.subnet(ip("10.0.0.1"), 31).hosts).toBe(0);
    expect(U.subnet(ip("10.0.0.1"), 0).size).toBe(2 ** 32);
  });
  it("随机子网：网络地址 ≤ 地址 ≤ 广播地址，主机数 = 2^h − 2", () => {
    const r = rng(4);
    for (let i = 0; i < 100; i++) {
      const a = Math.floor(r() * 2 ** 32), p = Math.floor(r() * 31);
      const s = U.subnet(a, p);
      expect(s.network).toBeLessThanOrEqual(a);
      expect(s.broadcast).toBeGreaterThanOrEqual(a);
      expect(s.broadcast - s.network + 1).toBe(2 ** (32 - p));
      expect(s.hosts).toBe(2 ** (32 - p) - 2);
      expect((s.network & U.maskOf(p)) >>> 0).toBe(s.network);
      expect(s.network % 2 ** (32 - p)).toBe(0);
    }
  });
  it("路由聚合与最长前缀匹配", () => {
    const four = ["172.16.4.0/24", "172.16.5.0/24", "172.16.6.0/24", "172.16.7.0/24"].map(cidr);
    expect(U.aggregate(four)).toMatchObject({ text: "172.16.4.0/22", extra: 0 });
    expect(U.aggregate(["202.118.1.0/25", "202.118.1.128/25"].map(cidr)).text).toBe("202.118.1.0/24");
    const odd = U.aggregate(["172.16.5.0/24", "172.16.8.0/24"].map(cidr));
    expect(odd.text).toBe("172.16.0.0/20");
    expect(odd.extra).toBe(4096 - 512);
    const tbl = ["169.96.40.0/23", "169.96.40.0/25", "169.96.40.0/27", "0.0.0.0/0"].map(cidr);
    expect(U.lpm(tbl, ip("169.96.40.5"))).toBe(2);
    expect(U.lpm(tbl, ip("169.96.41.5"))).toBe(0);
    expect(U.lpm(tbl, ip("8.8.8.8"))).toBe(3);
  });
  it("随机聚合：聚合块包含所有块，且再长 1 位就包含不了", () => {
    const r = rng(5);
    for (let t = 0; t < 100; t++) {
      const base = Math.floor(r() * 2 ** 32), k = 1 + Math.floor(r() * 5), list: Cidr[] = [];
      for (let i = 0; i < k; i++) {
        const p = 8 + Math.floor(r() * 24), v = (base ^ Math.floor(r() * 2 ** (32 - 8))) >>> 0;
        list.push({ v, p, net: (v & U.maskOf(p)) >>> 0 });
      }
      const ag = U.aggregate(list);
      for (const c of list) {
        expect(ag.len).toBeLessThanOrEqual(c.p);
        expect((c.net & U.maskOf(ag.len)) >>> 0).toBe(ag.net);
      }
      if (ag.len < Math.min(...list.map((c) => c.p))) {
        const L = ag.len + 1, n0 = (list[0]!.net & U.maskOf(L)) >>> 0;
        expect(list.every((c) => ((c.net & U.maskOf(L)) >>> 0) === n0)).toBe(false);
      }
    }
  });
  it("IP 分片：典型题与随机校验", () => {
    const f = U.fragment(1500, 20, 820);
    expect(f.frags?.map((x) => [x.data, x.off8, x.mf])).toEqual([[800, 0, 1], [680, 100, 0]]);
    expect(U.fragment(4000, 20, 1500).frags?.map((x) => x.off8)).toEqual([0, 185, 370]);
    expect(U.fragment(1000, 20, 1500).frags?.length).toBe(1);
    expect(U.fragment(1000, 22, 500).err).toMatch(/4 的倍数/);
    expect(U.fragment(1000, 20, 27).err).toMatch(/MTU/);
    const r = rng(6);
    for (let i = 0; i < 100; i++) {
      const h = 20 + 4 * Math.floor(r() * 11), m = h + 8 + Math.floor(r() * 3000), t = h + 1 + Math.floor(r() * 20000);
      const res = U.fragment(t, h, m);
      const fr = res.frags ?? [];
      expect(fr.reduce((s, x) => s + x.data, 0)).toBe(t - h);
      fr.forEach((x, j) => {
        expect(x.len).toBeLessThanOrEqual(Math.max(m, t <= m ? t : 0));
        expect(x.off).toBe(x.off8 * 8);
        if (j < fr.length - 1) { expect(x.data % 8).toBe(0); expect(x.mf).toBe(1); } else expect(x.mf).toBe(0);
        if (j > 0) expect(x.off).toBe(fr[j - 1]!.off + fr[j - 1]!.data);
      });
    }
  });
});

describe("传输层", () => {
  it("Reno：2009 年超时题 1 → 2 → 4 → 8 → 9", () => {
    const st = U.renoNext({ cwnd: 16, ssthresh: 32, phase: "", ev: "" }, "timeout");
    expect(st).toMatchObject({ cwnd: 1, ssthresh: 8 });
    let s = st;
    const seq: number[] = [];
    for (let i = 0; i < 4; i++) { s = U.renoNext(s, "ok"); seq.push(s.cwnd); }
    expect(seq).toEqual([2, 4, 8, 9]);
    expect(U.renoNext({ cwnd: 24, ssthresh: 16, phase: "", ev: "" }, "dup3")).toMatchObject({ cwnd: 12, ssthresh: 12 });
    const run = U.renoRun(1, 16, ["ok", "ok", "ok", "ok", "ok"]);
    expect(run.map((x) => x.cwnd)).toEqual([1, 2, 4, 8, 16, 17]);
  });
  it("Reno：随机事件下 cwnd ≥ 1，慢开始不越过 ssthresh", () => {
    const r = rng(7);
    let s: Reno = { cwnd: 1, ssthresh: 16, phase: "", ev: "" };
    for (let i = 0; i < 300; i++) {
      const x = r(), ev = x < 0.08 ? "timeout" : x < 0.16 ? "dup3" : "ok";
      const n = U.renoNext(s, ev);
      expect(n.cwnd).toBeGreaterThanOrEqual(1);
      if (ev === "ok" && s.cwnd < s.ssthresh) expect(n.cwnd).toBeLessThanOrEqual(s.ssthresh);
      if (ev === "ok" && s.cwnd >= s.ssthresh) expect(n.cwnd).toBe(s.cwnd + 1);
      s = n;
    }
  });
  it("吞吐量 = min(rwnd, cwnd) / RTT", () => {
    const t = U.throughput(65535, 100000, 0.1, 100e6);
    expect(t.win).toBe(65535);
    expect(t.tp).toBeCloseTo(65535 * 8 / 0.1, 6);
    expect(t.cap).toBeCloseTo(t.tp, 6);
    expect(U.throughput(1e9, 1e9, 0.01, 1e6).cap).toBe(1e6);
    expect(U.maxRwnd(0)).toBe(65535);
    expect(U.maxRwnd(14)).toBe(65535 * 16384);
  });
  it("序号与确认号：2009 年 200 + 300 + 500 → 1000", () => {
    const s = U.tcpWalk(199, 500, [300, 500]);
    const data = s.filter((x) => x.len > 0);
    expect(data.map((x) => x.seq)).toEqual([200, 500]);
    expect(s[0]).toMatchObject({ flags: "SYN", seq: 199, ack: null });
    expect(s[1]).toMatchObject({ seq: 500, ack: 200 });
    expect(s[2]).toMatchObject({ seq: 200, ack: 501 });
    expect(s[6]).toMatchObject({ from: "S", ack: 1000 });
    const fin = s.find((x) => x.flags === "FIN, ACK" && x.from === "C");
    expect(fin?.seq).toBe(1000);
    expect(s[s.length - 1]).toMatchObject({ seq: 1001, ack: 502 });
  });
  it("序号随机校验：每段 seq = 上一段 seq + 长度（SYN/FIN 加 1）", () => {
    const r = rng(8);
    for (let i = 0; i < 100; i++) {
      const x = Math.floor(r() * 1e6), y = Math.floor(r() * 1e6), lens = Array.from({ length: Math.floor(r() * 4) }, () => 1 + Math.floor(r() * 1460));
      const segs = U.tcpWalk(x, y, lens);
      let nc = x, ns = y;
      for (const g of segs) {
        if (g.from === "C") { expect(g.seq).toBe(nc); nc += g.len + (/SYN|FIN/.test(g.flags) ? 1 : 0); }
        else { expect(g.seq).toBe(ns); ns += g.len + (/SYN|FIN/.test(g.flags) ? 1 : 0); }
      }
    }
  });
});

describe("验证动画（jsdom）", () => {
  for (const id of ["cn-nyquist", "cn-shannon", "cn-delay", "cn-arqu", "cn-window", "cn-csmacd", "cn-encoding", "cn-subnet", "cn-aggregate", "cn-ipfrag", "cn-cwnd", "cn-tcpthru", "cn-tcpseq", "cn-ether"]) {
    it(`${id}：挂载、改参数、点按钮、报错、销毁`, () => {
      const p = CN.find((x) => x.id === id);
      if (!p) throw new Error(id);
      const box = document.createElement("div");
      document.body.appendChild(box);
      const inst = p.demo(box);
      const svg = box.querySelector("svg");
      expect(svg, "有 SVG").not.toBeNull();
      const vb = (svg?.getAttribute("viewBox") ?? "").split(" ").map(Number);
      expect(vb[2]).toBeLessThanOrEqual(720);
      for (const t of Array.from(box.querySelectorAll("text"))) expect(Number(t.getAttribute("font-size"))).toBeGreaterThanOrEqual(13);
      expect(box.querySelector(".x-pq__err")).toBeNull();
      expect((box.querySelector(".x-pq__out")?.textContent ?? "").length).toBeGreaterThan(5);
      const btns = Array.from(box.querySelectorAll<HTMLButtonElement>("button"));
      expect(btns.every((b) => b.classList.contains("x-lab__btn"))).toBe(true);
      for (const b of btns) { b.click(); b.click(); }
      for (const b of btns.filter((x) => x.hasAttribute("aria-pressed") && x.getAttribute("aria-pressed") === "true" && /暂停|自动/.test(x.textContent ?? ""))) b.click();
      expect(box.querySelector("svg")).not.toBeNull();
      const range = box.querySelector<HTMLInputElement>("input[type=range]");
      if (range) { range.value = range.max; range.dispatchEvent(new Event("input")); expect(box.querySelector(".x-pq__err")).toBeNull(); }
      const inp = box.querySelector<HTMLInputElement>("input[type=text], textarea");
      if (inp) {
        const old = inp.value;
        inp.value = "abc#";
        inp.dispatchEvent(new Event("input"));
        const e = box.querySelector(".x-pq__err");
        expect(e, "非法输入给出中文提示").not.toBeNull();
        expect(e?.textContent ?? "").toMatch(/[\u4e00-\u9fa5]/);
        inp.value = old;
        inp.dispatchEvent(new Event("input"));
        expect(box.querySelector(".x-pq__err")).toBeNull();
      }
      inst.destroy();
      expect(box.children.length).toBe(0);
      box.remove();
    });
  }

  it("cn-delay 播放后销毁会清掉定时器", () => {
    const p = CN.find((x) => x.id === "cn-delay")!;
    const box = document.createElement("div");
    const inst = p.demo(box);
    const play = Array.from(box.querySelectorAll("button")).find((b) => b.textContent === "播放")!;
    play.click();
    expect(play.getAttribute("aria-pressed")).toBe("true");
    inst.destroy();
    expect(box.children.length).toBe(0);
  });

  it("cn-window 超限时显示混淆", () => {
    const p = CN.find((x) => x.id === "cn-window")!;
    const box = document.createElement("div");
    const inst = p.demo(box);
    expect(box.textContent).toMatch(/会混淆/);
    Array.from(box.querySelectorAll("button")).find((b) => b.textContent === "取上限")!.click();
    expect(box.textContent).toMatch(/不会混淆/);
    inst.destroy();
  });
});
