// 化身数据 · 路线一 多视口走查：进入 /pc?ride=access，一路按「继续」走到小结。
// 用法：node ride.cjs [baseUrl] [视口名过滤，逗号分隔]
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("/workspace/work/pw/node_modules/playwright-core");

const BASE = process.argv[2] || "http://localhost:4174";
const ONLY = (process.argv[3] || "").split(",").filter(Boolean);
const OUT = "/workspace/work/v17";
const VPS = [
  ["phone", 393, 852, true],
  ["phone-land", 852, 393, true],
  ["ipad", 820, 1180, true],
  ["laptop", 1210, 800, false],
  ["desktop", 1366, 768, false],
  ["fhd", 1920, 1080, false],
].filter((v) => !ONLY.length || ONLY.includes(v[0]));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function overflow(page) {
  return page.evaluate(() => {
    const W = window.innerWidth;
    const H = window.innerHeight;
    const bad = [];
    if (document.documentElement.scrollWidth > W + 1) bad.push(`page scrollWidth ${document.documentElement.scrollWidth} > ${W}`);
    for (const el of document.querySelectorAll(".rd-root *")) {
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) continue;
      const cs = getComputedStyle(el);
      if (cs.visibility === "hidden" || cs.opacity === "0") continue;
      if (el.closest(".rd-fx,.rd-look")) continue;
      // 位于可滚动容器内部的元素按容器裁剪
      let p = el.parentElement, clipped = false;
      while (p && !p.classList.contains("rd-root")) {
        const o = getComputedStyle(p).overflowY;
        if (o === "auto" || o === "scroll" || o === "hidden") { clipped = true; break; }
        p = p.parentElement;
      }
      if (clipped) continue;
      if (r.right > W + 1 || r.left < -1 || r.bottom > H + 1) bad.push(`${el.tagName}.${el.className} [${Math.round(r.left)},${Math.round(r.top)},${Math.round(r.right)},${Math.round(r.bottom)}]`);
    }
    return bad.slice(0, 8);
  });
}

(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM || "/usr/bin/chromium",
    args: ["--no-sandbox", "--no-proxy-server", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
  });
  const results = [];
  for (const [name, w, h, touch] of VPS) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, hasTouch: touch, isMobile: touch && w < 900 });
    const page = await ctx.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
    page.on("console", (m) => {
      if (m.type() === "error" && !/api|favicon|Failed to load resource/i.test(m.text())) errors.push("console: " + m.text());
    });
    const t0 = Date.now();
    const res = { name, w, h, stations: [], overflow: [], errors, ok: false };
    try {
      await page.goto(`${BASE}/pc?ride=access&dpr=1`, { waitUntil: "domcontentloaded" });
      await page.waitForSelector(".rd-cap", { timeout: 60000 });
      // 加速
      for (let i = 0; i < 5; i++) await page.keyboard.press("e");
      let shotMid = false;
      let last = "";
      for (let step = 0; Date.now() - t0 < Number(process.env.TMAX || 240000); step++) {
        if (await page.$(".rd-sum")) break;
        const title = await page.$eval(".rd-cap h2", (e) => e.textContent).catch(() => "");
        if (title && title !== last) {
          last = title;
          res.stations.push(title);
          if (process.env.SHOTS) { await sleep(1800); await page.screenshot({ path: path.join(OUT, `dbg-${name}-${res.stations.length}.png`) }); }
        }
        if (!shotMid && /L1/.test(title)) {
          const arrived = await page.$eval(".rd-next", (e) => e.textContent.includes("继续")).catch(() => false);
          if (arrived) {
            await sleep(2600);
            await page.screenshot({ path: path.join(OUT, `${name}-l1.png`) });
            res.overflow.push(...(await overflow(page)));
            shotMid = true;
          }
        }
        const btn = await page.$(".rd-next:not([disabled])");
        if (btn) {
          const txt = await btn.textContent();
          if (txt.includes("继续") || txt.includes("小结")) await btn.click();
        }
        await sleep(450);
      }
      if (await page.$(".rd-sum")) {
        res.ok = true;
        await sleep(400);
        await page.screenshot({ path: path.join(OUT, `${name}-summary.png`) });
        res.overflow.push(...(await overflow(page)));
      }
    } catch (e) {
      errors.push("script: " + e.message);
      await page.screenshot({ path: path.join(OUT, `${name}-fail.png`) }).catch(() => {});
    }
    res.ms = Date.now() - t0;
    results.push(res);
    console.log(JSON.stringify(res));
    await ctx.close();
  }
  fs.writeFileSync(path.join(OUT, `results-${ONLY.join("_") || "all"}.json`), JSON.stringify(results, null, 2));
  await browser.close();
})();
