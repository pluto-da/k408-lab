const { chromium } = require("/workspace/work/pw/node_modules/playwright-core");
const BASE = process.argv[2] || "http://127.0.0.1:4174";
(async () => {
  const b = await chromium.launch({ executablePath: "/usr/bin/chromium", args: ["--no-sandbox","--use-angle=swiftshader","--enable-unsafe-swiftshader","--ignore-gpu-blocklist"] });
  for (const [w,h] of [[820,1180],[1366,1024]]) {
    const ctx = await b.newContext({ viewport: { width: w, height: h }, hasTouch: true });
    const p = await ctx.newPage(); const errs=[]; p.on("pageerror",e=>errs.push(e.message)); p.on("console",m=>{ if(m.type()==="error") errs.push(m.text().slice(0,150)); });
    await p.goto(BASE + "/pc", { waitUntil: "domcontentloaded" });
    await p.waitForSelector(".pc-loading", { state: "detached", timeout: 45000 }).catch(() => {});
    for (const t of [1500, 6000]) { await p.waitForTimeout(t); await p.screenshot({ path: `/workspace/work/v15/shots/pc_${w}_${t}.png` }); }
    console.log(w, errs);
    await ctx.close();
  }
  await b.close();
})();
