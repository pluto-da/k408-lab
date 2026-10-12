import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";
import { describe, expect, it } from "vitest";

/** 计算机网络过程图解（17-proc-cn.js）：只测 make 生成的步骤数据 */
interface Step { t: string; d?: string; tip?: string; on?: string[]; go?: string[]; kv?: Record<string, string>; set?: Record<string, unknown> }
interface Node { id: string; k?: string; x: number; y: number; w: number; h: number }
interface Spec { w: number; h: number; nodes: Node[]; edges: { id: string; a: string; b: string }[]; steps: Step[] }
interface Mode { name: string; make?: (inp: Record<string, string>) => Spec; circuit?: unknown }
interface Proc { id: string; sub: string; name: string; note?: string[]; inputs?: { k: string; value: string }[]; modes: Mode[] }

function load() {
  const dir = resolve(__dirname, "../../legacy-src/js");
  const win: Record<string, unknown> = { __LEGACY_LOADER__: true, addEventListener: () => undefined };
  const ctx: Record<string, unknown> = { window: win, document: { readyState: "complete" }, setTimeout, Math, Number, String, parseInt, isNaN, Error, Object, Array, JSON };
  win.X = { reduced: true };
  ctx.X = win.X;
  for (const f of ["11-proc-core.js", "12-proc-circuit.js", "13-proc-co.js", "14-proc-os.js", "17-proc-cn.js"]) {
    runInNewContext(readFileSync(resolve(dir, f), "utf8"), new Proxy(ctx, { get: (t, k) => (k in t ? t[k as string] : win[k as string]), has: () => true, set: (t, k, v) => { t[k as string] = v; win[k as string] = v; return true; } }));
  }
  return win.PROC as Proc[];
}

const PROC = load();
const CN = PROC.filter((p) => p.sub === "cn");
const IDS = ["encap", "webvisit", "dns", "arp", "dhcp", "nat", "switch", "email", "icmp"];
const byId = (id: string) => {
  const p = PROC.find((x) => x.id === id);
  if (!p) throw new Error(`缺少图解 ${id}`);
  return p;
};
const spec = (id: string, mode = 0): Spec => {
  const m = byId(id).modes[mode];
  if (!m || !m.make) throw new Error(`${id} 缺少模式 ${mode}`);
  return m.make({});
};
const modeIndex = (id: string, name: string) => byId(id).modes.findIndex((m) => m.name === name);
/** 第 i 步时累积的 kv */
const kvAt = (s: Spec, i: number) => s.steps.slice(0, i + 1).reduce<Record<string, string>>((a, st) => ({ ...a, ...(st.kv ?? {}) }), {});
const find = (s: Spec, pred: (st: Step) => boolean) => s.steps.findIndex(pred);
const kvOf = (s: Spec, pred: (st: Step) => boolean) => {
  const i = find(s, pred);
  expect(i, "找不到对应步骤").toBeGreaterThanOrEqual(0);
  return kvAt(s, i);
};
const lastKv = (s: Spec) => kvAt(s, s.steps.length - 1);

