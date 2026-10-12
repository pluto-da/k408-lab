// v17 线上同款构建的「改前」截图：第 2 站 TLB 与 L1 站
const { chromium } = require("/workspace/work/pw/node_modules/playwright-core");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const VPS = [["tablet", 1210, 680, true], ["phone", 393, 732, true], ["phone-land", 852, 273, true], ["desktop", 1366, 648, false]];
(async () => {
  const b = await chromium.launch({ executablePath: "/usr/bin/chromium", args: ["--no-sandbox", "--no-proxy-server", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
  for (const [n, w, h, t] of VPS) {
    const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, hasTouch: t, isMobile: t && w < 900 });
    const p = await ctx.newPage();
    await p.goto("http://127.0.0.1:4181/pc?ride=access&dpr=1");
    await p.waitForSelector(".rd-cap", { timeout: 90000 });
    for (let i = 0; i < 5; i++) await p.keyboard.press("e");
    const want = [["TLB", "tlb"], ["L1", "l1"]];
    const t0 = Date.now();
    while (want.length && Date.now() - t0 < 150000) {
      const title = await p.$eval(".rd-cap h2", (e) => e.textContent).catch(() => "");
      const arrived = await p.$eval(".rd-next", (e) => e.textContent.includes("继续")).catch(() => false);
      if (arrived && title.includes(want[0][0])) {
        await sleep(2600);
        await p.screenshot({ path: `/workspace/work/v18/before/${n}-${want[0][1]}.png` });
        want.shift();
      }
      const btn = await p.$(".rd-next:not([disabled])");
      if (btn && arrived) await btn.click();
      await sleep(400);
    }
    console.log(n, "done", want.length);
    await ctx.close();
  }
  await b.close();
})();
