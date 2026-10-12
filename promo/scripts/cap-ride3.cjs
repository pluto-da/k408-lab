const { chromium } = require("/workspace/work/pw/node_modules/playwright-core");
const fs = require("fs");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const [W,H,DPR,TAG,MOB] = [ +process.argv[2], +process.argv[3], +process.argv[4], process.argv[5], process.argv[6]==="1" ];
const TARGETS = (process.argv[7]||"7,8,9,10,11").split(",").map(Number);
const OUT = `shots/ride2-${TAG}`; fs.mkdirSync(OUT, { recursive: true });
(async () => {
  const b = await chromium.launch({ executablePath: "/usr/bin/chromium", args: ["--no-sandbox", "--no-proxy-server", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
  const ctx = await b.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: DPR, hasTouch: MOB, isMobile: MOB });
  const p = await ctx.newPage(); const errs=[]; p.on("pageerror", (e) => errs.push(e.message));
  const t0=Date.now(); const T=()=>((Date.now()-t0)/1000).toFixed(0);
  const shot = async (n) => { for (let k=0;k<3;k++){ try { await p.screenshot({path:`${OUT}/${n}.png`, timeout: 100000}); console.log(T(), "shot", n); return; } catch(e){ console.log("retry", n); } } };
  await p.goto("http://154.8.183.93/pc?ride=access", { waitUntil: "domcontentloaded" });
  await p.waitForSelector(".rd-panel", { timeout: 150000 }); await sleep(8000);
  const titles = await p.$$eval(".rd-steps span", (s)=>s.map(x=>x.title)); console.log(JSON.stringify(titles));
  const num = async () => { const t = await p.evaluate(()=>{const e=document.querySelector(".rd-panel");return e?e.textContent.slice(0,12):""}); const m=/(\d+)\s*\/\s*(\d+)/.exec(t); return m?+m[1]:0; };
  for (const k of TARGETS) {
    const r = await p.$eval(".rd-steps", (e)=>{const r=e.getBoundingClientRect(); return {x:r.left,y:r.top,w:r.width,h:r.height};});
    const N = titles.length;
    await p.mouse.click(r.x + (k-0.5)*r.w/N, r.y + r.h/2);
    for (let w=0; w<60; w++){ await sleep(1000); if (await num()===k) break; }
    console.log(T(), "at", await num());
    await sleep(9000);
    await shot(`st-${String(k).padStart(2,"0")}`);
  }
  // to summary
  for (let w=0; w<8 && !(await p.$(".rd-sum")); w++){ const bt = await p.$(".rd-next:not([disabled])"); if (bt) await bt.click().catch(()=>{}); await sleep(6000); }
  if (await p.$(".rd-sum")) { await sleep(3000); await shot("summary");
    const ok = await p.evaluate(()=>{ const b=[...document.querySelectorAll(".rd-sum button")].find(x=>/参数/.test(x.textContent)); if(b){b.click(); return true;} return false; });
    if (ok) { await sleep(5000); await shot("params"); }
  } else console.log("no summary");
  console.log("errs", errs.length, errs.slice(0,3)); await b.close();
})();
