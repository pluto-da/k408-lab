// node dis.cjs <url> <outdir> <part...>   screenshots of each part at disassembly 0 / mid / 1
const wf = require("./wf.cjs");
const { chromium } = require("/tmp/pw/node_modules/playwright-core");
(async () => {
  const [url, out, ...parts] = process.argv.slice(2);
  const browser = await chromium.launch({ executablePath: "/usr/bin/chromium", args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--no-sandbox"] });
  const page = await browser.newPage({ viewport: { width: 1180, height: 820 }, deviceScaleFactor: 1 });
  const logs = []; const t0 = Date.now();
  const T = () => ((Date.now() - t0) / 1000).toFixed(0) + "s";
  page.on("console", (m) => { const t = m.text(); if (!/Future Flag|DevTools|401/.test(t)) logs.push(`[${m.type()}] ${t.slice(0, 200)}`); });
  page.on("pageerror", (e) => logs.push(`[pageerror] ${e.message}`));
  const frames = async (n) => { const f = await page.evaluate(() => { window.__pc.invalidate(); return window.__pc.stats.frames; }); await wf(page, (f0) => window.__pc.stats.frames >= f0, f + n, { timeout: 240000, polling: 300 }); };
  const snap = async (name) => { await page.screenshot({ path: `${out}/${name}.png`, timeout: 120000 }); console.log("shot", name, T()); };
  await page.goto(url + "/pc?dpr=1&debug", { waitUntil: "domcontentloaded" });
  await wf(page, () => window.__pc && window.__pc.state === "overview", null, { timeout: 400000, polling: 1000 });
  console.log("overview", T());
  for (const part of parts) {
    await page.evaluate((p) => window.__pc.select(p), part);
    await wf(page, () => window.__pc.state === "open", null, { timeout: 300000, polling: 500 });
    await page.evaluate(() => window.__pc.setDisassembly(0)); await frames(2); await snap(`${part}-0`);
    const n = await page.evaluate(() => window.__pc.parts.get(window.__pc.selected).interior.layers.length);
    await page.evaluate((k) => window.__pc.setDisassembly(k), (0.5 + Math.floor(n / 2)) / n * 0.999 ); await frames(2); await snap(`${part}-mid`);
    await page.evaluate(() => window.__pc.setDisassembly(1)); await page.waitForTimeout(800); await frames(2); await snap(`${part}-1`);
    console.log(part, "stats", await page.evaluate(() => JSON.stringify(window.__pc.stats)));
    await page.evaluate(() => window.__pc.select(null));
    await wf(page, () => window.__pc.state === "overview", null, { timeout: 200000, polling: 500 });
  }
  console.log(logs.slice(0, 30).join("\n"));
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
