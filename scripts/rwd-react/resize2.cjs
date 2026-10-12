const { chromium } = require('/workspace/work/pw/node_modules/playwright-core');
(async () => {
  const b = await chromium.launch({ executablePath: '/usr/bin/chromium', args: ['--no-sandbox','--no-proxy-server','--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
  const ctx = await b.newContext({ viewport: { width: 1366, height: 768 } });
  const p = await ctx.newPage(); p.on('pageerror', e => console.log('ERR', String(e)));
  await p.goto('http://127.0.0.1:4174/pc' + (process.argv[2]||'')); await p.waitForSelector('.pc-loading', { state: 'detached', timeout: 45000 }).catch(()=>{}); await p.waitForTimeout(800);
  for (const [w, h] of (process.argv[3]==='b'? [[1366,768],[852,393],[1366,768],[1366,768]] : [[1366, 768], [344, 882], [1366, 768], [852, 393], [1366, 768]])) {
    await p.setViewportSize({ width: w, height: h }); await p.waitForTimeout(Number(process.env.WAIT||1500));
    const m = await p.evaluate(() => { const c = document.querySelector('.pc-canvas'); const s = document.querySelector('.pc-stage').getBoundingClientRect(); return { iw: innerWidth, mq: matchMedia('(min-width: 1024px)').matches, buf: [c.width, c.height], stage: [Math.round(s.width), Math.round(s.height)], sheet: !!document.querySelector('.pc-panel--sheet') }; });
    console.log(w + 'x' + h, JSON.stringify(m));
  }
  await b.close();
})();
