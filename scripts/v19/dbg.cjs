const { chromium } = require("/workspace/work/pw/node_modules/playwright-core");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const b = await chromium.launch({ executablePath: "/usr/bin/chromium", args: ["--no-sandbox", "--no-proxy-server", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
  const ctx = await b.newContext({ viewport: { width: 1210, height: 680 }, deviceScaleFactor: 1 });
  const p = await ctx.newPage();
  p.on("console", (m) => console.log("console", m.type(), m.text().slice(0, 300)));
  p.on("pageerror", (e) => console.log("pageerror", e.message));
  await p.goto((process.argv[2] || "http://127.0.0.1:4182") + "/pc?ride=access&dpr=1");
  await p.waitForFunction(() => window.__ride && document.querySelector(".rd-panel"), null, { timeout: 90000 });
  await sleep(7000);
  await p.evaluate(() => window.__ride.goTo(1));
  await sleep(4000);
  console.log(JSON.stringify(await p.evaluate(() => window.__ride.probe())));
  await p.screenshot({ path: "/workspace/work/v19/dbg.png" });
  await b.close();
})();
