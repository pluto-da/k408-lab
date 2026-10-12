// 线上 /pc?ride=access 到第 2 站截图（生产构建没有 __ride，靠点击「下一站」）
const { chromium } = require("/workspace/work/pw/node_modules/playwright-core");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const BASE = process.argv[2] || "http://154.8.183.93";
const ONLY = (process.argv[3] || "").split(",").filter(Boolean);
const VPS = [["tablet", 1210, 680, true], ["phone", 393, 732, true], ["desktop", 1366, 640, false]].filter((v) => !ONLY.length || ONLY.includes(v[0]));
(async () => {
  const b = await chromium.launch({ executablePath: "/usr/bin/chromium", args: ["--no-sandbox", "--no-proxy-server", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
  for (const [n, w, h, t] of VPS) {
    const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, hasTouch: t, isMobile: t && w < 1000 });
    const p = await ctx.newPage();
    const errs = [];
    p.on("pageerror", (e) => errs.push("pageerror: " + e.message));
    p.on("console", (m) => { if (m.type() === "error") errs.push("console: " + m.text()); });
    await p.goto(`${BASE}/pc?ride=access&dpr=1`, { waitUntil: "domcontentloaded" });
    await p.waitForSelector(".rd-panel", { timeout: 90000 });
    await sleep(7000);
    const txt = async () => (await p.$eval(".rd-panel", (e) => e.textContent.slice(0, 40)).catch(() => ""));
    for (let k = 0; k < 6 && !/0?2\s*\/\s*11/.test(await txt()); k++) {
      const bt = await p.$(".rd-next:not([disabled])");
      if (bt) await bt.click().catch(() => {});
      await sleep(3500);
    }
    await sleep(4000);
    await p.screenshot({ path: `/workspace/work/v19/live-${n}.png` });
    console.log(n, JSON.stringify(await txt()), "errors:", errs.length ? errs.join(" | ") : "none");
    await ctx.close();
  }
  await b.close();
})();
