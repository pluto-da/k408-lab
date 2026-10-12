const { chromium } = require('/workspace/work/pw/node_modules/playwright-core');
(async () => {
  const b = await chromium.launch({ executablePath: '/usr/bin/chromium', args: ['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
  for (const [w,h,t] of [[1920,1080,false],[1280,800,true],[393,852,true]]) {
    const ctx = await b.newContext({ viewport: { width: w, height: h }, hasTouch: t, isMobile: t && w < 600 });
    const p = await ctx.newPage();
    await p.goto('http://127.0.0.1:4174/pc'); await p.waitForSelector('.pc-loading', { state: 'detached', timeout: 45000 }).catch(()=>{}); await p.waitForTimeout(1500);
    console.log(w, JSON.stringify(await p.evaluate(() => Object.fromEntries(['.app-bar','.pc-head h1','.pc-tools','.pc-explode','.pc-parts','.pc-panel'].map(s => { const e = document.querySelector(s); if (!e) return [s, null]; const r = e.getBoundingClientRect(); return [s, [Math.round(r.top), Math.round(r.bottom), Math.round(r.left), Math.round(r.right)]]; })))));
    await p.screenshot({ path: `/tmp/rwd-x/pcm-${w}.png` });
    await ctx.close();
  }
  await b.close();
})();
