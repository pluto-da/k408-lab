import { chromium } from '/workspace/work/pw/node_modules/playwright-core/index.mjs';
const base = process.argv[2]; const only = process.argv[3];
const VPS = [[320,640,true],[393,852,true],[852,393,true],[820,1180,true],[1210,800,true],[1366,768,false],[1366,1024,false],[1920,1080,false],[2560,1440,false]];
const b = await chromium.launch({ executablePath: '/usr/bin/chromium', args: ['--no-sandbox','--no-proxy-server','--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
const out = [];
for (const [w,h,mob] of VPS) {
  if (only && !only.split(',').includes(String(w)+'x'+h)) continue;
  for (const hash of ['', '#prop-ds-leaf', '#lab-kmp']) {
    const ctx = await b.newContext({ viewport:{width:w,height:h}, deviceScaleFactor:1, isMobile:mob, hasTouch:mob, locale:'zh-CN' });
    const p = await ctx.newPage(); const errs = [];
    p.on('pageerror', e => errs.push('pageerror '+e.message)); p.on('console', m => { if (m.type()==='error') errs.push(m.text().slice(0,160)); });
    await p.goto(base+'/lab'+hash, { waitUntil:'load', timeout:60000 });
    await p.waitForFunction(() => window.__LEGACY_BOOTED__ && document.querySelector('.x-toc--grp'), null, { timeout:60000 });
    await p.waitForTimeout(1800);
    const tag = `${w}x${h}${hash.replace('#','-')}`;
    const sidebar = await p.evaluate(() => getComputedStyle(document.getElementById('x-toc')).position === 'sticky');
    if (!sidebar) { await p.evaluate(() => document.getElementById('x-tocbtn').click()); await p.waitForTimeout(500); }
    let filt = null, fitCollapsed = null;
    if (hash === '') {
      fitCollapsed = await p.evaluate(() => { const t = document.getElementById('x-toc'); return t.scrollHeight <= t.clientHeight + 1; });
    }
    const r = await p.evaluate(() => {
      const toc = document.getElementById('x-toc'), de = document.documentElement;
      const cnt = k => [...document.querySelectorAll(`.x-toc__g[data-g="${k}"] .x-toc__sg`)].map(s => s.dataset.g.split(':')[1]+':'+s.querySelectorAll('.x-toc__items>li').length).join(' ');
      const tr = toc.getBoundingClientRect();
      const cur = [...toc.querySelectorAll('.x-toc__items a[aria-current="true"], .x-toc__sub > li > a[aria-current="true"]')].filter(a => a.offsetParent).map(a => { const r = a.getBoundingClientRect(); return a.textContent + (r.top >= tr.top && r.bottom <= tr.bottom + 1 ? '[vis]' : '[off]'); });
      const over = [...toc.querySelectorAll('*')].filter(e => { const r = e.getBoundingClientRect(); return r.width && (r.right > tr.right + 1 || r.left < tr.left - 1); }).map(e => e.className).slice(0,5);
      return { hOverflow: de.scrollWidth - de.clientWidth, open: window.X_TOC.state().open.join(','), section: document.querySelector('.x-toc__root > li > a[aria-current]')?.textContent,
        fits: toc.scrollHeight <= toc.clientHeight + 1, tocH: [toc.clientHeight, toc.scrollHeight], tocW: Math.round(tr.width), cur, counts: ['lab','proc','prop'].map(cnt), over,
        scrollY: Math.round(scrollY), lock: getComputedStyle(de).overflow };
    });
    await p.screenshot({ path: `shots/after-${tag}.png` });
    if (hash === '') {
      await p.fill('.x-toc__q', 'TCP'); await p.waitForTimeout(400);
      filt = await p.evaluate(() => [...document.querySelectorAll('#x-toc .x-toc__items a, #x-toc .x-toc__sub > li > a')].filter(a => a.offsetParent && !a.closest('[hidden]')).map(a => a.textContent));
      await p.screenshot({ path: `shots/after-${tag}-filter.png` });
      await p.fill('.x-toc__q', ''); await p.waitForTimeout(300);
      filt = { n: filt.length, items: filt, restored: await p.evaluate(() => window.X_TOC.state().filter === '' && ![...document.querySelectorAll('.x-toc__root > li')].some(li => li.hidden)) };
    }
    out.push({ tag, sidebar, ...r, fitCollapsed, filt, errs: errs.filter(e => !/500/.test(e)) });
    console.log(JSON.stringify(out[out.length-1]));
    await ctx.close();
  }
}
await b.close();
