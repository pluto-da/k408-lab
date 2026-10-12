import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { COMMON_LABS, LAB_COUNT, LABS_BY_SUBJECT, PROC_COUNT, PROP_COUNT } from "./catalog";

/** 从旧模块源码里把实验、图解、性质重新数一遍，防止首页文案和实际内容脱节 */
const DIR = resolve(__dirname, "../../legacy-src/js");
const files = readdirSync(DIR).filter((f) => f.endsWith(".js"));
const read = (re: RegExp) => files.filter((f) => re.test(f)).map((f) => readFileSync(resolve(DIR, f), "utf8"));

const SUBJ: Record<string, string> = { DS: "ds", CO: "co", OS: "os", CN: "cn" };
const labs = read(/(^08-lab|-lab-)/).flatMap((src) =>
  [...src.matchAll(/^\s*id: ?"([a-z0-9]+)", name: ?"([^"]+)", color: ?("var\(--x-(ds|co|os|cn)\)"|([A-Z]{2}))/gm)].map((m) => ({
    id: m[1]!,
    name: m[2]!,
    subject: m[4] ?? SUBJ[m[5]!]!,
  })),
);

describe("实验室规模", () => {
  it("实验数量与各科分布", () => {
    expect(labs).toHaveLength(LAB_COUNT);
    for (const s of Object.keys(LABS_BY_SUBJECT) as (keyof typeof LABS_BY_SUBJECT)[]) {
      expect(labs.filter((l) => l.subject === s).length, s).toBe(LABS_BY_SUBJECT[s]);
    }
  });

  it("过程图解与性质数量", () => {
    const procs = read(/-proc-/).flatMap((src) => [...src.matchAll(/^\s*id: ?"[a-z0-9-]+", name: ?"[^"]+", sub:/gm)]);
    expect(procs).toHaveLength(PROC_COUNT);
    const props = read(/-prop-/).flatMap((src) => [...src.matchAll(/^\s*id: ?"[a-z0-9-]+", sub: ?"/gm)]);
    expect(props).toHaveLength(PROP_COUNT);
  });

  it("首页常用实验都存在且标题一致", () => {
    for (const c of COMMON_LABS) {
      const l = labs.find((x) => x.id === c.id);
      expect(l, c.id).toBeDefined();
      expect(l!.name).toBe(c.title);
      expect(l!.subject).toBe(c.subject);
    }
  });
});
