// usage: node pc-shot.cjs <url> <outdir> [part button text]   (no part = closed overview)
const wf = require("./wf.cjs");
// Software GL in this sandbox runs ~0.3-1 fps, so we wait on engine state instead of fixed delays.
const { chromium } = require("/tmp/pw/node_modules/playwright");
(async () => {
  const [url, out, part] = process.argv.slice(2);
  const browser = await chromium.launch({
    executablePath: "/usr/bin/chromium",
    args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--no-sandbox"],
  });
  const page = await browser.newPage({ viewport: { width: 1180, height: 820 }, deviceScaleFactor: 1 });
  const logs = [];
  page.on("console", (m) => { const t = m.text(); if (!/Future Flag|DevTools|vite|status of 500/.test(t)) logs.push(`[${m.type()}] ${t}`); });
  page.on("pageerror", (e) => logs.push(`[pageerror] ${e.message}`));
  const t0 = Date.now();
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await wf(page, () => window.__pc && window.__pc.state === "overview", null, { timeout: 200000 });
  console.log("overview after", (Date.now() - t0) / 1000, "s");
  const settled = async (maxSplats) => {
    await wf(page, (max) => {
      const s = window.__pc.spark;
      return !s.sorting && s.display.mappingVersion === s.current.mappingVersion && s.display.numSplats <= max;
    }, maxSplats, { timeout: 200000, polling: 500 }).catch(() => logs.push("settle timeout"));
    const f = await page.evaluate(() => window.__pc.stats.frames);
    await wf(page, (f0) => window.__pc.stats.frames >= f0 + 3, f, { timeout: 60000 }).catch(() => {});
  };
  if (!part) {
    await page.waitForTimeout(3000);
    await settled(1e9);
    await page.screenshot({ path: `${out}/closed.png`, timeout: 120000 });
  } else {
    await page.evaluate((t) => [...document.querySelectorAll(".pc-parts button")].find((b) => b.textContent.includes(t)).click(), part);
    await wf(page, () => window.__pc.state === "open", null, { timeout: 200000 });
    await settled(part.includes("机箱") ? 1e9 : 400000);
    await page.screenshot({ path: `${out}/open-${part}.png`, timeout: 120000 });
  }
  console.log("done after", (Date.now() - t0) / 1000, "s");
  console.log(logs.slice(0, 30).join("\n"));
  await browser.close();
})();
