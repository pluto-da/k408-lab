const { chromium } = require('/workspace/work/pw/node_modules/playwright-core');
(async () => {
  const b = await chromium.launch({ executablePath: '/usr/bin/chromium', args: ['--no-sandbox','--no-proxy-server','--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
  const errs = [];
  // 1. menu drawer at 320 on / and /lab
  let ctx = await b.newContext({ viewport: { width: 320, height: 568 }, hasTouch: true, isMobile: true });
  let p = await ctx.newPage(); p.on('pageerror', e => errs.push(String(e)));
  for (const r of ['/', '/lab']) {
    await p.goto('http://127.0.0.1:4174' + r); await p.waitForTimeout(r === '/lab' ? 3000 : 800);
    await p.click('.app-menu'); await p.waitForTimeout(300);
    const links = await p.$$eval('.app-nav a', as => as.filter(a => a.getBoundingClientRect().height).map(a => a.textContent + ':' + Math.round(a.getBoundingClientRect().height)));
    console.log(r, 'drawer links', links.join(', '));
    await p.screenshot({ path: `/tmp/rwd-x/menu${r.replace(/\//g, '_')}.png` });
    await p.keyboard.press('Escape'); await p.waitForTimeout(200);
    console.log(r, 'closed after Esc:', await p.$eval('.app-bar', e => !e.classList.contains('is-menu')));
  }
  await ctx.close();
  // 2. /pc resize 1366 -> 344 -> 1366
  ctx = await b.newContext({ viewport: { width: 1366, height: 768 } });
  p = await ctx.newPage(); p.on('pageerror', e => errs.push(String(e)));
  await p.goto('http://127.0.0.1:4174/pc'); await p.waitForSelector('.pc-loading', { state: 'detached', timeout: 45000 }).catch(()=>{}); await p.waitForTimeout(800);
  for (const [w, h] of [[1366, 768], [344, 882], [673, 841], [852, 393], [1366, 768]]) {
    await p.setViewportSize({ width: w, height: h }); await p.waitForTimeout(600);
    const m = await p.evaluate(() => { const c = document.querySelector('.pc-canvas'); const s = document.querySelector('.pc-stage').getBoundingClientRect(); return { css: [c.clientWidth, c.clientHeight], buf: [c.width, c.height], stage: [Math.round(s.width), Math.round(s.height)], sw: document.documentElement.scrollWidth, dpr: window.__pcStats && window.__pcStats.dpr, sheet: !!document.querySelector('.pc-panel--sheet') }; });
    console.log('pc', w + 'x' + h, JSON.stringify(m));
    if (w === 852) await p.screenshot({ path: '/tmp/rwd-x/pc-852-resized.png' });
  }
  await ctx.close();
  // 3. phone DPR cap: 393x852 dsf 3
  ctx = await b.newContext({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 3, hasTouch: true, isMobile: true });
  p = await ctx.newPage(); p.on('pageerror', e => errs.push(String(e)));
  await p.goto('http://127.0.0.1:4174/pc?quality=high'); await p.waitForSelector('.pc-loading', { state: 'detached', timeout: 45000 }).catch(()=>{}); await p.waitForTimeout(800);
  console.log('phone dpr', await p.evaluate(() => ({ dpr: devicePixelRatio, eng: window.__pcStats.dpr, buf: document.querySelector('.pc-canvas').width })));
  // 3b. 408 考点 sheet open + landscape
  await p.setViewportSize({ width: 852, height: 393 }); await p.waitForTimeout(500);
  await p.click('.pc-tools .pc-btn:last-child'); await p.waitForTimeout(400);
  await p.screenshot({ path: '/tmp/rwd-x/pc-852-sheet.png' });
  await ctx.close();
  console.log('errors', errs);
  await b.close();
})();
