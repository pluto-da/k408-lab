// Cache 地址划分与组相联替换。划分与 LRU 的口径和实验室「Cache 地址映射」实验一致：
// 块号 = ⌊地址 / 块大小⌋，组号 = 块号 mod 组数，标记 = ⌊块号 / 组数⌋；组内先填空行，满了再按策略替换。

export type Policy = "lru" | "fifo" | "random";

export interface CacheSplit {
  lines: number;
  ways: number;
  sets: number;
  /** 块内地址位数 */
  off: number;
  /** 组号位数（直接映射时即行号位数） */
  idx: number;
  /** 标记位数 */
  tag: number;
}

const log2 = (n: number) => Math.round(Math.log2(n));

/** ways = 0 表示全相联 */
export function cacheSplit(addrBits: number, capacity: number, block: number, ways: number): CacheSplit {
  const lines = capacity / block;
  const w = ways === 0 ? lines : Math.min(ways, lines);
  const sets = lines / w;
  const off = log2(block);
  const idx = log2(sets);
  return { lines, ways: w, sets, off, idx, tag: addrBits - idx - off };
}

export interface CacheFields {
  block: number;
  set: number;
  tag: number;
  off: number;
}

export function cacheFields(addr: number, s: CacheSplit, block: number): CacheFields {
  const blk = Math.floor(addr / block);
  return { block: blk, set: blk % s.sets, tag: Math.floor(blk / s.sets), off: addr % block };
}

export interface CacheLogEntry {
  a: number;
  set: number;
  tag: number;
  off: number;
  hit: boolean;
  /** 命中或装入的路号 */
  way: number;
  /** 被替换出去的标记，没有替换时为 null */
  ev: number | null;
  /** 本次访问之后每组各路的标记 */
  snap: Record<number, number[]>;
}

interface Slot {
  tag: number;
  /** 最近一次使用 */
  t: number;
  /** 装入时刻 */
  ins: number;
}

/** 小而确定的伪随机数，随机替换可复现 */
export function lcg(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/** 依次访问 addrs，返回每次的命中情况（与实验室实验的 run 同口径，另加 FIFO 与随机替换） */
export function cacheRun(addrs: number[], s: CacheSplit, block: number, policy: Policy = "lru", seed = 1): { log: CacheLogEntry[]; hits: number } {
  const store: Record<number, Slot[]> = {};
  const rnd = lcg(seed);
  let t = 0;
  let hits = 0;
  const log: CacheLogEntry[] = [];
  for (const a of addrs) {
    const { set, tag, off } = cacheFields(a, s, block);
    const slots = store[set] ?? (store[set] = []);
    let way = slots.findIndex((x) => x.tag === tag);
    let ev: number | null = null;
    const hit = way >= 0;
    t++;
    if (hit) {
      hits++;
    } else if (slots.length < s.ways) {
      way = slots.length;
      slots.push({ tag, t, ins: t });
    } else {
      if (policy === "random") way = Math.floor(rnd() * slots.length);
      else {
        way = 0;
        for (let i = 1; i < slots.length; i++) {
          const k = policy === "fifo" ? "ins" : "t";
          if (slots[i]![k] < slots[way]![k]) way = i;
        }
      }
      ev = slots[way]!.tag;
      slots[way] = { tag, t, ins: t };
    }
    slots[way]!.t = t;
    const snap: Record<number, number[]> = {};
    for (const k of Object.keys(store)) snap[Number(k)] = store[Number(k)]!.map((x) => x.tag);
    log.push({ a, set, tag, off, hit, way, ev, snap });
  }
  return { log, hits };
}
