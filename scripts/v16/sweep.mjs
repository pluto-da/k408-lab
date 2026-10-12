import { chromium } from '/workspace/work/pw/node_modules/playwright-core/index.mjs';
const base = 'http://127.0.0.1:4178';
const VPS = JSON.parse(process.env.VPS || '[[1024,768,false],[1210,800,true]]');
const b = await chromium.launch({ executablePath: '/usr/bin/chromium', args: ['--no-sandbox','--no-proxy-server'] });
for (const [w,h,touch] of VPS) {
  const ctx = await b.newContext({ viewport:{width:w,height:h}, hasTouch: touch, locale:'zh-CN' });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(base + '/lab', { waitUntil: 'load' });
  await p.waitForFunction(() => window.__LEGACY_BOOTED__ && document.querySelector('.x-toc--grp'));
  const res = await p.evaluate(async () => {
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    const out = []; const main = document.querySelector('.x-layout > :not(#x-toc)'); const cr = main.getBoundingClientRect();
    const check = (root) => [...root.querySelectorAll('*')].filter(e => { if (!e.offsetParent) return false; const r = e.getBoundingClientRect(); if (!r.width) return false; let a = e.parentElement; while (a && a !== main) { const o = getComputedStyle(a).overflowX; if (o === 'auto' || o === 'scroll' || o === 'hidden') return false; a = a.parentElement; } return r.right > cr.right + 1; }).slice(0, 3).map(e => e.tagName + '.' + String(e.className.baseVal ?? e.className).slice(0, 30) + ':' + Math.round(e.getBoundingClientRect().right - cr.right));
    for (const [attr, fn, sec] of [['data-lab', 'X_OPEN_LAB', 'lab'], ['data-proc', 'X_OPEN_PROC', 'proc'], ['data-prop', 'X_OPEN_PROP', 'prop']]) {
      const ids = [...new Set([...document.querySelectorAll('#x-toc a[' + attr + ']')].map(a => a.getAttribute(attr)))];
      for (const id of ids) { try { window[fn](id); } catch (e) { out.push(id + ' ERR ' + e.message); continue; } await sleep(120);
        const o = check(document.getElementById(sec)); if (o.length) out.push(sec + ':' + id + ' ' + o.join(' '));
        if (document.documentElement.scrollWidth > innerWidth) out.push(sec + ':' + id + ' PAGE-OVERFLOW'); }
      out.push(sec + ' n=' + ids.length);
    }
    return out;
  });
  console.log(w + 'x' + h, JSON.stringify(res), 'errs', JSON.stringify(errs));
  await ctx.close();
}
await b.close();
