// Feasibility probe: virtual-time deterministic capture of the live 3D page.
// usage: node vt-probe.cjs <url> <frames> <out_dir> [w h]
const { chromium } = require("/workspace/work/pw/node_modules/playwright-core");
const fs = require("fs");
const [URL, NF, OUT, W, H] = [process.argv[2], +process.argv[3] || 20, process.argv[4] || "/tmp/vt", +process.argv[5] || 960, +process.argv[6] || 540];
const INIT = `(() => {
  let vt = 0; const T0 = 1760000000000; // fixed epoch
  const _now = performance.now.bind(performance);
  let rafQ = new Map(), rafId = 1, timers = new Map(), tid = 1;
  const RD = Date;
  function VDate(...a){ if (!(this instanceof VDate)) return new RD(T0+vt).toString(); return a.length? new RD(...a) : new RD(T0+vt); }
  VDate.prototype = RD.prototype; VDate.now = () => T0 + vt; VDate.parse = RD.parse; VDate.UTC = RD.UTC;
  window.Date = VDate;
  performance.now = () => vt;
  window.requestAnimationFrame = (cb) => { const id = rafId++; rafQ.set(id, cb); return id; };
  window.cancelAnimationFrame = (id) => rafQ.delete(id);
  window.setTimeout = (cb, ms=0, ...args) => { const id = tid++; timers.set(id, {at: vt + Math.max(0, +ms||0), cb, args}); return id; };
  window.setInterval = (cb, ms=0, ...args) => { const id = tid++; timers.set(id, {at: vt + Math.max(1, +ms||0), cb, args, every: Math.max(1, +ms||0)}); return id; };
  window.clearTimeout = window.clearInterval = (id) => timers.delete(id);
  window.__vt = { get t(){return vt;}, advance(ms){
      const end = vt + ms;
      for (;;) { // run timers in order up to end
        let next = null; for (const [id, t] of timers) if (t.at <= end && (!next || t.at < next[1].at)) next = [id, t];
        if (!next) break; const [id, t] = next; vt = Math.max(vt, t.at);
        if (t.every) t.at += t.every; else timers.delete(id);
        try { typeof t.cb === 'function' ? t.cb(...t.args) : eval(t.cb); } catch(e) { console.error(e); }
      }
      vt = end;
      try { for (const a of document.getAnimations()) { a.pause(); a.currentTime = (a.currentTime||0) + ms; } } catch(e) {}
      const q = rafQ; rafQ = new Map();
      for (const cb of q.values()) { try { cb(vt); } catch(e) { console.error(e); } }
  }};
})();`;
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const b = await chromium.launch({ executablePath: "/usr/bin/chromium", args: ["--no-sandbox", "--no-proxy-server", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
  const ctx = await b.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  const p = await ctx.newPage();
  await p.addInitScript(INIT);
  const t0 = Date.now();
  await p.goto(URL, { waitUntil: "domcontentloaded", timeout: 60000 });
  // let loading proceed: advance virtual time while real time passes (network still real)
  for (let i = 0; i < 40; i++) { await p.evaluate(() => window.__vt.advance(50)); await p.waitForTimeout(250); }
  const tl = Date.now();
  const per = [];
  for (let i = 0; i < NF; i++) {
    const s = Date.now();
    await p.evaluate(() => window.__vt.advance(1000/60));
    await p.screenshot({ path: `${OUT}/${String(i).padStart(4, "0")}.png` });
    per.push(Date.now() - s);
  }
  console.log(JSON.stringify({ load_ms: tl - t0, frames: NF, avg_ms_per_frame: Math.round(per.reduce((a, c) => a + c, 0) / NF), max_ms: Math.max(...per), vt: await p.evaluate(() => window.__vt.t) }));
  await b.close();
})().catch(e => { console.error("ERR", e.message); process.exit(1); });
