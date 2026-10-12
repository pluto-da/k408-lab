// v17 线上走查：/pc?ride=access 走到第一个讲解站截图，收集 JS 错误
const { chromium } = require("/workspace/work/pw/node_modules/playwright-core");
const BASE = "http://154.8.183.93";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const browser = await chromium.launch({ executablePath: "/usr/bin/chromium",
    args: ["--no-sandbox", "--no-proxy-server", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
  for (const [name, w, h, touch] of [["phone", 393, 852, true], ["desktop", 1366, 768, false]]) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, hasTouch: touch, isMobile: touch, locale: "zh-CN" });
    const page = await ctx.newPage();
    const errors = [], failed = [];
    page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
    page.on("console", (m) => { if (m.type() === "error" && !/Cross-Origin-Opener-Policy/i.test(m.text())) errors.push("console: " + m.text()); });
    page.on("response", (r) => { if (r.status() >= 400) failed.push(r.status() + " " + r.url()); });
    const t0 = Date.now(); let title = "", ok = false;
    try {
      await page.goto(`${BASE}/pc?ride=access`, { waitUntil: "domcontentloaded", timeout: 60000 });
      await page.waitForSelector(".rd-cap", { timeout: 60000 });
      for (let i = 0; i < 5; i++) await page.keyboard.press("e");
      await page.waitForFunction(() => { const b = document.querySelector(".rd-next"); return b && !b.disabled && b.textContent.includes("继续"); }, null, { timeout: 60000 });
      await sleep(2600);
      title = await page.$eval(".rd-cap h2", (e) => e.textContent).catch(() => "");
      ok = true;
    } catch (e) { errors.push("script: " + e.message.split("\n")[0]); }
    await page.screenshot({ path: `/workspace/work/v17/live-${name}.png` });
    console.log(JSON.stringify({ name, w, h, ok, title, ms: Date.now() - t0, errors, failed }));
    await ctx.close();
  }
  await browser.close();
})();