describe("过程图解 · 计算机网络", () => {
  it("注册了 9 个计算机网络图解，id 不重复", () => {
    expect(CN.map((p) => p.id).sort()).toEqual([...IDS].sort());
    const all = PROC.map((p) => p.id);
    expect(new Set(all).size).toBe(all.length);
    for (const p of CN) {
      expect(p.name).toBeTruthy();
      expect((p.note ?? []).length, `${p.id} 考点`).toBeGreaterThanOrEqual(3);
      expect((p.note ?? []).length, `${p.id} 考点`).toBeLessThanOrEqual(5);
    }
  });

  it("模式齐全", () => {
    expect(byId("dns").modes.map((m) => m.name)).toEqual(["迭代查询", "递归查询", "缓存命中"]);
    expect(byId("arp").modes.map((m) => m.name)).toEqual(["同一网络", "跨网络"]);
    expect(byId("icmp").modes.map((m) => m.name)).toEqual(["ping", "traceroute"]);
  });

  it("每个模式步骤合法：引用的部件、连线都存在，部件不重叠且在画布内", () => {
    for (const p of CN) {
      for (const m of p.modes) {
        expect(m.make, `${p.id}/${m.name}`).toBeTypeOf("function");
        const s = m.make!({});
        const tag = `${p.id}/${m.name}`;
        expect(s.w, tag).toBeGreaterThanOrEqual(860);
        expect(s.w, tag).toBeLessThanOrEqual(980);
        expect(s.h, tag).toBeGreaterThanOrEqual(380);
        expect(s.h, tag).toBeLessThanOrEqual(640);
        expect(s.steps.length, tag).toBeGreaterThan(3);
        const nodes = new Set(s.nodes.map((n) => n.id));
        const edges = new Set(s.edges.map((e) => e.id));
        expect(nodes.size, `${tag} 部件 id 重复`).toBe(s.nodes.length);
        expect(edges.size, `${tag} 连线 id 重复`).toBe(s.edges.length);
        for (const e of s.edges) {
          expect(nodes.has(e.a), `${tag} 连线 ${e.id} 起点`).toBe(true);
          expect(nodes.has(e.b), `${tag} 连线 ${e.id} 终点`).toBe(true);
        }
        for (const st of s.steps) {
          expect(st.t, `${tag} 步骤标题`).toBeTruthy();
          expect(st.d, `${tag}「${st.t}」说明`).toBeTruthy();
          for (const id of st.on ?? []) expect(nodes.has(id), `${tag}「${st.t}」部件 ${id}`).toBe(true);
          for (const id of st.go ?? []) expect(edges.has(id), `${tag}「${st.t}」连线 ${id}`).toBe(true);
          for (const id of Object.keys(st.set ?? {})) expect(nodes.has(id), `${tag}「${st.t}」set ${id}`).toBe(true);
          for (const v of Object.values(st.kv ?? {})) expect(typeof v, `${tag}「${st.t}」kv`).toBe("string");
        }
        const real = s.nodes.filter((n) => n.k !== "zone");
        for (const n of s.nodes) {
          expect(n.x >= 0 && n.y >= 0 && n.x + n.w <= s.w && n.y + n.h <= s.h, `${tag} ${n.id} 超出画布`).toBe(true);
        }
        for (let i = 0; i < real.length; i++) {
          for (let j = i + 1; j < real.length; j++) {
            const a = real[i]!, b = real[j]!;
            const hit = a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
            expect(hit, `${tag} ${a.id} 与 ${b.id} 重叠`).toBe(false);
          }
        }
      }
    }
  });

  it("ARP：请求广播、响应单播；跨网只解析网关", () => {
    const s = spec("arp", modeIndex("arp", "同一网络"));
    const req = kvOf(s, (st) => (st.kv?.["帧类型"] ?? "").includes("ARP 请求"));
    expect(req["目的MAC"]).toBe("FF-FF-FF-FF-FF-FF");
    expect(req["目标IP"]).toBe("192.168.1.3");
    const rep = kvOf(s, (st) => (st.kv?.["帧类型"] ?? "").includes("ARP 响应"));
    expect(rep["目的MAC"]).not.toMatch(/FF-FF/);
    expect(rep["目的MAC"]).toBe(req["源MAC"]);
    const c = spec("arp", modeIndex("arp", "跨网络"));
    const creq = kvOf(c, (st) => (st.kv?.["帧类型"] ?? "").includes("ARP 请求"));
    expect(creq["目的MAC"]).toBe("FF-FF-FF-FF-FF-FF");
    expect(creq["目标IP"]).toContain("192.168.1.1");
    const fin = lastKv(c);
    expect(fin["目标IP"]).toContain("192.168.2.8");
    expect(fin["源MAC"]).toBe("2A-2A-2A-2A-2A-2A");
    expect(fin["TTL"]).toBe("63");
  });

  it("DHCP：Discover 与 Request 都是广播，UDP 68→67", () => {
    const s = spec("dhcp");
    for (const name of ["Discover", "Request"]) {
      const kv = kvOf(s, (st) => (st.kv?.["协议"] ?? "").includes(name));
      expect(kv["源IP"], name).toBe("0.0.0.0");
      expect(kv["目的IP"], name).toBe("255.255.255.255");
      expect(kv["目的MAC"], name).toBe("FF-FF-FF-FF-FF-FF");
      expect(kv["源端口"], name).toBe("68");
      expect(kv["目的端口"], name).toBe("67");
      expect(kv["协议"], name).toContain("UDP");
    }
    const offer = kvOf(s, (st) => (st.kv?.["协议"] ?? "").includes("Offer"));
    expect(offer["源端口"]).toBe("67");
    expect(offer["目的端口"]).toBe("68");
    const order = ["Discover", "Offer", "Request", "ACK"].map((n) => find(s, (st) => (st.kv?.["协议"] ?? "").includes(n)));
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });

  it("访问网页：先 ARP 网关，再 DNS（UDP 53），三次握手后才 HTTP（TCP 80）", () => {
    const s = spec("webvisit");
    const info = (i: number) => s.steps[i]?.kv?.["内容"] ?? "";
    const iArp = find(s, (st) => st.kv?.["协议"] === "ARP 请求");
    const iDns = find(s, (st) => (st.kv?.["协议"] ?? "").startsWith("DNS 查询"));
    const iSyn = find(s, (st) => (st.kv?.["内容"] ?? "") === "SYN=1, seq=x");
    const iGet = find(s, (st) => (st.kv?.["内容"] ?? "").startsWith("GET"));
    expect(iArp).toBeGreaterThanOrEqual(0);
    expect(iArp).toBeLessThan(iDns);
    expect(iDns).toBeLessThan(iSyn);
    expect(iSyn + 2).toBeLessThan(iGet);
    expect(info(iSyn + 1)).toContain("SYN=1, ACK=1");
    expect(kvAt(s, iArp)["目的MAC"]).toBe("FF-FF-FF-FF-FF-FF");
    const dns = kvAt(s, iDns);
    expect(dns["目的端口"]).toBe("53");
    expect(dns["协议"]).toContain("UDP");
    expect(dns["目的MAC"]).toContain("1A-1A-1A-1A-1A-1A");
    expect(dns["目的IP"]).toBe("202.1.1.53");
    const get = kvAt(s, iGet);
    expect(get["目的端口"]).toBe("80");
    expect(get["协议"]).toContain("TCP");
    expect(get["目的IP"]).toBe("203.0.113.80");
  });

  it("DNS：迭代、递归都是 8 个报文，缓存命中 2 个", () => {
    expect(lastKv(spec("dns", modeIndex("dns", "迭代查询")))["报文数"]).toBe("8");
    expect(lastKv(spec("dns", modeIndex("dns", "递归查询")))["报文数"]).toBe("8");
    expect(lastKv(spec("dns", modeIndex("dns", "缓存命中")))["报文数"]).toBe("2");
    expect(lastKv(spec("dns"))["运输层"]).toContain("53");
    // 迭代模式下根服务器不与顶级域服务器直接通信
    const itr = spec("dns", modeIndex("dns", "迭代查询"));
    expect(itr.edges.some((e) => (e.a === "ROOT" && e.b === "TLD") || (e.a === "TLD" && e.b === "ROOT"))).toBe(false);
    const rec = spec("dns", modeIndex("dns", "递归查询"));
    expect(rec.edges.some((e) => e.a === "ROOT" && e.b === "TLD")).toBe(true);
  });

  it("NAT：出方向改源地址:端口，入方向改目的地址:端口", () => {
    const s = spec("nat");
    const out = kvOf(s, (st) => st.kv?.["说明"] === "源地址:端口已改写");
    expect(out["源IP"]).toBe("202.1.1.1");
    expect(out["源端口"]).toBe("6001");
    expect(out["目的IP"]).toBe("203.0.113.80");
    const back = kvOf(s, (st) => st.kv?.["说明"] === "目的地址:端口已改回");
    expect(back["目的IP"]).toBe("192.168.1.2");
    expect(back["目的端口"]).toBe("5000");
  });

  it("交换机：未知目的泛洪、同端口丢弃、广播泛洪", () => {
    const s = spec("switch");
    expect(s.steps.some((st) => (st.kv?.["动作"] ?? "").startsWith("泛洪到端口 2、3、4"))).toBe(true);
    expect(s.steps.some((st) => (st.kv?.["动作"] ?? "").includes("同一端口，丢弃"))).toBe(true);
    const bc = kvOf(s, (st) => st.kv?.["目的MAC"] === "FF-FF-FF-FF-FF-FF");
    expect(bc["动作"]).toContain("泛洪");
  });

  it("封装：经过路由器 TTL 减 1；电子邮件端口；ICMP 类型", () => {
    const e = spec("encap");
    expect(e.steps.length).toBeGreaterThanOrEqual(12);
    expect(lastKv(e)["IP 首部 TTL"]).toBe("63");
    const m = spec("email");
    expect(kvOf(m, (st) => (st.kv?.["协议"] ?? "").startsWith("SMTP"))["端口"]).toBe("25");
    expect(kvOf(m, (st) => (st.kv?.["协议"] ?? "").startsWith("POP3"))["端口"]).toBe("110");
    const ping = spec("icmp", modeIndex("icmp", "ping"));
    const types = ping.steps.map((st) => st.kv?.["ICMP 类型"]).filter(Boolean);
    expect(types[0]).toMatch(/^8/);
    expect(types).toContainEqual(expect.stringMatching(/^0/));
    const tr = spec("icmp", modeIndex("icmp", "traceroute"));
    const trTypes = tr.steps.map((st) => st.kv?.["ICMP 类型"] ?? "");
    expect(trTypes.filter((t) => t.startsWith("11")).length).toBe(2);
    expect(trTypes.some((t) => t.startsWith("3"))).toBe(true);
  });
});
