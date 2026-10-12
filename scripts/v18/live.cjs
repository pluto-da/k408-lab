// 线上复测：/pc?ride=access 第 2 站（查快表 TLB），三个尺寸
const { chromium } = require("/workspace/work/pw/node_modules/playwright-core");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const VPS = [["tablet", 1210, 680, true], ["phone", 393, 732, true], ["desktop", 1366, 640, false]];
(async () => {
  const b = await chromium.launch({ executablePath: "/usr/bin/chromium", args: ["--no-sandbox", "--no-proxy-server", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
  for (const [n, w, h, t] of VPS) {
    const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, hasTouch: t, isMobile: t && w < 900 });
    const p = await ctx.newPage();
    const errs = [];
    p.on("pageerror", (e) => errs.push(e.message));
    await p.goto("http://154.8.183.93/pc?ride=access&dpr=1", { waitUntil: "domcontentloaded", timeout: 90000 });
    try {
      await p.waitForSelector(".rd-panel", { timeout: 150000 });
    } catch (e) {
      await p.screenshot({ path: `/workspace/work/v18/live-${n}-fail.png` });
      console.log(n, "no panel", await p.evaluate(() => document.body.innerText.slice(0, 200)));
      await ctx.close();
      continue;
    }
    const t0 = Date.now();
    let ok = false;
    while (Date.now() - t0 < 100000) {
      const title = await p.$eval(".rd-head h2", (e) => e.textContent).catch(() => "");
      const btn = await p.$eval(".rd-next", (e) => e.textContent).catch(() => "");
      if (title.includes("TLB") && btn.includes("下一站")) { ok = true; break; }
      if (btn.includes("下一站") && !title.includes("TLB")) await p.click(".rd-next");
      await sleep(400);
    }
    await sleep(3500);
    await p.screenshot({ path: `/workspace/work/v18/live-${n}.png` });
    const info = await p.evaluate(() => ({ ride: typeof window.__ride, layout: (document.querySelector(".rd-root")?.className.match(/rd-L--\w+/) || [""])[0] }));
    console.log(n, "reached TLB:", ok, JSON.stringify(info), "errors:", errs.length ? errs : "none");
    await ctx.close();
  }
  await b.close();
})();
