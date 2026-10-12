// SPA re-entry: /pc -> home -> /pc again must render the PC again.
const wf = require("./wf.cjs");
const { chromium } = require("/tmp/pw/node_modules/playwright");
(async () => {
  const browser = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--no-sandbox"] });
  const page = await browser.newPage({ viewport: { width: 1180, height: 820 } });
  const logs = [];
  page.on("pageerror", (e) => logs.push(`[pageerror] ${e.name}|${e.message}|${e.stack}`));
  page.on("console", (m) => { if (m.type() === "error" && !/401/.test(m.text())) logs.push(m.text()); });
  await page.goto("http://127.0.0.1:4180/pc?dpr=1");
  await wf(page, () => window.__pcStats && window.__pcStats.frames > 3 && !document.querySelector(".pc-loading"), null, { timeout: 120000 });
  await page.evaluate(() => document.querySelector(".app-brand").click());
  await page.waitForTimeout(1500);
  const home = await page.evaluate(() => ({ path: location.pathname, canvases: document.querySelectorAll("canvas").length }));
  await page.evaluate(() => [...document.querySelectorAll(".app-nav a")].find((a) => a.textContent.includes("整机拆解")).click());
  await wf(page, () => window.__pcStats && window.__pcStats.frames > 3 && !document.querySelector(".pc-loading"), null, { timeout: 120000 });
  await page.waitForTimeout(45000);
  const again = await page.evaluate(() => ({ path: location.pathname, canvases: document.querySelectorAll("canvas").length, frames: window.__pcStats.frames }));
  await page.screenshot({ path: "/tmp/nav.png", timeout: 120000 });
  console.log(JSON.stringify({ home, again, logs: logs.slice(0, 8) }));
  await browser.close();
})();
