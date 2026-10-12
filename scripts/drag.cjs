const wf = require("./wf.cjs");
const { chromium } = require("/tmp/pw/node_modules/playwright-core");
(async () => {
  const [url, out, ...parts] = process.argv.slice(2);
  const browser = await chromium.launch({ executablePath: "/usr/bin/chromium", args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--no-sandbox"] });
  const page = await browser.newPage({ viewport: { width: 1180, height: 760 }, deviceScaleFactor: 1 });
  const logs = []; page.on("pageerror", (e) => logs.push(`[pageerror] ${e.message}`));
  const frames = async (n) => { const f = await page.evaluate(() => { window.__pc.invalidate(); return window.__pc.stats.frames; }); await wf(page, (f0) => window.__pc.stats.frames >= f0, f + n, { timeout: 240000, polling: 300 }); };
  await page.goto(url + "/pc?dpr=1&debug", { waitUntil: "domcontentloaded" });
  await wf(page, () => window.__pc && window.__pc.state === "overview", null, { timeout: 400000, polling: 1000 });
  for (const part of parts) {
    await page.evaluate((p) => window.__pc.select(p), part);
    await wf(page, () => window.__pc.state === "open", null, { timeout: 300000, polling: 500 });
    await page.waitForTimeout(2500);
    await frames(2); await page.screenshot({ path: `${out}/${part}-a.png` });
    await page.mouse.move(590, 560); await page.mouse.down();
    for (let i = 1; i <= 8; i++) await page.mouse.move(590, 560 - i * 30);
    await frames(2); await page.screenshot({ path: `${out}/${part}-b.png` });
    for (let i = 9; i <= 16; i++) await page.mouse.move(590, 560 - i * 30);
    await page.mouse.up();
    await page.waitForTimeout(500); await frames(2); await page.screenshot({ path: `${out}/${part}-c.png` });
    console.log(part, await page.evaluate(() => window.__pc.disK));
    await page.evaluate(() => window.__pc.select(null));
    await wf(page, () => window.__pc.state === "overview", null, { timeout: 200000, polling: 500 });
  }
  console.log(logs.join("\n")); await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
