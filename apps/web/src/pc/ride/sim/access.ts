// 路线一「一次访存」的模拟器：虚拟地址 → TLB → 页表 → 物理地址 → Cache 各级 → 主存 → 寄存器。
// 纯函数：输入参数，输出这次访问经过的每一步与时间开销；画面只负责按结果播放。
//
// 口径（与实验室一致）：
// - 虚拟地址 32 位，页表项 4 B，页目录基址 0x0010 0000（二级页表地址转换图解）；
// - TLB 4 路组相联、8 组：组号 = 虚页号低 3 位，标记 = 其余高位（TLB + Cache 地址转换图解）；
// - 物理地址 24 位；Cache 划分与 LRU 同「Cache 地址映射」实验；
// - 页表项按访问主存计时；时间分「先查后访」与「同时访问」两种口径（有效访问时间性质卡）。
import { cacheFields, cacheRun, cacheSplit, type CacheSplit, type Policy } from "./cache";
import { log2i, mix } from "./addr";

export type CacheOutcome = "l1" | "l2" | "l3" | "mem";
export type LookupMode = "seq" | "par";
export type { Policy };

export interface AccessTimes {
  tlb: number;
  l1: number;
  l2: number;
  l3: number;
  mem: number;
  disk: number;
}

export interface AccessParams {
  va: number;
  pageSize: number;
  tlbHit: boolean;
  levels: 1 | 2;
  /** 该页是否在主存（否 = 缺页） */
  resident: boolean;
  l1Size: number;
  blockSize: number;
  /** 相联度：1 = 直接映射 */
  ways: number;
  policy: Policy;
  /** 数据在哪一级找到 */
  outcome: CacheOutcome;
  mode: LookupMode;
  t: AccessTimes;
}

export const VA_BITS = 32;
export const PA_BITS = 24;
export const PTE_BYTES = 4;
export const PDBR = 0x00100000;
export const TLB_SETS = 8;
export const TLB_WAYS = 4;

export const PAGE_SIZES = [4096, 8192, 16384];
export const L1_SIZES = [8192, 16384, 32768, 65536];
export const BLOCK_SIZES = [16, 32, 64, 128];
export const WAY_OPTIONS = [1, 2, 4, 8];

/** 默认时间（纳秒）：寄存器与 L1 约 1，L2 约 4，L3 约 12，主存约 100，TLB 约 1，机械硬盘约 10 ms */
export const DEFAULT_TIMES: AccessTimes = { tlb: 1, l1: 1, l2: 4, l3: 12, mem: 100, disk: 10_000_000 };

export const DEFAULT_ACCESS: AccessParams = {
  va: 0x00402a7c,
  pageSize: 4096,
  tlbHit: false,
  levels: 2,
  resident: true,
  l1Size: 32768,
  blockSize: 64,
  ways: 4,
  policy: "lru",
  outcome: "l2",
  mode: "seq",
  t: { ...DEFAULT_TIMES },
};

/** 把互相矛盾的组合改成合理的：TLB 命中说明页一定在主存；缺页时数据刚调入，各级 Cache 都没有 */
export function normalizeAccess(p: AccessParams): AccessParams {
  const q: AccessParams = { ...p, t: { ...p.t } };
  q.va = q.va >>> 0;
  if (!PAGE_SIZES.includes(q.pageSize)) q.pageSize = 4096;
  if (!L1_SIZES.includes(q.l1Size)) q.l1Size = 32768;
  if (!BLOCK_SIZES.includes(q.blockSize)) q.blockSize = 64;
  if (!WAY_OPTIONS.includes(q.ways)) q.ways = 4;
  if (q.levels !== 1 && q.levels !== 2) q.levels = 2;
  if (q.tlbHit) q.resident = true;
  if (!q.resident) q.outcome = "mem";
  for (const k of Object.keys(q.t) as (keyof AccessTimes)[]) {
    const v = Number(q.t[k]);
    q.t[k] = Number.isFinite(v) && v >= 0 ? v : DEFAULT_TIMES[k];
  }
  return q;
}

