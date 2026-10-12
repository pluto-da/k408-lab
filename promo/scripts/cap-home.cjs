const { chromium } = require("/workspace/work/pw/node_modules/playwright-core");
const fs = require("fs");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const [W,H,DPR,TAG,MOB] = [ +process.argv[2], +process.argv[3], +process.argv[4], process.argv[5], process.argv[6]==="1" ];
const OUT = `shots/home-${TAG}`; fs.mkdirSync(OUT, { recursive: true });
(async () => {
  const b = await chromium.launch({ executablePath: "/usr/bin/chromium", args: ["--no-sandbox", "--no-proxy-server"] });
  const ctx = await b.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: DPR, hasTouch: MOB, isMobile: MOB });
  const p = await ctx.newPage(); const errs=[]; p.on("pageerror", (e) => errs.push(e.message));
  await p.goto("http://154.8.183.93/", { waitUntil: "networkidle" }); await sleep(2000);
  await p.screenshot({ path: `${OUT}/top.png` });
  await p.screenshot({ path: `${OUT}/full.png`, fullPage: true });
  const pos = await p.evaluate(()=>Object.fromEntries(["hm-subjects","hm-labs","hm-journey"].map(id=>[id, document.getElementById(id).getBoundingClientRect().top+scrollY])));
  fs.writeFileSync(`${OUT}/pos.json`, JSON.stringify(pos)); console.log(TAG, JSON.stringify(pos), "errs", errs);
  await b.close();
})();
