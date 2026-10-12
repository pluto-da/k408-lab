const { chromium } = require("/workspace/work/pw/node_modules/playwright-core");
const BASE = process.argv[2]; const routes = (process.argv[3]||"/lab").split(",");
(async () => {
  const b = await chromium.launch({ executablePath: "/usr/bin/chromium", args: ["--no-sandbox","--use-angle=swiftshader","--enable-unsafe-swiftshader"] });
  for (const r of routes) {
    const ctx = await b.newContext({ viewport: { width: 1366, height: 1024 } });
    const p = await ctx.newPage();
    p.on("response", res => { if (res.status() >= 300 && res.status() !== 304) console.log(r, res.status(), res.request().method(), res.url()); });
    p.on("requestfailed", q => console.log(r, "FAILED", q.url(), q.failure() && q.failure().errorText));
    p.on("pageerror", e => console.log(r, "pageerror", e.message));
    await p.goto(BASE + r, { waitUntil: "networkidle", timeout: 60000 }).catch(e => console.log("goto", e.message));
    await p.waitForTimeout(3000);
    await ctx.close();
  }
  await b.close();
})();
