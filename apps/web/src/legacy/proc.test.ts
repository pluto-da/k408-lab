import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";
import { describe, expect, it } from "vitest";

/** 在最小沙箱里执行过程图解脚本，只测纯计算部分（make 生成的步骤数据） */
interface Step { t: string; d?: string; on?: string[]; go?: string[]; kv?: Record<string, string>; set?: Record<string, unknown> }
interface Spec { w: number; h: number; nodes: { id: string }[]; edges: { id: string; a: string; b: string }[]; steps: Step[] }
interface Mode { name: string; make?: (inp: Record<string, string>) => Spec; circuit?: unknown }
interface Proc { id: string; sub: string; name: string; inputs?: { k: string; value: string }[]; modes: Mode[] }

function load() {
  const dir = resolve(__dirname, "../../public/legacy/js");
  const win: Record<string, unknown> = { __LEGACY_LOADER__: true, addEventListener: () => undefined };
  const ctx: Record<string, unknown> = { window: win, document: { readyState: "complete" }, setTimeout, Math, Number, String, parseInt, isNaN, Error, Object, Array, JSON };
  win.X = { reduced: true };
  ctx.X = win.X;
  for (const f of ["11-proc-core.js", "12-proc-circuit.js", "13-proc-co.js", "14-proc-os.js"]) {
    runInNewContext(readFileSync(resolve(dir, f), "utf8"), new Proxy(ctx, { get: (t, k) => (k in t ? t[k as string] : win[k as string]), has: () => true, set: (t, k, v) => { t[k as string] = v; win[k as string] = v; return true; } }));
  }
  return { PROC: win.PROC as Proc[], U: win.PROCU as { mixIndexCalc: (off: number, b: number) => [number, number[]] } };
}

const { PROC, U } = load();
const byId = (id: string) => PROC.find((p) => p.id === id)!;
const mk = (id: string) => byId(id).modes[0]!.make!;
const defaults = (p: Proc) => Object.fromEntries((p.inputs ?? []).map((f) => [f.k, f.value]));
const lastKv = (s: Spec) => s.steps.reduce<Record<string, string>>((a, st) => ({ ...a, ...(st.kv ?? {}) }), {});

describe("过程图解", () => {
  it("注册了 16 个图解", () => {
    expect(PROC.map((p) => p.id).sort()).toEqual(
      ["adder", "boot", "decoder", "devalloc", "dma", "gates", "icycle", "intr", "micro", "mixidx", "pstate", "pswitch", "syscall", "tlbcache", "tlbflow", "twolevel"].sort(),
    );
  });

  it("每个流程模式都能生成合法步骤，引用的部件与连线都存在", () => {
    for (const p of PROC) {
      for (const m of p.modes) {
        if (!m.make) continue;
        const spec = m.make(defaults(p));
        const nodes = new Set(spec.nodes.map((n) => n.id));
        const edges = new Set(spec.edges.map((e) => e.id));
        expect(spec.steps.length, `${p.id}/${m.name}`).toBeGreaterThan(2);
        for (const e of spec.edges) {
          expect(nodes.has(e.a), `${p.id} 连线 ${e.id} 起点`).toBe(true);
          expect(nodes.has(e.b), `${p.id} 连线 ${e.id} 终点`).toBe(true);
        }
        for (const st of spec.steps) {
          expect(st.t, `${p.id} 步骤标题`).toBeTruthy();
          for (const id of st.on ?? []) expect(nodes.has(id), `${p.id}「${st.t}」部件 ${id}`).toBe(true);
          for (const id of st.go ?? []) expect(edges.has(id), `${p.id}「${st.t}」连线 ${id}`).toBe(true);
          for (const id of Object.keys(st.set ?? {})) expect(nodes.has(id), `${p.id}「${st.t}」set ${id}`).toBe(true);
        }
      }
    }
  });

  it("二级页表：0x00403A7C → 页目录 1、页表 3、偏移 0xA7C，访存 3 次", () => {
    const spec = mk("twolevel")({ va: "00403A7C", pte: "ok" });
    const kv = lastKv(spec);
    expect(kv["页目录号"]).toBe("1");
    expect(kv["页表索引"]).toBe("3");
    expect(kv["页内偏移"]).toBe("0xA7C");
    expect(kv["访存次数"]).toBe("3");
    expect(kv["物理地址"]).toMatch(/A7C$/);
    const f = lastKv(mk("twolevel")({ va: "00403A7C", pte: "fault" }));
    expect(f["访存次数"]).toBe("5");
    expect(f["访问磁盘"]).toBe("1");
  });

  it("TLB + Cache：字段位数与低 12 位不变", () => {
    for (const va of ["0040A3C8", "FFFFFFFF", "00000000", "12345678"]) {
      for (const tlb of ["hit", "miss"]) {
        for (const cache of ["hit", "miss"]) {
          const kv = lastKv(mk("tlbcache")({ va, tlb, cache }));
          const v = parseInt(va, 16);
          expect(kv["TLB 组号"]).toBe(String((v >>> 12) & 7));
          const pa = parseInt(kv["物理地址"]!, 16);
          expect(pa & 0xfff).toBe(v & 0xfff);
          expect(pa).toBeLessThan(1 << 24);
          expect(kv["Cache 组号"]).toBe(String((pa >>> 5) & 0x7f));
          expect(kv["访问主存"]).toBe(`${(tlb === "miss" ? 1 : 0) + (cache === "miss" ? 1 : 0)} 次`);
        }
      }
    }
  });

  it("混合索引：块号范围与读盘次数", () => {
    expect(U.mixIndexCalc(0, 1024)).toEqual([0, [0]]);
    expect(U.mixIndexCalc(10239, 1024)).toEqual([0, [9]]);
    expect(U.mixIndexCalc(10240, 1024)).toEqual([1, [0]]);
    expect(U.mixIndexCalc(10240 + 255 * 1024, 1024)).toEqual([1, [255]]);
    expect(U.mixIndexCalc(10240 + 256 * 1024, 1024)).toEqual([2, [0, 0]]);
    expect(U.mixIndexCalc((10 + 256 + 256 * 256) * 1024, 1024)).toEqual([3, [0, 0, 0]]);
    const make = mk("mixidx");
    expect(lastKv(make({ off: "0", bs: "1024" }))["读盘次数"]).toBe("1");
    expect(lastKv(make({ off: "10240", bs: "1024" }))["读盘次数"]).toBe("2");
    expect(lastKv(make({ off: String(10240 + 256 * 1024), bs: "1024" }))["读盘次数"]).toBe("3");
    expect(lastKv(make({ off: String((10 + 256 + 65536) * 1024), bs: "1024" }))["读盘次数"]).toBe("4");
    expect(() => make({ off: "abc", bs: "1024" })).toThrow();
    expect(() => make({ off: "99999999999999", bs: "1024" })).toThrow();
  });

  it("非法虚拟地址给出提示", () => {
    expect(() => mk("twolevel")({ va: "xyz", pte: "ok" })).toThrow(/十六进制/);
    expect(() => mk("tlbcache")({ va: "123456789", tlb: "hit", cache: "hit" })).toThrow();
  });
});
