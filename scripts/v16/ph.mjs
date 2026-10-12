import { chromium } from '/workspace/work/pw/node_modules/playwright-core/index.mjs';
const b = await chromium.launch({ executablePath: '/usr/bin/chromium', args: ['--no-sandbox','--no-proxy-server'] });
for (const [w,h,t] of [[1024,768,false],[1024,768,true],[1210,800,true],[1280,800,true],[1366,768,false],[820,1180,true],[393,852,true]]) {
  const ctx = await b.newContext({ viewport:{width:w,height:h}, hasTouch:t, isMobile: t&&w<600, locale:'zh-CN' }); const p = await ctx.newPage();
  await p.goto('http://127.0.0.1:4178/lab', { waitUntil:'load' }); await p.waitForFunction(() => window.__LEGACY_BOOTED__ && document.querySelector('.x-toc--grp'));
  if (w < 1024) { await p.evaluate(() => document.getElementById('x-tocbtn').click()); await p.waitForTimeout(400); }
  console.log(w,h,t, JSON.stringify(await p.evaluate(() => { const q = document.querySelector('.x-toc__q'), cs = getComputedStyle(q); const c = document.createElement('canvas').getContext('2d'); c.font = cs.fontSize + ' ' + cs.fontFamily; const avail = q.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight); return { avail: Math.round(avail), text: Math.round(c.measureText(q.placeholder).width), fs: cs.fontSize, all: document.querySelector('.x-toc__all').getBoundingClientRect().width|0 }; })));
  await ctx.close();
}
await b.close();
