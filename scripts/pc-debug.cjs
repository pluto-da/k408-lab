const { chromium } = require("/tmp/pw/node_modules/playwright");
(async () => {
  const browser = await chromium.launch({ executablePath: "/usr/bin/chromium", args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--no-sandbox"] });
  const page = await browser.newPage({ viewport: { width: 1180, height: 820 } });
  page.on("console", (m) => { const t = m.text(); if (!/Future|DevTools|vite/.test(t)) console.log(`[${m.type()}] ${t}`); });
  page.on("pageerror", (e) => console.log(`[pageerror] ${e.message}`));
  await page.goto("http://127.0.0.1:5173/pc?dpr=1");
  await page.waitForSelector(".pc-loading", { state: "detached", timeout: 90000 });
  await page.waitForTimeout(4000);
  await page.locator(".pc-parts button").first().click();
  await page.waitForFunction(() => window.__pc && window.__pc.state === "open", null, { timeout: 100000 }).catch(() => {});
  for (let i = 0; i < 9; i++) { await page.waitForTimeout(7000); console.log("t", i, await page.evaluate(() => { const s = window.__pc.spark; return JSON.stringify([s.activeSplats, window.__pc.stats.frames, s.sorting, s.sortDirty, s.display.mappingVersion, s.current.mappingVersion, s.display.numSplats, s.current.numSplats]); })); }
  await page.screenshot({ path: "/tmp/dbg.png", timeout: 60000 });
  const info = await page.evaluate(() => {
    const e = window.__pc; const p = e.parts.get("cpu");
    const bb = p.interior && p.interior.mesh.getBoundingBox(true);
    const vis = [...e.parts.values()].map((q) => [q.id, q.opacity.toFixed(2), q.mesh && q.mesh.visible]);
    return { bb: bb && [bb.min.toArray(), bb.max.toArray()], vis, spark: Object.keys(e.spark).filter(k=>/num|count|active/i.test(k)).map(k=>[k, e.spark[k]]), cv: e.calloutVis, tw: e.tweens.map(t=>t.key), state: e.state, frames: e.stats.frames, cam: e.camera.position.toArray(), tgt: e.controls.target.toArray(),
      interior: p.interior ? { vis: p.interior.group.visible, pos: p.interior.group.position.toArray(), op: p.interior.mesh.opacity, n: p.interior.mesh.packedSplats?.numSplats, init: p.interior.mesh.isInitialized } : null,
      callouts: [...document.querySelectorAll(".pc-callout")].map((c) => [c.textContent, c.style.transform, c.style.opacity, c.offsetWidth]).slice(0, 4) };
  });
  console.log(JSON.stringify(info));
  await browser.close();
})();
