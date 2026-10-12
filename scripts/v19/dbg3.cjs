const { chromium } = require("/workspace/work/pw/node_modules/playwright-core");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const b = await chromium.launch({ executablePath: "/usr/bin/chromium", args: ["--no-sandbox", "--no-proxy-server", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
  const ctx = await b.newContext({ viewport: { width: 1920, height: 840 }, deviceScaleFactor: 1 });
  const p = await ctx.newPage();
  p.on("pageerror", (e) => console.log("pageerror", e.message));
  await p.goto("http://127.0.0.1:4182/pc?ride=access&dpr=1");
  await p.waitForFunction(() => window.__ride && document.querySelector(".rd-panel"), null, { timeout: 90000 });
  await sleep(7000);
  await p.evaluate(() => window.__ride.goTo(1));
  await sleep(5000);
  console.log(await p.evaluate(() => { const c = document.querySelector(".rd-concl"); if (!c) return "none"; const cs = getComputedStyle(c); const r = c.getBoundingClientRect(); return JSON.stringify({ op: cs.opacity, vis: cs.visibility, anim: cs.animationName, r, html: c.outerHTML.slice(0, 200) }); }));
  await p.screenshot({ path: "/workspace/work/v19/dbg3.png" });
  await b.close();
})();
