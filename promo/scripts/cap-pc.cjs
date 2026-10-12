const { chromium } = require("/workspace/work/pw/node_modules/playwright-core");
const fs = require("fs");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const [W,H,DPR,TAG,MOB] = [ +process.argv[2], +process.argv[3], +process.argv[4], process.argv[5], process.argv[6]==="1" ];
const OUT = `shots/pc-${TAG}`; fs.mkdirSync(OUT, { recursive: true });
(async () => {
  const b = await chromium.launch({ executablePath: "/usr/bin/chromium", args: ["--no-sandbox", "--no-proxy-server", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
  const ctx = await b.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: DPR, hasTouch: MOB, isMobile: MOB });
  const p = await ctx.newPage(); const errs=[]; p.on("pageerror", (e) => errs.push(e.message));
  const t0=Date.now(); const T=()=>((Date.now()-t0)/1000).toFixed(0);
  const shot = async (n) => { for (let k=0;k<3;k++){ try { await p.screenshot({path:`${OUT}/${n}.png`, timeout: 90000}); console.log(T(), n); return; } catch(e){ console.log("retry", n); } } };
  await p.goto("http://154.8.183.93/pc", { waitUntil: "domcontentloaded" });
  await p.waitForSelector(".pc-explode", { timeout: 150000 });
  await sleep(10000); await shot("overview");
  const setEx = (v) => p.evaluate((v)=>{ const i=document.querySelector(".pc-explode input"); const s=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,"value").set; s.call(i,String(v)); i.dispatchEvent(new Event("input",{bubbles:true})); i.dispatchEvent(new Event("change",{bubbles:true})); }, v);
  await setEx(0.5); await sleep(9000); await shot("explode-50");
  await setEx(1); await sleep(9000); await shot("explode-100");
  await setEx(0); await sleep(6000);
  for (const part of (process.argv[7]||"CPU 与散热器,显卡").split(",")) {
    await p.evaluate((t)=>{ const bt=[...document.querySelectorAll(".pc-parts button")].find(b=>b.textContent.includes(t)); bt && bt.click(); }, part);
    await sleep(16000); await shot(`open-${part}-0`);
    for (let k=1;k<=3;k++){ await p.mouse.move(W*0.4, H*0.5); for (let j=0;j<4;j++){ await p.mouse.wheel(0, 300); await sleep(200);} await sleep(8000); await shot(`open-${part}-${k}`); }
    await p.evaluate(()=>{ const bt=document.querySelector(".pc-btn--back"); bt && bt.click(); }); await sleep(12000);
  }
  console.log("errs", errs.length, errs.slice(0,3)); await b.close();
})();
