// capture lab animations: for each lab id, open it, press 播放, screencast frames for SEC seconds
const { chromium } = require("/workspace/work/pw/node_modules/playwright-core");
const fs = require("fs");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const [W,H,DPR,TAG,MOB,LABS,SEC] = [ +process.argv[2], +process.argv[3], +process.argv[4], process.argv[5], process.argv[6]==="1", process.argv[7].split(","), +(process.argv[8]||10) ];
const CLIP = MOB ? {x:0, y:205, width:393, height:390} : {x:300, y:52, width:960, height:540};
(async () => {
  const b = await chromium.launch({ executablePath: "/usr/bin/chromium", args: ["--no-sandbox", "--no-proxy-server", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
  const ctx = await b.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: DPR, hasTouch: MOB, isMobile: MOB });
  const p = await ctx.newPage();
  const errs=[]; p.on("pageerror", (e) => errs.push(e.message));
  await p.goto("http://154.8.183.93/lab#lab-sort", { waitUntil: "domcontentloaded" });
  await p.waitForSelector(".lab-loading", { state: "detached", timeout: 100000 });
  await sleep(2500);
  
  for (const id of LABS) {
    const [lab, algo] = id.split(":");
    const OUT = `shots/lab-${TAG}/${lab}${algo?"-"+algo:""}`; fs.mkdirSync(OUT, { recursive: true });
    const info = await p.evaluate(async ([lab, algo, MOB]) => {
      window.X_OPEN_LAB(lab);
      await new Promise(r=>setTimeout(r,600));
      const tab = document.getElementById("tab-"+lab);
      // active panel: the visible element containing a 播放 button
      const vis = (e)=>{const r=e.getBoundingClientRect(); return r.width>0 && r.height>0 && getComputedStyle(e).visibility!=="hidden";};
      const plays = [...document.querySelectorAll("#lab button")].filter(x=>x.textContent.trim()==="播放" && vis(x));
      if (algo) { const a=[...document.querySelectorAll("#lab button")].find(x=>x.textContent.trim()===algo && vis(x)); if (a) a.click(); await new Promise(r=>setTimeout(r,400)); }
      const pl = plays[0];
      // scroll so the panel stage is in view
      let host = pl; for (let i=0;i<8 && host.parentElement;i++){ host=host.parentElement; if (host.getBoundingClientRect().width > (MOB?350:900)) break; }
      const card = tab ? tab.closest("section,div") : null;
      return {plays: plays.length};
    }, [lab, algo, MOB]);
    // scroll: on desktop put tab bar near top; on phone put lab stage at top
    await p.evaluate((MOB)=>{
      const vis = (e)=>{const r=e.getBoundingClientRect(); return r.width>0 && r.height>0;};
      const pl=[...document.querySelectorAll("#lab button")].find(x=>x.textContent.trim()==="播放" && vis(x));
      if (MOB) { const y = pl.getBoundingClientRect().top + window.scrollY; window.scrollTo(0, Math.max(0, y - window.innerHeight*0.56)); }
      else { const y = document.getElementById("tab-sort").getBoundingClientRect().top + window.scrollY; window.scrollTo(0, Math.max(0, y - 70)); }
    }, MOB);
    await sleep(1500);
    // re-scroll after layout settles; on desktop put tab bar near top; on phone put lab stage at top
    await p.evaluate((MOB)=>{
      const vis = (e)=>{const r=e.getBoundingClientRect(); return r.width>0 && r.height>0;};
      const pl=[...document.querySelectorAll("#lab button")].find(x=>x.textContent.trim()==="播放" && vis(x));
      if (MOB) { const y = pl.getBoundingClientRect().top + window.scrollY; window.scrollTo(0, Math.max(0, y - window.innerHeight*0.56)); }
      else { const y = document.getElementById("tab-sort").getBoundingClientRect().top + window.scrollY; window.scrollTo(0, Math.max(0, y - 70)); }
    }, MOB);
    await sleep(800);
    await p.screenshot({ path: `${OUT}/before.png` });
    const frames=[]; let n=0;
    await p.evaluate(()=>{ const vis=(e)=>{const r=e.getBoundingClientRect(); return r.width>0&&r.height>0;}; const pl=[...document.querySelectorAll("#lab button")].find(x=>x.textContent.trim()==="播放" && vis(x)); pl.click(); });
    const tStart = Date.now();
    while (Date.now() - tStart < SEC*1000) {
      const t = (Date.now() - tStart)/1000;
      const buf = await p.screenshot({ type: "jpeg", quality: 93, clip: CLIP });
      const fn=`${OUT}/${String(n++).padStart(5,"0")}.jpg`; fs.writeFileSync(fn, buf); frames.push([fn, t]);
    }
    fs.writeFileSync(`${OUT}/index.json`, JSON.stringify(frames));
    console.log(lab, algo||"", "plays", info.plays, "frames", n, n? (frames[n-1][1]-frames[0][1]).toFixed(1)+"s":"");
  }
  console.log("errs", errs.length, errs.slice(0,3));
  await b.close();
})();
