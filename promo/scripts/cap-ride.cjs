// capture /pc?ride=access : screencast frames (timestamped) + PNG still at each station + summary card
const { chromium } = require("/workspace/work/pw/node_modules/playwright-core");
const fs = require("fs");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const [W,H,DPR,TAG,MOB] = [ +process.argv[2], +process.argv[3], +process.argv[4], process.argv[5], process.argv[6]==="1" ];
const OUT = `shots/ride-${TAG}`; fs.mkdirSync(OUT+"/sc", { recursive: true });
(async () => {
  const b = await chromium.launch({ executablePath: "/usr/bin/chromium", args: ["--no-sandbox", "--no-proxy-server", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
  const ctx = await b.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: DPR, hasTouch: MOB, isMobile: MOB });
  const p = await ctx.newPage();
  const errs=[]; p.on("pageerror", (e) => errs.push(e.message));
  const t0=Date.now(); const T=()=>((Date.now()-t0)/1000).toFixed(1);
  await p.goto("http://154.8.183.93/pc?ride=access", { waitUntil: "domcontentloaded" });
  await p.waitForSelector(".rd-panel", { timeout: 110000 });
  await sleep(6000);
  const cdp = await ctx.newCDPSession(p); let n=0; const idx=[];
  cdp.on("Page.screencastFrame", async (f) => { const fn=`${OUT}/sc/${String(n++).padStart(5,"0")}.jpg`; fs.writeFileSync(fn, Buffer.from(f.data,"base64")); idx.push([fn, Date.now()-t0, curStation]); cdp.send("Page.screencastFrameAck",{sessionId:f.sessionId}).catch(()=>{}); });
  let curStation=0;
  await cdp.send("Page.startScreencast", { format: "jpeg", quality: 92, maxWidth: Math.round(W*DPR), maxHeight: Math.round(H*DPR), everyNthFrame: 1 });
  const txt = () => p.evaluate(()=>{const e=document.querySelector(".rd-panel");return e?e.textContent.slice(0,40):""});
  const log=[];
  for (let i=0;i<14;i++){
    await sleep(MOB?5000:4500);
    const t = await txt(); const m=/(\d+)\s*\/\s*(\d+)/.exec(t);
    await p.screenshot({path:`${OUT}/st-${String(i).padStart(2,"0")}.png`});
    log.push({i, t:T(), txt:t}); console.log(T(), i, t);
    if (await p.$(".rd-sum")) { await sleep(2500); await p.screenshot({path:`${OUT}/summary.png`}); console.log("summary"); break; }
    curStation=i+1;
    const bt = await p.$(".rd-next:not([disabled])");
    if (bt) await bt.click().catch(()=>{}); else console.log("no next");
    await sleep(MOB?7000:6000);
  }
  await sleep(2000);
  if (await p.$(".rd-sum")) await p.screenshot({path:`${OUT}/summary.png`});
  await cdp.send("Page.stopScreencast").catch(()=>{});
  fs.writeFileSync(`${OUT}/index.json`, JSON.stringify({idx, log, errs}));
  console.log("frames", n, "errs", errs.length, errs.slice(0,3));
  await b.close();
})();
