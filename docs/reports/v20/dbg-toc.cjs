const { chromium } = require("/workspace/work/pw/node_modules/playwright-core");
(async () => {
  const b = await chromium.launch({ executablePath: "/usr/bin/chromium", args: ["--no-sandbox"] });
  const c = await b.newContext({ viewport: { width: 852, height: 393 }, hasTouch: true, isMobile: false });
  const p = await c.newPage();
  await p.goto("http://127.0.0.1:4192/lab");
  await p.waitForFunction(() => window.X_OPEN_LAB, null, { timeout: 60000 });
  await p.evaluate(() => document.querySelector("#x-tocbtn, .x-tocbtn").click());
  await new Promise((r) => setTimeout(r, 600));
  await p.screenshot({ path: "/workspace/work/v20/dbg-toc-land.png" });
  await b.close();
})();
