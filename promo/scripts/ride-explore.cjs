const { chromium } = require("/workspace/work/pw/node_modules/playwright-core");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const [W,H,DPR,TAG,MOB] = [ +process.argv[2], +process.argv[3], +process.argv[4], process.argv[5], process.argv[6]==="1" ];
(async () => {
  const b = await chromium.launch({ executablePath: "/usr/bin/chromium", args: ["--no-sandbox", "--no-proxy-server", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
  const ctx = await b.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: DPR, hasTouch: MOB, isMobile: MOB });
  const p = await ctx.newPage();
  p.on("pageerror", (e) => console.log("ERR", e.message));
  const t0=Date.now(); const T=()=>((Date.now()-t0)/1000).toFixed(1);
  await p.goto("http://154.8.183.93/pc?ride=access", { waitUntil: "domcontentloaded" });
  await p.waitForSelector(".rd-panel, .rd-pick", { timeout: 100000 });
  console.log(T(),"panel", await p.evaluate(()=>!!document.querySelector(".rd-pick")));
  for (let i=0;i<40;i++){
    await sleep(4000);
    const s = await p.evaluate(()=>({t:(document.querySelector(".rd-panel")||document.body).textContent.slice(0,50), sum:!!document.querySelector(".rd-sum"), next:!!document.querySelector(".rd-next:not([disabled])")}));
    await p.screenshot({path:`explore/ride-${TAG}-${String(i).padStart(2,"0")}.jpg`, quality:70});
    console.log(T(), i, JSON.stringify(s));
    if (s.sum) break;
  }
  await b.close();
})();