export interface TlbEntry {
  valid: boolean;
  tag: number;
  frame: number;
}

export interface PtRow {
  idx: number;
  valid: boolean;
  /** 页目录项：二级页表所在页框；页表项：数据页的页框 */
  frame: number;
}

export interface WalkLevel {
  /** 第几次查表（1 起） */
  level: number;
  /** 这一级叫什么 */
  name: "页目录" | "二级页表" | "页表";
  index: number;
  indexBits: number;
  base: number;
  entryAddr: number;
  rows: PtRow[];
  hi: number;
  valid: boolean;
  frame: number;
}

export interface CacheLine {
  valid: boolean;
  dirty: boolean;
  tag: number;
}

export interface TimeTerm {
  key: "tlb" | "walk" | "fault" | "tlb2" | "walk2" | "l1" | "l2" | "l3" | "mem";
  label: string;
  ns: number;
  /** 代入式里的写法，如 "2 × 100" */
  expr: string;
}

export interface AccessResult {
  p: AccessParams;
  va: number;
  offBits: number;
  vpnBits: number;
  vpn: number;
  off: number;
  /** 二级页表时 [页目录号, 页表索引]，一级时 [虚页号] */
  ptIndex: number[];
  ptBits: number[];
  frameBits: number;
  frame: number;
  pa: number;
  tlb: { set: number; tag: number; tagBits: number; hit: boolean; way: number; before: TlbEntry[]; after: TlbEntry[] };
  walk: WalkLevel[];
  fault: boolean;
  cache: {
    split: CacheSplit;
    set: number;
    tag: number;
    off: number;
    history: number[];
    before: CacheLine[];
    after: CacheLine[];
    l1Hit: boolean;
    way: number;
    victimTag: number | null;
    outcome: CacheOutcome;
  };
  dram: { bank: number; row: number; col: number };
  terms: TimeTerm[];
  totalNs: number;
  memAccesses: number;
  diskAccesses: number;
}

const mod = (a: number, m: number) => ((a % m) + m) % m;

/** 演示进程的页表：虚页号到页框号是一一对应的线性映射（虚页 0x00402 落在页框 0x1F3） */
export function frameOf(vpn: number, frameBits: number): number {
  return mod(0x1f3 + (vpn - 0x402) * 0x2a5, 2 ** frameBits);
}

/** 二级页表所在的页框（与实验室二级页表图解相同） */
export const ptFrameOf = (dir: number) => (0x200 + (mix(dir, 1) & 0xff)) >>> 0;

function near(i: number, max: number, row: (k: number) => PtRow): { rows: PtRow[]; hi: number } {
  const rows: PtRow[] = [];
  let hi = 0;
  for (let k = i - 1; k <= i + 1; k++) {
    if (k < 0 || k > max) continue;
    if (k === i) hi = rows.length;
    rows.push(row(k));
  }
  return { rows, hi };
}

