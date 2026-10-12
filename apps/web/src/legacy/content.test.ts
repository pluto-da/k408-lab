import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";
import { describe, expect, it } from "vitest";

/**
 * 对外内容的回归检查：
 * - 性质条目都有目录短名（≤ 14 个字，不计空格）；
 * - 讲解文字里不再出现栏目式归纳（“结论一”）、口诀、“教材 / 课本”这类对照某本书的说法；
 * - 默认数据换成本站自拟后，银行家算法默认状态的安全序列与手算一致。
 */
const DIR = resolve(__dirname, "../../legacy-src/js");
const files = readdirSync(DIR).filter((f) => f.endsWith(".js"));
const src = (f: string) => readFileSync(resolve(DIR, f), "utf8");

function loadProps(): { id: string; name: string; toc?: string }[] {
  const win: Record<string, unknown> = { PROP: [], LAB: [], PROC: [] };
  const ctx: Record<string, unknown> = { window: win, Error, Object, Array, JSON, Math, Number, String, parseInt, parseFloat, isNaN, isFinite };
  const proxy = new Proxy(ctx, {
    get: (t, k) => (k in t ? t[k as string] : win[k as string]),
    has: () => true,
    set: (t, k, v) => { t[k as string] = v; win[k as string] = v; return true; },
  });
  for (const f of ["24-prop-ds.js", "25-prop-co.js", "26-prop-os.js", "27-prop-cn.js"]) runInNewContext(src(f), proxy);
  return win.PROP as { id: string; name: string; toc?: string }[];
}

/** 只取字符串字面量里的文字（注释不算） */
function literals(code: string): string[] {
  const out: string[] = [];
  const re = /"((?:[^"\\\n]|\\.)*)"/g;
  for (const line of code.split("\n")) {
    const t = line.trim();
    if (t.startsWith("//") || t.startsWith("/*") || t.startsWith("*")) continue;
    let m: RegExpExecArray | null;
    while ((m = re.exec(line))) out.push(m[1]!);
  }
  return out;
}

describe("性质目录短名", () => {
  const props = loadProps();
  it("56 条性质都有 toc 短名，长度 ≤ 14 个字", () => {
    expect(props).toHaveLength(56);
    for (const p of props) {
      expect(p.toc, p.id).toBeTruthy();
      expect([...p.toc!.replace(/\s/g, "")].length, p.id + " " + p.toc).toBeLessThanOrEqual(14);
    }
  });
});

describe("讲解文字的措辞", () => {
  const BANNED: [string, RegExp][] = [
    ["栏目式编号归纳", /结论[一二三四五]|推论[一二三]/],
    ["口诀", /口诀|顺口溜|先听后发|边发边听/],
    ["对照某本书的说法", /教材|课本|书上|本书/],
    ["栏目式开头", /^(注意|特别提醒|命题陷阱)[:：]/],
  ];
  it("对外脚本的字符串里没有这些说法", () => {
    const hits: string[] = [];
    for (const f of files) {
      for (const s of literals(src(f))) {
        for (const [name, re] of BANNED) if (re.test(s)) hits.push(`${f} [${name}] ${s.slice(0, 40)}`);
      }
    }
    expect(hits).toEqual([]);
  });
});

describe("银行家算法默认状态（本站自拟）", () => {
  it("按“每轮选编号最小的可执行进程”得到 P1 → P3 → P0 → P2 → P4；P1 请求 (1,0,1) 可以分配", () => {
    const win: Record<string, unknown> = { LAB: [] };
    const ctx: Record<string, unknown> = { window: win, document: { readyState: "complete", addEventListener() {} }, setTimeout: () => 0, Error, Object, Array, JSON, Math, Number, String, parseInt, parseFloat, isNaN, isFinite };
    runInNewContext(src("08-lab.js"), new Proxy(ctx, {
      get: (t, k) => (k in t ? t[k as string] : win[k as string]),
      has: () => true,
      set: (t, k, v) => { t[k as string] = v; win[k as string] = v; return true; },
    }));
    type BK = {
      DEF: { av: number[]; max: number[][]; al: number[][] };
      safe(av: number[], max: number[][], al: number[][]): { ok: boolean; seq: number[] };
      request(av: number[], max: number[][], al: number[][], p: number, req: number[]): { ok: boolean };
    };
    const bk = (win.LAB as { id: string }[]).find((l) => l.id === "banker") as unknown as BK;
    const { av, max, al } = bk.DEF;
    expect(bk.safe(av, max, al)).toMatchObject({ ok: true, seq: [1, 3, 0, 2, 4] });
    expect(bk.request(av, max, al, 1, [1, 0, 1]).ok).toBe(true);
    expect(bk.request(av, max, al, 0, [0, 0, 1]).ok).toBe(false);
  });
});
