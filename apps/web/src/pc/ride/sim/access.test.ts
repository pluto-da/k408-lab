import { describe, expect, it } from "vitest";
import { cacheRun, cacheSplit, cacheFields } from "./cache";
import { DEFAULT_ACCESS, formulaOf, fmtNs, normalizeAccess, simulateAccess, type AccessParams } from "./access";
import { mix, parseHexAddr, hex32Spaced } from "./addr";
import { buildAccessPlan } from "../routeAccess";

const P = (patch: Partial<AccessParams> = {}): AccessParams => ({ ...DEFAULT_ACCESS, ...patch, t: { ...DEFAULT_ACCESS.t, ...(patch.t ?? {}) } });

/** 实验室「Cache 地址映射」实验里的划分与运行逻辑，逐行照搬，用来核对口径 */
const LAB_CA = {
  split(bits: number, C: number, B: number, ways: number) {
    const lines = C / B, w = ways === 0 ? lines : Math.min(ways, lines), sets = lines / w;
    const off = Math.round(Math.log2(B)), idx = Math.round(Math.log2(sets));
    return { lines, ways: w, sets, off, idx, tag: bits - idx - off };
  },
  run(addrs: number[], s: { sets: number; ways: number }, B: number) {
    const store: Record<number, { tag: number; t?: number }[]> = {};
    let t = 0, hits = 0;
    const log: { set: number; tag: number; off: number; hit: boolean; way: number; ev: number | null }[] = [];
    addrs.forEach((a) => {
      const blk = Math.floor(a / B), set = blk % s.sets, tag = Math.floor(blk / s.sets), slots = store[set] || (store[set] = []);
      let way = -1, ev: number | null = null, hit = false, i;
      for (i = 0; i < slots.length; i++) if (slots[i]!.tag === tag) { way = i; hit = true; }
      if (hit) hits++;
      else if (slots.length < s.ways) { way = slots.length; slots.push({ tag }); }
      else { way = 0; for (i = 1; i < slots.length; i++) if (slots[i]!.t! < slots[way]!.t!) way = i; ev = slots[way]!.tag; slots[way] = { tag }; }
      slots[way]!.t = ++t;
      log.push({ set, tag, off: a % B, hit, way, ev });
    });
    return { log, hits };
  },
};

describe("Cache 划分与替换（与实验室实验同口径）", () => {
  const seqs = [
    [0x0000, 0x0040, 0x4000, 0x0000, 0x8000, 0x0040, 0x4000],
    [0x1f3a7c, 0x1f3a40, 0x0a3a7c, 0x113a7c, 0x1f3a7c, 0x2a3a40, 0x003a7c, 0x1f3a7c, 0x123456, 0x0a3a7c],
  ];
  const cfgs: [number, number, number, number][] = [
    [32, 16384, 64, 1],
    [32, 16384, 64, 2],
    [24, 32768, 64, 4],
    [24, 8192, 32, 8],
    [20, 4096, 16, 0],
  ];
  for (const [bits, C, B, ways] of cfgs) {
    it(`${bits} 位地址 · ${C / 1024}KB · ${B}B · ${ways || "全"}路`, () => {
      const lab = LAB_CA.split(bits, C, B, ways);
      const mine = cacheSplit(bits, C, B, ways);
      expect(mine).toEqual(lab);
      for (const seq of seqs) {
        const a = seq.map((x) => x % 2 ** bits);
        const L = LAB_CA.run(a, lab, B);
        const M = cacheRun(a, mine, B, "lru");
        expect(M.hits).toBe(L.hits);
        expect(M.log.map(({ set, tag, off, hit, way, ev }) => ({ set, tag, off, hit, way, ev }))).toEqual(L.log);
      }
    });
  }

  it("FIFO 与 LRU 在「装满后再用一次第一块」时换出不同的行", () => {
    const s = cacheSplit(24, 32768, 64, 4);
    const at = (tag: number) => (tag * s.sets + 5) * 64;
    const seq = [at(1), at(2), at(3), at(4), at(1), at(9)];
    const lru = cacheRun(seq, s, 64, "lru").log.at(-1)!;
    const fifo = cacheRun(seq, s, 64, "fifo").log.at(-1)!;
    expect(lru.ev).toBe(2);
    expect(fifo.ev).toBe(1);
  });

  it("随机替换可复现", () => {
    const s = cacheSplit(24, 32768, 64, 4);
    const at = (tag: number) => (tag * s.sets + 5) * 64;
    const seq = [at(1), at(2), at(3), at(4), at(9)];
    expect(cacheRun(seq, s, 64, "random", 7).log.at(-1)).toEqual(cacheRun(seq, s, 64, "random", 7).log.at(-1));
  });
});

