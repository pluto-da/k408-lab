const { chromium } = require("/workspace/work/pw/node_modules/playwright-core");
const fs = require("fs");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const [W,H,DPR,TAG,MOB] = [ +process.argv[2], +process.argv[3], +process.argv[4], process.argv[5], process.argv[6]==="1" ];
const OUT = `shots/ride2-${TAG}`; fs.mkdirSync(OUT, { recursive: true });
(async () => {
  const b = await chromium.launch({ executablePath: "/usr/bin/chromium", args: ["--no-sandbox", "--no-proxy-server", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
  const ctx = await b.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: DPR, hasTouch: MOB, isMobile: MOB });
  const p = await ctx.newPage(); const errs=[]; p.on("pageerror", (e) => errs.push(e.message));
  const t0=Date.now(); const T=()=>((Date.now()-t0)/1000).toFixed(0);
  const shot = async (n) => { for (let k=0;k<3;k++){ try { await p.screenshot({path:`${OUT}/${n}.png`, timeout: 100000}); console.log(T(), "shot", n); return; } catch(e){ console.log("retry", n); } } };
  await p.goto("http://154.8.183.93/pc?ride=access", { waitUntil: "domcontentloaded" });
  await p.waitForSelector(".rd-panel", { timeout: 150000 }); await sleep(8000);
  const num = async () => { const t = await p.evaluate(()=>{const e=document.querySelector(".rd-panel");return e?e.textContent.slice(0,12):""}); const m=/(\d+)\s*\/\s*(\d+)/.exec(t); return m?+m[1]:0; };
  const r = await p.$eval(".rd-steps", (e)=>{const r=e.getBoundingClientRect(); return {x:r.left,y:r.top,w:r.width,h:r.height};});
  await p.mouse.click(r.x + r.w - 3, r.y + r.h/2);
  for (let w=0; w<60; w++){ await sleep(1000); if (await num()===11) break; }
  await sleep(10000);
  for (let w=0; w<10 && !(await p.$(".rd-sum__card")); w++){ const bt = await p.$(".rd-next:not([disabled])"); if (bt) await bt.click().catch(()=>{}); await sleep(5000); }
  for (let w=0; w<20; w++){ const st = await p.evaluate(()=>{const c=document.querySelector(".rd-sum__card"); if(!c) return null; const r=c.getBoundingClientRect(); return {x:r.x,y:r.y,w:r.width,h:r.height,op:getComputedStyle(c).opacity, txt:c.textContent.slice(0,80)};}); console.log(T(), JSON.stringify(st)); if (st && +st.op>0.99 && st.h>50) break; await sleep(1500); }
  await sleep(4000); await shot("summary");
  const ok = await p.evaluate(()=>{ const b=[...document.querySelectorAll(".rd-sum button")].map(x=>x.textContent.trim()); return b; }); console.log(JSON.stringify(ok));
  await p.evaluate(()=>{ const b=[...document.querySelectorAll(".rd-sum button")].find(x=>/参数/.test(x.textContent)); b && b.click(); });
  await sleep(6000); await shot("params");
  console.log("errs", errs.length, errs.slice(0,3)); await b.close();
})();
