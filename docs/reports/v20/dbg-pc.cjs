const { chromium } = require("/workspace/work/pw/node_modules/playwright-core");
(async () => {
  const b = await chromium.launch({ executablePath: "/usr/bin/chromium", args: ["--no-sandbox"] });
  const c = await b.newContext({ viewport: { width: 1440, height: 900 } });
  const p = await c.newPage();
  await p.goto("http://127.0.0.1:4193/pc");
  await p.waitForFunction(() => document.querySelector(".pc-btn--tour:not([disabled])"), null, { timeout: 100000 });
  await p.click(".pc-parts button");
  for (let i = 0; i < 8; i++) {
    const s = await p.evaluate(() => { const bs = [...document.querySelectorAll(".pc-parts button")]; const e = bs.find(x => x.classList.contains("is-on")); if (!e) return "none"; const cs = getComputedStyle(e); return [bs.length, cs.backgroundColor, cs.color, cs.transitionProperty, e.matches(":hover"), document.getAnimations().length].join(" | "); });
    console.log(i*400, s);
    await new Promise(r => setTimeout(r, 400));
  }
  await b.close();
})();