describe("一次访存 · 默认参数（第十二节示例）", () => {
  const r = simulateAccess(DEFAULT_ACCESS);
  it("虚拟地址拆分与两级页表", () => {
    expect(r.vpn).toBe(0x00402);
    expect(r.off).toBe(0xa7c);
    expect(r.ptIndex).toEqual([1, 2]);
    expect(r.ptBits).toEqual([10, 10]);
    expect(r.walk.map((w) => w.index)).toEqual([1, 2]);
  });
  it("页框 0x1F3 → 物理地址 0x1F3A7C", () => {
    expect(r.frame).toBe(0x1f3);
    expect(r.pa).toBe(0x1f3a7c);
  });
  it("L1 32KB · 4 路 · 64B：128 组，落在第 105 组", () => {
    expect(r.cache.split.sets).toBe(128);
    expect(r.cache.split).toMatchObject({ off: 6, idx: 7, tag: 11 });
    expect(r.cache.set).toBe(105);
    expect(r.cache.tag).toBe(0xf9);
    expect(r.cache.off).toBe(60);
    expect(cacheFields(0x1f3a7c, r.cache.split, 64).set).toBe(105);
  });
  it("TLB 缺失、L1 缺失、L2 命中，按 LRU 替换", () => {
    expect(r.tlb.hit).toBe(false);
    expect(r.cache.l1Hit).toBe(false);
    expect(r.cache.victimTag).not.toBeNull();
    // 此前的访问是 A B C D 再 A，LRU 换出的是 B（第 1 路）
    expect(r.cache.way).toBe(1);
    expect(r.cache.after[1]!.tag).toBe(0xf9);
  });
  it("访存 2 次，总耗时 1 + 2 × 100 + 1 + 4 = 206 ns", () => {
    expect(r.memAccesses).toBe(2);
    expect(r.totalNs).toBe(206);
    expect(formulaOf(r)).toBe("1 + 2 × 100 + 1 + 4 = 206 ns");
  });
});

describe("与实验室过程图解一致", () => {
  it("TLB 组号与标记同「TLB + Cache 地址转换」（4 路 8 组，4KB 页）", () => {
    for (const va of [0x0040a3c8, 0x00402a7c, 0x12345678, 0xc0001234]) {
      const r = simulateAccess(P({ va }));
      expect(r.tlb.set).toBe((va >>> 12) & 7);
      expect(r.tlb.tag).toBe(va >>> 15);
      expect(r.tlb.before.length).toBe(4);
    }
  });
  it("TLB 命中时目标项所在路与图解相同", () => {
    const va = 0x0040a3c8;
    const r = simulateAccess(P({ va, tlbHit: true }));
    expect(r.tlb.way).toBe(mix(va >>> 12, 3) & 3);
    expect(r.tlb.before[r.tlb.way]).toMatchObject({ valid: true, tag: va >>> 15, frame: r.frame });
  });
  it("页目录号、页表索引、页表所在页框、两级表项地址同「二级页表地址转换」", () => {
    const va = 0x00403a7c;
    const r = simulateAccess(P({ va }));
    const dir = va >>> 22, tbl = (va >>> 12) & 0x3ff;
    const ptFrame = (0x200 + (mix(dir, 1) & 0xff)) >>> 0;
    expect(r.walk[0]).toMatchObject({ index: dir, entryAddr: 0x00100000 + dir * 4, frame: ptFrame });
    expect(r.walk[1]).toMatchObject({ index: tbl, entryAddr: ((ptFrame << 12) + tbl * 4) >>> 0 });
  });
});