export function simulateAccess(input: AccessParams): AccessResult {
  const p = normalizeAccess(input);
  const va = p.va;
  const offBits = log2i(p.pageSize);
  const vpnBits = VA_BITS - offBits;
  const vpn = Math.floor(va / p.pageSize);
  const off = va % p.pageSize;
  const frameBits = PA_BITS - offBits;
  const frame = frameOf(vpn, frameBits);
  const pa = frame * p.pageSize + off;
  const n = p.levels;

  // ---- TLB（4 路 × 8 组）
  const tset = vpn & (TLB_SETS - 1);
  const tagBits = vpnBits - log2i(TLB_SETS);
  const tmask = 2 ** tagBits - 1;
  const ttag = Math.floor(vpn / TLB_SETS);
  const hitWay = mix(vpn, 3) & 3;
  const before: TlbEntry[] = [];
  for (let i = 0; i < TLB_WAYS; i++) {
    const mine = p.tlbHit && i === hitWay;
    const other = (ttag ^ ((mix(vpn, 11 + i) & tmask) | 1)) & tmask;
    const tg = mine ? ttag : other;
    before.push({ valid: mine ? true : (mix(vpn, 20 + i) & 3) !== 0, tag: tg, frame: mine ? frame : mix(tg, 5) & (2 ** frameBits - 1) });
  }
  let fillWay = hitWay;
  if (!p.tlbHit) {
    const free = before.findIndex((e) => !e.valid);
    if (free >= 0) fillWay = free;
  }
  const after = before.map((e, i) => (!p.tlbHit && i === fillWay ? { valid: true, tag: ttag, frame } : { ...e }));

  // ---- 页表
  const lowBits = log2i(p.pageSize / PTE_BYTES);
  const ptBits = n === 2 ? [vpnBits - lowBits, lowBits] : [vpnBits];
  const dir = n === 2 ? Math.floor(vpn / 2 ** lowBits) : 0;
  const tbl = n === 2 ? vpn % 2 ** lowBits : vpn;
  const ptIndex = n === 2 ? [dir, tbl] : [vpn];
  const walk: WalkLevel[] = [];
  if (!p.tlbHit) {
    const leafRow = (k: number): PtRow => {
      const v = n === 2 ? dir * 2 ** lowBits + k : k;
      if (k === tbl) return { idx: k, valid: p.resident, frame: p.resident ? frame : 0 };
      return { idx: k, valid: true, frame: frameOf(v, frameBits) };
    };
    if (n === 2) {
      const ptFrame = ptFrameOf(dir);
      const pd = near(dir, 2 ** ptBits[0]! - 1, (k) => ({ idx: k, valid: true, frame: k === dir ? ptFrame : ptFrameOf(k) }));
      walk.push({ level: 1, name: "页目录", index: dir, indexBits: ptBits[0]!, base: PDBR, entryAddr: PDBR + dir * PTE_BYTES, rows: pd.rows, hi: pd.hi, valid: true, frame: ptFrame });
      const base = ptFrame * p.pageSize;
      const pt = near(tbl, 2 ** lowBits - 1, leafRow);
      walk.push({ level: 2, name: "二级页表", index: tbl, indexBits: lowBits, base, entryAddr: base + tbl * PTE_BYTES, rows: pt.rows, hi: pt.hi, valid: p.resident, frame });
    } else {
      const pt = near(vpn, 2 ** vpnBits - 1, leafRow);
      walk.push({ level: 1, name: "页表", index: vpn, indexBits: vpnBits, base: PDBR, entryAddr: PDBR + vpn * PTE_BYTES, rows: pt.rows, hi: pt.hi, valid: p.resident, frame });
    }
  }
  const fault = !p.resident;

  // ---- L1 Cache：先放一段「此前的访问」把目标组装满，再访问目标块，看命中与替换
  const split = cacheSplit(PA_BITS, p.l1Size, p.blockSize, p.ways);
  const f = cacheFields(pa, split, p.blockSize);
  const w = split.ways;
  const tagMod = 2 ** split.tag;
  const addrOf = (tag: number) => (tag * split.sets + f.set) * p.blockSize;
  const others = Array.from({ length: w }, (_, k) => mod(f.tag + 1 + (k + 1) * 0x35, tagMod));
  const l1Hit = p.outcome === "l1";
  const seq = others.map((t, k) => (l1Hit && k === Math.min(1, w - 1) ? f.tag : t));
  if (w > 1) seq.push(seq[0]!);
  const history = seq.map(addrOf);
  const run = cacheRun([...history, pa], split, p.blockSize, p.policy, mix(pa, 9));
  const prevSnap = run.log[run.log.length - 2]?.snap[f.set] ?? [];
  const last = run.log[run.log.length - 1]!;
  const dirtyWay = w > 1 ? (last.way + 1) % w : -1;
  const linesOf = (tags: number[], isAfter: boolean): CacheLine[] =>
    Array.from({ length: w }, (_, i) => ({ valid: i < tags.length, tag: tags[i] ?? 0, dirty: i === dirtyWay && !(isAfter && !last.hit && i === last.way) }));

  // ---- 主存颗粒里的行列（演示用：8 KB 一行、8 B 一列）
  const dram = { bank: (pa >>> 13) & 7, row: (pa >>> 16) & 0xff, col: (pa >>> 3) & 0x3ff };

  // ---- 时间
  const t = p.t;
  const terms: TimeTerm[] = [];
  const walkTerm = (key: "walk" | "walk2", label: string): TimeTerm => ({ key, label, ns: n * t.mem, expr: n > 1 ? `${n} × ${t.mem}` : `${t.mem}` });
  const par = p.mode === "par";
  if (p.tlbHit || !par) terms.push({ key: "tlb", label: "查 TLB", ns: t.tlb, expr: `${t.tlb}` });
  if (!p.tlbHit) terms.push(walkTerm("walk", `查页表（${n} 级）`));
  if (fault) {
    terms.push({ key: "fault", label: "缺页：从外存调入这一页", ns: t.disk, expr: `${t.disk}` });
    if (!par) terms.push({ key: "tlb2", label: "重新执行：再查 TLB", ns: t.tlb, expr: `${t.tlb}` });
    terms.push(walkTerm("walk2", "重新执行：再查页表"));
  }
  const order: CacheOutcome[] = ["l1", "l2", "l3", "mem"];
  const reach = order.indexOf(p.outcome);
  const lvl: { key: "l1" | "l2" | "l3" | "mem"; label: string; ns: number }[] = [
    { key: "l1", label: "查 L1", ns: t.l1 },
    { key: "l2", label: "查 L2", ns: t.l2 },
    { key: "l3", label: "查 L3", ns: t.l3 },
    { key: "mem", label: "访问主存取整块", ns: t.mem },
  ];
  if (par) {
    const L = lvl[reach]!;
    terms.push({ key: L.key, label: `${L.label}（各级同时查找，只计命中那一级）`, ns: L.ns, expr: `${L.ns}` });
  } else {
    for (let i = 0; i <= reach; i++) terms.push({ key: lvl[i]!.key, label: lvl[i]!.label, ns: lvl[i]!.ns, expr: `${lvl[i]!.ns}` });
  }
  const totalNs = terms.reduce((s, x) => s + x.ns, 0);
  const memAccesses = (p.tlbHit ? 0 : n) + (fault ? n : 0) + (p.outcome === "mem" ? 1 : 0);

  return {
    p,
    va,
    offBits,
    vpnBits,
    vpn,
    off,
    ptIndex,
    ptBits,
    frameBits,
    frame,
    pa,
    tlb: { set: tset, tag: ttag, tagBits, hit: p.tlbHit, way: p.tlbHit ? hitWay : fillWay, before, after },
    walk,
    fault,
    cache: {
      split,
      set: f.set,
      tag: f.tag,
      off: f.off,
      history,
      before: linesOf(prevSnap, false),
      after: linesOf(last.snap[f.set] ?? [], true),
      l1Hit: last.hit,
      way: last.way,
      victimTag: last.ev,
      outcome: p.outcome,
    },
    dram,
    terms,
    totalNs,
    memAccesses,
    diskAccesses: fault ? 1 : 0,
  };
}

/** 代入式：「1 + 2 × 100 + 1 + 4 = 206 ns」 */
export function formulaOf(r: AccessResult): string {
  return `${r.terms.map((x) => x.expr).join(" + ")} = ${fmtNum(r.totalNs)} ns`;
}

export function fmtNum(n: number): string {
  if (Number.isInteger(n)) return n.toLocaleString("en-US").replace(/,/g, " ");
  return String(Math.round(n * 100) / 100);
}

/** 人读的时间：206 ns、100 µs、10.0 ms */
export function fmtNs(ns: number): string {
  if (ns < 1000) return `${fmtNum(Math.round(ns * 100) / 100)} ns`;
  if (ns < 1e6) return `${(ns / 1000).toFixed(ns < 1e4 ? 2 : 1).replace(/\.0+$/, "")} µs`;
  return `${(ns / 1e6).toFixed(ns < 1e7 ? 2 : 1).replace(/\.0+$/, "")} ms`;
}
