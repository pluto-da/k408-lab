// usage: node shot2.cjs <url> <outdir> <scenario...>
// scenarios: closed rgb explode journey open:<按钮文字> home lab
const wf = require("./wf.cjs");
const { chromium } = require("/tmp/pw/node_modules/playwright");
(async () => {
  const [url, out, ...sc] = process.argv.slice(2);
  const browser = await chromium.launch({
    executablePath: "/usr/bin/chromium",
    args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--no-sandbox"],
  });
  const page = await browser.newPage({ viewport: { width: 1180, height: 820 }, deviceScaleFactor: 1 });
  const logs = [];
  const t0 = Date.now();
  page.on("console", (m) => { const t = m.text(); if (!/Future Flag|DevTools|status of 401/.test(t)) logs.push(`${((Date.now()-t0)/1000).toFixed(1)} [${m.type()}] ${t.slice(0,200)}`); });
  page.on("pageerror", (e) => logs.push(`[pageerror] ${e.message}`));
  const T = () => ((Date.now() - t0) / 1000).toFixed(0) + "s";
  const frames = async (n) => {
    const f = await page.evaluate(() => window.__pc.stats.frames);
    await wf(page, (f0) => window.__pc.stats.frames >= f0, f + n, { timeout: 240000, polling: 300 });
  };
  const snap = async (name) => { await page.screenshot({ path: `${out}/${name}.png`, timeout: 120000 }); console.log("shot", name, T()); };
  const needPc = sc.some((s) => !["home", "lab"].includes(s));
  if (needPc) {
    await page.goto(url + "/pc?dpr=1&debug", { waitUntil: "domcontentloaded" });
    await wf(page, () => window.__pc && window.__pc.state === "overview", null, { timeout: 400000, polling: 1000 });
    console.log("overview", T(), await page.evaluate(() => JSON.stringify(window.__pc.stats)));
  }
  const click = (sel, text) => page.evaluate(([s, t]) => [...document.querySelectorAll(s)].find((b) => b.textContent.includes(t)).click(), [sel, text]);
  for (const s of sc) {
    if (s === "closed") { await frames(4); await snap("closed"); }
    else if (s === "rgb") {
      await click(".pc-seg button", "氛围灯");
      await page.waitForTimeout(1500); await frames(4); await snap("closed-rgb");
      await click(".pc-seg button", "影棚"); await page.waitForTimeout(1200); await frames(3);
    } else if (s === "explode") {
      await page.evaluate(() => window.__pc.setExplode(1)); await frames(4); await snap("explode");
      await page.evaluate(() => window.__pc.setExplode(0)); await frames(2);
    } else if (s === "journey") {
      await page.evaluate(() => { window.__pc.startJourney(3); });
      await page.waitForTimeout(500);
      await page.evaluate(() => window.__pc.pauseJourney());
      // let the camera arrive and the packet travel
      await wf(page, () => !window.__pc.tweens.some((t) => t.key === "camera" || t.key === "packet"), null, { timeout: 200000, polling: 500 });
      await page.evaluate(() => { window.__pc.packetT = 0.6; window.__pc.tweens = window.__pc.tweens.filter((t) => t.key !== "packet"); });
      await frames(5); await snap("journey");
      await page.evaluate(() => window.__pc.stopJourney());
      await wf(page, () => window.__pc.state === "overview", null, { timeout: 200000 });
    } else if (s.startsWith("open:")) {
      const part = s.slice(5);
      await click(".pc-parts button", part);
      await wf(page, () => window.__pc.state === "open", null, { timeout: 300000, polling: 500 });
      await frames(4); await snap(`open-${part}`);
      await page.evaluate(() => window.__pc.select(null));
      await wf(page, () => window.__pc.state === "overview", null, { timeout: 200000, polling: 500 });
    } else if (s === "home") {
      await page.goto(url + "/", { waitUntil: "load" }); await page.waitForTimeout(2500); await snap("home");
    } else if (s === "lab") {
      await page.goto(url + "/lab", { waitUntil: "load" });
      await wf(page, () => window.__LEGACY_BOOTED__ === true, null, { timeout: 200000 });
      await page.waitForTimeout(4000); await snap("lab");
    }
  }
  console.log(logs.slice(0, 30).join("\n"));
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
