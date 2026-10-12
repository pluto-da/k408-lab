// usage: node hero.cjs <url> <outpng> [dist] [dx dy dz] [ty]
// Captures the studio-mode /pc canvas with all UI hidden at 1180x820 and prints hotspot % coords.
const wf = require("./wf.cjs");
const { chromium } = require("/tmp/pw/node_modules/playwright");
(async () => {
  const [url, out, distS, dxS, dyS, dzS, tyS, rgbS] = process.argv.slice(2);
  const browser = await chromium.launch({
    executablePath: "/usr/bin/chromium",
    args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--no-sandbox"],
  });
  const W = 1180, H = 820;
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  page.on("pageerror", (e) => console.log(`[pageerror] ${e.message}`));
  await page.goto(url + "/pc?dpr=1&debug", { waitUntil: "domcontentloaded" });
  await wf(page, () => window.__pc && window.__pc.state === "overview", null, { timeout: 400000, polling: 1000 });
  await page.addStyleTag({ content: `body{visibility:hidden!important}
    .pc-stage{position:fixed!important;inset:0!important;width:100vw!important;height:100vh!important;z-index:99999}
    .pc-stage, .pc-stage *{visibility:visible!important}` });
  const dist = Number(distS || 0), d = [Number(dxS ?? -1), Number(dyS ?? 0.42), Number(dzS ?? 0.95)], ty = Number(tyS ?? 0.25);
  const res = await page.evaluate(async ([dist, d, ty, rgb]) => {
    const pc = window.__pc;
    pc.setShowAll(false);
    pc.setInset(0);
    window.dispatchEvent(new Event("resize"));
    if (rgb) pc.setLight?.("rgb");
    const T = pc.controls.target.clone().set(0, ty, 0);
    const D = pc.camera.position.clone().set(d[0], d[1], d[2]).normalize();
    const R = dist || pc.overviewDistance();
    pc.controls.enabled = false;
    pc.controls.target.copy(T);
    pc.camera.position.copy(T).addScaledVector(D, R);
    pc.camera.lookAt(T);
    pc.camera.updateMatrixWorld();
    return R;
  }, [dist, d, ty, rgbS === "rgb"]);
  const f = await page.evaluate(() => window.__pc.stats.frames);
  await wf(page, (f0) => window.__pc.stats.frames >= f0, f + 6, { timeout: 240000, polling: 300 });
  const spots = await page.evaluate(() => {
    const pc = window.__pc;
    const el = pc.renderer.domElement;
    const out = {};
    for (const [n, p, k] of [["cpu", "board", "cpu"], ["cpu2", "cpu", "cpu"], ["ram", "ram", "chips"], ["dimm", "board", "dimm"], ["gpu", "gpu", "die"], ["gpu_pcie", "gpu", "pcie"], ["hdd", "hdd", "hdd"], ["psu", "psu", "psu"], ["ssd", "ssd", "ssd"], ["nic", "nic", "chip"]]) {
      const v = pc.worldAnchor(p, k);
      if (!v) continue;
      v.project(pc.camera);
      out[n] = [+(((v.x + 1) / 2) * 100).toFixed(1), +(((1 - v.y) / 2) * 100).toFixed(1)];
    }
    return { spots: out, canvas: [el.clientWidth, el.clientHeight] };
  });
  console.log("dist", res, JSON.stringify(spots));
  await page.screenshot({ path: out });
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
