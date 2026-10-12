// capture /pc?ride=access : PNG still at each station (after arrival), transit snapshots, summary card, params panel
const { chromium } = require("/workspace/work/pw/node_modules/playwright-core");
const fs = require("fs");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const [W,H,DPR,TAG,MOB] = [ +process.argv[2], +process.argv[3], +process.argv[4], process.argv[5], process.argv[6]==="1" ];
const OUT = `shots/ride2-${TAG}`; fs.mkdirSync(OUT, { recursive: true });
(async () => {
  const b = await chromium.launch({ executablePath: "/usr/bin/chromium", args: ["--no-sandbox", "--no-proxy-server", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
  const ctx = await b.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: DPR, hasTouch: MOB, isMobile: MOB });
  const p = await ctx.newPage();
  const errs=[]; p.on("pageerror", (e) => errs.push(e.message));
  const t0=Date.now(); const T=()=>((Date.now()-t0)/1000).toFixed(1);
  const shot = async (path) => { for (let k=0;k<3;k++){ try { await p.screenshot({path, timeout: 90000}); return true; } catch(e){ console.log("shot retry", path); } } return false; };
  await p.goto("http://154.8.183.93/pc?ride=access", { waitUntil: "domcontentloaded" });
  await p.waitForSelector(".rd-panel", { timeout: 110000 });
  await sleep(8000);
  const num = async () => { const t = await p.evaluate(()=>{const e=document.querySelector(".rd-panel");return e?e.textContent.slice(0,40):""}); const m=/(\d+)\s*\/\s*(\d+)/.exec(t); return [m?+m[1]:0, m?+m[2]:0, t]; };
  for (let i=0;i<16;i++){
    const [k,n,t] = await num();
    await shot(`${OUT}/st-${String(k).padStart(2,"0")}.png`); console.log(T(),"station",k,n,t.slice(5,30));
    if (await p.$(".rd-sum")) break;
    const bt = await p.$(".rd-next:not([disabled])");
    if (!bt) { console.log("no next"); await sleep(3000); if (await p.$(".rd-sum")) break; continue; }
    await bt.click().catch(()=>{});
    // transit snapshots
    await sleep(1200); await shot(`${OUT}/tr-${String(k).padStart(2,"0")}-a.png`);
    await sleep(1200); await shot(`${OUT}/tr-${String(k).padStart(2,"0")}-b.png`);
    for (let w=0; w<30; w++){ await sleep(1000); const [k2]=await num(); if (k2!==k || await p.$(".rd-sum")) break; }
    await sleep(4500);
  }
  await sleep(3000);
  if (await p.$(".rd-sum")) { await shot(`${OUT}/summary.png`); console.log(T(),"summary");
    const btn = await p.$$(".rd-sum .rd-btn"); for (const x of btn){ const tx=await x.textContent(); if(/参数/.test(tx)){ await x.click(); await sleep(4000); await shot(`${OUT}/params.png`); console.log("params"); break; } }
  }
  fs.writeFileSync(`${OUT}/errs.json`, JSON.stringify(errs));
  console.log("done errs", errs.length, errs.slice(0,3));
  await b.close();
})();
