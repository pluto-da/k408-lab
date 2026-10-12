import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";
import { describe, expect, it } from "vitest";

/** 在最小沙箱里执行数据结构实验（三）脚本，只测 window.LABU 上的纯计算函数 */
interface Err { err?: string }
interface Frac { num: number; den: number; val: number; text: string; expr: string; full: string }
interface HashRec { key: number; h: number; probes: number[]; cmp: number; pos: number; rank?: number }
interface HashRes extends Err {
  recs: HashRec[]; table: (number | null)[]; chains: number[][]; succ: Frac; fail2: Frac & { rule: string };
  per: { a: number; probes: number[]; cnt: number }[]; frames: { d: string }[]; fail?: string; total: number;
}
interface Bs { found: boolean; pos: number; cmps: number; path: number[]; steps: { low: number; high: number; mid: number }[] }
interface BsTree { root: number; depth: number; levels: number[]; succ: Frac; fail: Frac; ext: unknown[]; nodes: ({ i: number; d: number; l: number; r: number } | undefined)[] }
interface Pass { before: number[]; after: number[]; beforeIds: number[]; afterIds: number[] }
interface Shell extends Err { incs: number[]; passes: (Pass & { d: number; groups: number[][] })[]; result: number[] }
interface Radix extends Err { d: number; passes: (Pass & { k: number; dist: { v: number; id: number; q: number }[]; queues: number[][] })[]; result: number[]; resultIds: number[] }
interface Plain extends Err { passes: Pass[]; result: number[]; resultIds: number[]; cmps: number }
interface LabU {
  dsParseInts(s: string, o?: Record<string, unknown>): Err & { v?: number[] };
  dsHash(o: { keys: number[]; p: number; m: number; method: string; empty?: string }): HashRes;
  dsBsearch(a: number[], k: number): Bs;
  dsBsTree(n: number): BsTree;
  dsShell(a: number[], incs?: number[] | null): Shell;
  dsShellIncs(n: number): number[];
  dsSelect(a: number[]): Plain;
  dsBinInsert(a: number[]): Plain;
  dsRadix(a: number[]): Radix;
}
interface Lab { id: string; color: string; name: string; mount: unknown }

