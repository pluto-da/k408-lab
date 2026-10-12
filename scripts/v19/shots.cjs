// v19 截图：6 个代表视口 × 第 1、2、3、8、9 站 + 结算卡（需测试构建 RIDE_AUDIT=1）
// node shots.cjs <base> <outdir> [vp,vp] [stations e.g. 1,2,3,8,9]
const { chromium } = require("/workspace/work/pw/node_modules/playwright-core");
const fs = require("fs");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const BASE = process.argv[2] || "http://127.0.0.1:4181";
const OUT = process.argv[3] || "/workspace/work/v19/before";
const ONLY = (process.argv[4] || "").split(",").filter(Boolean);
const ST = (process.argv[5] || "1,2,3,8,9").split(",").map(Number);
const SUM = process.env.NOSUM ? false : true;
const VPS = [
  ["phone", 393, 732, true],
  ["phone-land", 852, 273, true],
  ["tablet-portrait", 820, 1060, true],
  ["tablet", 1210, 680, true],
  ["desktop", 1366, 640, false],
  ["desktop-xl", 1920, 960, false],
].filter((v) => !ONLY.length || ONLY.includes(v[0]));
fs.mkdirSync(OUT, { recursive: true });
(async () => {
  const b = await chromium.launch({ executablePath: "/usr/bin/chromium", args: ["--no-sandbox", "--no-proxy-server", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
  for (const [n, w, h, t] of VPS) {
    const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, hasTouch: t, isMobile: t && Math.min(w, h) < 900 && w < 1000 });
    const p = await ctx.newPage();
    const errs = [];
    p.on("pageerror", (e) => errs.push(e.message));
    await p.goto(`${BASE}/pc?ride=access&dpr=1`);
    await p.waitForFunction(() => window.__ride && document.querySelector(".rd-panel"), null, { timeout: 90000 });
    await sleep(6500);
    const stations = await p.evaluate(() => window.__ride.stations());
    for (const s of ST) {
      const i = s - 1;
      await p.evaluate((v) => window.__ride.pause(v), stations[i].kind === "bus");
      await p.evaluate((k) => window.__ride.goTo(k), i);
      const t0 = Date.now();
      while (Date.now() - t0 < 9000) {
        const pr = await p.evaluate(() => window.__ride.probe());
        if (pr && pr.station === i && pr.arrived && pr.settled) break;
        await sleep(150);
      }
      await sleep(2800);
      await p.screenshot({ path: `${OUT}/${n}-${String(s).padStart(2, "0")}-${stations[i].id}.png` });
    }
    if (SUM) {
      await p.evaluate(() => window.__ride.pause(false));
      await p.evaluate((k) => window.__ride.goTo(k), stations.length - 1);
      await sleep(900);
      for (let k = 0; k < 8 && !(await p.$(".rd-sum")); k++) {
        const bt = await p.$(".rd-next:not([disabled])");
        if (bt) await bt.click().catch(() => {});
        await sleep(800);
      }
      await sleep(600);
      await p.screenshot({ path: `${OUT}/${n}-summary.png` });
    }
    console.log(n, "ok", errs.join(" | "));
    await ctx.close();
  }
  await b.close();
})();