describe("不同参数走出不同的路", () => {
  it("TLB 命中：不查页表，省 2 × 100 ns", () => {
    const r = simulateAccess(P({ tlbHit: true }));
    expect(r.walk).toEqual([]);
    expect(r.memAccesses).toBe(0);
    expect(r.totalNs).toBe(6);
  });
  it("一级页表：只访存 1 次", () => {
    const r = simulateAccess(P({ levels: 1 }));
    expect(r.walk.length).toBe(1);
    expect(r.walk[0]!.index).toBe(0x402);
    expect(r.totalNs).toBe(1 + 100 + 1 + 4);
  });
  it("缺页：数据只能来自主存，页表查两遍", () => {
    const r = simulateAccess(P({ resident: false, outcome: "l1" }));
    expect(r.fault).toBe(true);
    expect(r.p.outcome).toBe("mem");
    expect(r.walk.at(-1)!.valid).toBe(false);
    expect(r.memAccesses).toBe(2 + 2 + 1);
    expect(r.totalNs).toBe(1 + 200 + 10_000_000 + 1 + 200 + 1 + 4 + 12 + 100);
    expect(r.diskAccesses).toBe(1);
  });
  it("TLB 命中蕴含页在主存", () => {
    expect(normalizeAccess(P({ tlbHit: true, resident: false })).resident).toBe(true);
  });
  it("L1 命中：没有替换", () => {
    const r = simulateAccess(P({ outcome: "l1" }));
    expect(r.cache.l1Hit).toBe(true);
    expect(r.cache.victimTag).toBeNull();
    expect(r.totalNs).toBe(1 + 200 + 1);
  });
  it("直接映射：512 行，行号 = 块号 mod 512", () => {
    const r = simulateAccess(P({ ways: 1 }));
    expect(r.cache.split.sets).toBe(512);
    expect(r.cache.set).toBe(Math.floor(0x1f3a7c / 64) % 512);
    expect(r.cache.l1Hit).toBe(false);
    expect(r.cache.way).toBe(0);
  });
  it("LRU 与 FIFO 换出不同的路", () => {
    const lru = simulateAccess(P({ policy: "lru" }));
    const fifo = simulateAccess(P({ policy: "fifo" }));
    expect(lru.cache.way).toBe(1);
    expect(fifo.cache.way).toBe(0);
  });
  it("8 KB 页：13 位偏移，两级 8 + 11 位", () => {
    const r = simulateAccess(P({ pageSize: 8192 }));
    expect(r.offBits).toBe(13);
    expect(r.ptBits).toEqual([8, 11]);
    expect(r.pa % 8192).toBe(0x00402a7c % 8192);
  });
  it("同时访问口径：TLB 缺失时 λ 被掩盖，Cache 只计命中那一级", () => {
    const r = simulateAccess(P({ mode: "par" }));
    expect(r.totalNs).toBe(200 + 4);
    const h = simulateAccess(P({ mode: "par", tlbHit: true, outcome: "mem" }));
    expect(h.totalNs).toBe(1 + 100);
  });
  it("访问时间可调", () => {
    const r = simulateAccess(P({ t: { tlb: 20, l1: 2, l2: 10, l3: 30, mem: 80, disk: 1000 } }));
    expect(r.totalNs).toBe(20 + 2 * 80 + 2 + 10);
  });
});

describe("路线编排", () => {
  it("默认参数：站点顺序与累计时间", () => {
    const plan = buildAccessPlan(DEFAULT_ACCESS);
    expect(plan.stations.map((s) => s.id)).toEqual(["issue", "tlb", "busOut", "ptDir", "ptTbl", "busBack", "mmu", "l1", "l2", "fill", "reg"]);
    expect(plan.stations.at(-1)!.clock).toBe(206);
    expect(plan.summary.formula).toBe("1 + 2 × 100 + 1 + 4 = 206 ns");
    const l1 = plan.stations.find((s) => s.id === "l1")!;
    expect(l1.caption).toContain("第 105 组");
    expect(l1.result).toContain("L1 缺失");
    expect(l1.caption).toContain("128 组");
    expect(plan.stations.find((s) => s.id === "mmu")!.caption).toContain("0x1F3A7C");
  });
  it("每个岔路口都有正确答案，且答案对应参数", () => {
    const plan = buildAccessPlan(P({ tlbHit: true, outcome: "l3" }));
    const forks = plan.stations.filter((s) => s.fork);
    expect(forks.map((s) => `${s.id}:${s.fork!.answer}`)).toEqual(["tlb:hit", "l1:miss", "l2:miss", "l3:hit"]);
  });
  it("缺页 + 一级页表 + 主存", () => {
    const plan = buildAccessPlan(P({ levels: 1, resident: false }));
    const ids = plan.stations.map((s) => s.id);
    expect(ids).toContain("fault");
    expect(ids).toContain("dram");
    expect(ids).toContain("ptOne");
    expect(plan.stations.at(-1)!.clock).toBe(simulateAccess(P({ levels: 1, resident: false })).totalNs);
  });
  it("站点数在 5 ~ 15 之间（最好情况 TLB 与 L1 都命中只有 5 站）", () => {
    for (const tlbHit of [true, false])
      for (const outcome of ["l1", "l2", "l3", "mem"] as const) {
        const n = buildAccessPlan(P({ tlbHit, outcome })).stations.length;
        expect(n).toBeGreaterThanOrEqual(5);
        expect(n).toBeLessThanOrEqual(15);
      }
  });
});

describe("工具", () => {
  it("地址解析与显示", () => {
    expect(parseHexAddr("0x0040 2A7C")).toBe(0x00402a7c);
    expect(parseHexAddr("zz")).toBeNull();
    expect(parseHexAddr("123456789")).toBeNull();
    expect(hex32Spaced(0x00402a7c)).toBe("0x0040 2A7C");
  });
  it("时间显示", () => {
    expect(fmtNs(206)).toBe("206 ns");
    expect(fmtNs(10_000_000)).toBe("10 ms");
    expect(fmtNs(100_000)).toBe("100 µs");
  });
});