function load() {
  const file = resolve(__dirname, "../../legacy-src/js/21-lab-ds3.js");
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
const CLS = [25, 8, 41, 17, 30, 64, 3, 52, 77, 16, 49, 36];
const sortedCopy = (a: number[]) => a.slice().sort((x, y) => x - y);
function rnd(n: number, max: number, seed: number) {
  let s = seed;
  const out: number[] = [];
  for (let i = 0; i < n; i++) { s = (s * 1103515245 + 12345) % 2147483648; out.push(s % max); }
  return out;
}

describe("实验注册", () => {
  it("注册 hash / bsearch / sort2，均属数据结构", () => {
    expect(LAB.map((l) => l.id)).toEqual(["hash", "bsearch", "sort2"]);
    expect(LAB.every((l) => l.color === "var(--x-ds)")).toBe(true);
    expect(LAB[2]!.name).toBe("排序补充（希尔/选择/折半插入/基数）");
    for (const l of LAB) expect(typeof l.mount).toBe("function");
  });
});

describe("散列表", () => {
  it("示例一线性探测：比较次数之和 20，ASL成功 = 20/12 = 5/3", () => {
    const r = U.dsHash({ keys: CLS, p: 13, m: 16, method: "linear" });
    expect(r.err).toBeUndefined();
    expect(r.total).toBe(20);
    expect(r.succ.full).toContain("20/12 = 5/3");
    expect(r.recs.map((x) => x.cmp)).toEqual([1, 1, 1, 1, 2, 2, 1, 1, 3, 4, 1, 2]);
    expect(r.recs.find((x) => x.key === 16)!.probes).toEqual([3, 4, 5, 6]);
    expect(r.recs.find((x) => x.key === 16)!.pos).toBe(6);
    expect(r.table[1]).toBeNull();
  });
  it("线性探测 ASL失败：常见约定（空位计 1 次）42/13，不计空位 29/13", () => {
    const std = U.dsHash({ keys: CLS, p: 13, m: 16, method: "linear" });
    expect(U.dsHash({ keys: CLS, p: 13, m: 16, method: "linear", empty: "std" }).fail2.num).toBe(42);
    /* 旧版本或无法识别的选项值按常见约定处理（向后兼容） */
    expect(U.dsHash({ keys: CLS, p: 13, m: 16, method: "linear", empty: "legacy" }).fail2.num).toBe(42);
    expect(U.dsHash({ keys: CLS, p: 13, m: 13, method: "chain", empty: "legacy" }).fail2.num).toBe(12);
    expect(std.fail2.num).toBe(42);
    expect(std.fail2.den).toBe(13);
    expect(std.per[0]!.cnt).toBe(2);
    expect(std.per[1]!.cnt).toBe(1);
    const no = U.dsHash({ keys: CLS, p: 13, m: 16, method: "linear", empty: "no" });
    expect(no.fail2.num).toBe(29);
    expect(no.fail2.num).toBe(std.fail2.num - 13);
  });
  it("拉链法：ASL成功 = 18/12 = 1.5，ASL失败（常见约定，不计空指针）= 12/13", () => {
    const r = U.dsHash({ keys: CLS, p: 13, m: 13, method: "chain" });
    expect(r.succ.num).toBe(18);
    expect(r.succ.val).toBe(1.5);
    expect(r.chains[12]).toEqual([25, 64, 77]);
    expect(r.fail2.num).toBe(12);
    expect(r.fail2.den).toBe(13);
    const y = U.dsHash({ keys: CLS, p: 13, m: 13, method: "chain", empty: "yes" });
    expect(y.fail2.num).toBe(25);
  });
  it("平方探测：探测序列按 0, +1², −1², +2² … 取模表长", () => {
    const r = U.dsHash({ keys: CLS, p: 13, m: 16, method: "quad" });
    expect(r.err).toBeUndefined();
    expect(r.fail).toBeUndefined();
    expect(r.recs.find((x) => x.key === 64)!.probes).toEqual([12, 13]);
    expect(r.recs.find((x) => x.key === 77)!.probes).toEqual([12, 13, 11]);
    const placed = r.table.filter((v) => v !== null);
    expect(sortedCopy(placed as number[])).toEqual(sortedCopy(CLS));
    expect(r.recs.reduce((s, x) => s + x.cmp, 0)).toBe(r.succ.num);
  });
  it("平方探测找不到空位时报告", () => {
    const r = U.dsHash({ keys: [0, 5, 10, 15], p: 5, m: 5, method: "quad" });
    expect(r.fail).toContain("无法为关键字 15");
  });
  it("输入校验", () => {
    expect(U.dsHash({ keys: [1, 2, 1], p: 3, m: 5, method: "linear" }).err).toContain("重复");
    expect(U.dsHash({ keys: [1, 2, 3, 4], p: 3, m: 3, method: "linear" }).err).toContain("表长");
    expect(U.dsHash({ keys: [1, 2], p: 7, m: 5, method: "linear" }).err).toContain("大于表长");
    expect(U.dsHash({ keys: Array.from({ length: 16 }, (_, i) => i), p: 17, m: 20, method: "linear" }).err).toContain("最多 15");
    expect(U.dsParseInts("1, 2，3、4 5").v).toEqual([1, 2, 3, 4, 5]);
    expect(U.dsParseInts("1, 2, 2", { noDup: true }).err).toContain("重复");
    expect(U.dsParseInts("1, x").err).toContain("不是整数");
  });
});

describe("折半查找与判定树", () => {
  const A = [7, 15, 22, 29, 34, 48, 53, 61, 70, 83, 96];
  it("n = 11：ASL成功 = 33/11 = 3，树深 4，各层 1/2/4/4", () => {
    const t = U.dsBsTree(11);
    expect(t.succ.num).toBe(33);
    expect(t.succ.val).toBe(3);
    expect(t.succ.full).toContain("(1×1 + 2×2 + 3×4 + 4×4)/11");
    expect(t.depth).toBe(4);
    expect(t.levels.slice(1)).toEqual([1, 2, 4, 4]);
    expect(t.root).toBe(6);
    expect(t.ext.length).toBe(12);
    expect(t.fail.num).toBe(44);
    expect(t.fail.den).toBe(12);
  });
  it("查找过程：查 29 成功（6 → 3 → 4），查 85 失败", () => {
    const s = U.dsBsearch(A, 29);
    expect(s.found).toBe(true);
    expect(s.path).toEqual([6, 3, 4]);
    expect(s.pos).toBe(4);
    const f = U.dsBsearch(A, 85);
    expect(f.found).toBe(false);
    expect(f.path).toEqual([6, 9, 10, 11]);
    expect(f.cmps).toBe(4);
  });
  it("任意 n：判定树结点在每层上的比较次数之和 = 各元素查找的比较次数之和", () => {
    for (let n = 1; n <= 15; n++) {
      const a = Array.from({ length: n }, (_, i) => i * 3 + 1);
      const t = U.dsBsTree(n);
      let sum = 0;
      for (const k of a) sum += U.dsBsearch(a, k).cmps;
      expect(t.succ.num).toBe(sum);
      expect(t.depth).toBe(Math.ceil(Math.log2(n + 1)));
    }
  });
});

describe("排序补充", () => {
  function groupedInsertion(a: number[], d: number) {
    const b = a.slice();
    for (let g = 0; g < d; g++) {
      const idx: number[] = [];
      for (let j = g; j < b.length; j += d) idx.push(j);
      const vals = idx.map((i) => b[i]!);
      for (let i = 1; i < vals.length; i++) { const t = vals[i]!; let j = i - 1; while (j >= 0 && vals[j]! > t) { vals[j + 1] = vals[j]!; j--; } vals[j + 1] = t; }
      idx.forEach((i, k) => { b[i] = vals[k]!; });
    }
    return b;
  }
  it("希尔：默认增量 n/2 逐次减半，示例一增量 5,3,1 每趟结果", () => {
    expect(U.dsShellIncs(10)).toEqual([5, 2, 1]);
    const r = U.dsShell([52, 17, 83, 36, 9, 64, 41, 28, 75, 17], [5, 3, 1]);
    expect(r.passes[0]!.after).toEqual([52, 17, 28, 36, 9, 64, 41, 83, 75, 17]);
    expect(r.passes[1]!.after).toEqual([17, 9, 28, 36, 17, 64, 41, 83, 75, 52]);
    expect(r.result).toEqual([9, 17, 17, 28, 36, 41, 52, 64, 75, 83]);
    expect(U.dsShell([3, 2, 1], [2, 2, 1]).err).toContain("递减");
    expect(U.dsShell([3, 2, 1], [2]).err).toContain("1");
  });
  it("希尔每一趟后的序列 = 按增量分组直接插入的结果（随机数组）", () => {
    for (let s = 1; s <= 40; s++) {
      const a = rnd(2 + (s % 14), 100, s);
      const r = U.dsShell(a);
      expect(r.err).toBeUndefined();
      for (const p of r.passes) expect(p.after).toEqual(groupedInsertion(p.before, p.d));
      expect(r.result).toEqual(sortedCopy(a));
    }
  });
  it("四种排序在随机数组上都得到有序结果；选择每趟定一个最小值", () => {
    for (let s = 1; s <= 40; s++) {
      const a = rnd(2 + (s % 14), 1000, s * 7);
      const exp = sortedCopy(a);
      expect(U.dsSelect(a).result).toEqual(exp);
      expect(U.dsBinInsert(a).result).toEqual(exp);
      expect(U.dsRadix(a).result).toEqual(exp);
      expect(U.dsShell(a).result).toEqual(exp);
      const sel = U.dsSelect(a);
      sel.passes.forEach((p, i) => expect(p.after.slice(0, i + 1)).toEqual(exp.slice(0, i + 1)));
      expect(sel.cmps).toBe((a.length * (a.length - 1)) / 2);
    }
  });
  it("折半插入稳定，第 i 趟后前 i+1 个有序", () => {
    const a = [20, 30, 10, 30, 50, 40, 10];
    const r = U.dsBinInsert(a);
    r.passes.forEach((p, i) => expect(p.after.slice(0, i + 2)).toEqual(sortedCopy(a.slice(0, i + 2))));
    expect(r.resultIds).toEqual([2, 6, 0, 1, 3, 5, 4]);
  });
  it("选择排序不稳定示例：5 8 5* 2 9", () => {
    const r = U.dsSelect([5, 8, 5, 2, 9]);
    expect(r.resultIds.indexOf(2)).toBeLessThan(r.resultIds.indexOf(0));
  });
  it("基数排序：示例第一趟按个位收集，每趟按对应位稳定分配收集", () => {
    const r = U.dsRadix([312, 47, 908, 165, 523, 790, 236, 81, 654, 409]);
    expect(r.d).toBe(3);
    expect(r.passes[0]!.after).toEqual([790, 81, 312, 523, 654, 165, 236, 47, 908, 409]);
    expect(r.passes[1]!.after).toEqual([908, 409, 312, 523, 236, 47, 654, 165, 81, 790]);
    expect(r.result).toEqual([47, 81, 165, 236, 312, 409, 523, 654, 790, 908]);
    for (let s = 1; s <= 30; s++) {
      const a = rnd(2 + (s % 14), 1000, s * 13);
      const rr = U.dsRadix(a);
      rr.passes.forEach((p) => {
        const base = Math.pow(10, p.k), dig = (v: number) => Math.floor(v / base) % 10;
        for (let i = 1; i < p.after.length; i++) {
          const x = p.after[i - 1]!, y = p.after[i]!;
          expect(dig(x)).toBeLessThanOrEqual(dig(y));
          if (dig(x) === dig(y)) {
            expect(p.beforeIds.indexOf(p.afterIds[i - 1]!)).toBeLessThan(p.beforeIds.indexOf(p.afterIds[i]!));
          }
        }
      });
    }
    expect(U.dsRadix([3, -1]).err).toContain("非负");
  });
});
