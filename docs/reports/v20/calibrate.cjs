// 限流阈值校准：模拟一个用户（不用缓存的最坏情况）完整浏览全站，按 Caddy 限流区统计请求数与任意 60 秒窗口内的峰值。
// 用法：calibrate.cjs BASE [UA]
const { chromium } = require("/workspace/work/pw/node_modules/playwright-core");
const BASE = process.argv[2] || "http://127.0.0.1:4192";
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ev = []; const codes = {};
const zone = (u) => { const p = new URL(u).pathname; const z = []; if (p.startsWith("/legacy/")) z.push("legacy"); if (p.endsWith(".glb")) z.push("models"); if (p.startsWith("/assets/")) z.push("assets"); return z; };
(async () => {
  const b = await chromium.launch({ executablePath: "/usr/bin/chromium", args: ["--no-sandbox", "--no-proxy-server", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
  const ctx = await b.newContext({ viewport: { width: 1366, height: 768 }, userAgent: UA });
  ctx.on("request", (q) => { if (q.url().startsWith(BASE)) ev.push({ t: Date.now(), z: zone(q.url()) }); });
  ctx.on("response", (r) => { if (r.url().startsWith(BASE)) codes[r.status()] = (codes[r.status()] || 0) + 1; });
  const visit = async (r, fn) => {
    const p = await ctx.newPage();
    const cdp = await ctx.newCDPSession(p); await cdp.send("Network.setCacheDisabled", { cacheDisabled: true });
    await p.goto(BASE + r, { waitUntil: "domcontentloaded", timeout: 90000 });
    await sleep(2000);
    if (fn) await fn(p);
    await p.close();
  };
  const t0 = Date.now();
  await visit("/");
  await visit("/lab", async (p) => {
    await p.waitForFunction(() => window.X_OPEN_LAB, null, { timeout: 90000 });
    await p.evaluate(async () => {
      const ids = (a) => [...new Set([...document.querySelectorAll("#x-toc a[" + a + "]")].map((x) => x.getAttribute(a)))];
      const w = (ms) => new Promise((r) => setTimeout(r, ms));
      for (const id of ids("data-lab")) { window.X_OPEN_LAB(id); await w(150); }
      for (const id of ids("data-proc")) { window.X_OPEN_PROC(id); await w(100); }
      for (const id of ids("data-prop")) { window.X_OPEN_PROP(id, true); await w(100); }
      const t = document.querySelector(".x-3d__toggle"); if (t) t.click();
      await w(6000);
    });
  });
  await visit("/pc?dpr=1", async (p) => {
    await p.waitForFunction(() => document.querySelector(".pc-btn--tour:not([disabled])"), null, { timeout: 120000 }).catch(() => {});
    const tours = await p.$$(".pc-btn--tour"); if (tours[0]) { await tours[0].click(); await sleep(4000); }
  });
  await visit("/pc?ride=access&dpr=1", async (p) => { await sleep(8000); });
  for (const r of ["/login", "/register", "/terms", "/privacy"]) await visit(r);
  // 再刷新一次实验室与整机（不用缓存）
  await visit("/lab", async (p) => { await sleep(3000); });
  await visit("/pc?dpr=1", async (p) => { await sleep(6000); });
  const dur = (Date.now() - t0) / 1000;
  const tot = { all: ev.length, legacy: 0, models: 0, assets: 0 }, peak = { legacy: 0, models: 0, assets: 0 };
  for (const e of ev) for (const z of e.z) tot[z]++;
  for (const z of Object.keys(peak)) { const ts = ev.filter((e) => e.z.includes(z)).map((e) => e.t); let j = 0; for (let i = 0; i < ts.length; i++) { while (ts[i] - ts[j] > 60000) j++; peak[z] = Math.max(peak[z], i - j + 1); } }
  console.log(JSON.stringify({ seconds: Math.round(dur), totals: tot, peak60s: peak, codes }));
  await b.close();
})();
