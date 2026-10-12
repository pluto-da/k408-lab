import { chromium } from '/workspace/work/pw/node_modules/playwright-core/index.mjs';
const base = process.argv[2] || 'http://127.0.0.1:4178'; const OUT = process.argv[3] || '/workspace/work/v16/shots';
const VPS = (process.env.VPS ? JSON.parse(process.env.VPS) : [[393,852,true],[820,1180,true],[1024,768,false],[1210,800,true],[1280,800,false],[1366,768,false],[1920,1080,false]]);
const ROUTES = (process.env.ROUTES || '/,/lab,/pc').split(',');
const b = await chromium.launch({ executablePath: '/usr/bin/chromium', args: ['--no-sandbox','--no-proxy-server','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'] });
const ign = t => /Failed to load resource|\/api\/|ERR_CONNECTION|ECONNREFUSED|WebGL|GPU stall|swiftshader|GL_|Cross-Origin-Opener-Policy|untrustworthy/i.test(t);
let bad = 0;
for (const [w,h,touch] of VPS) {
  const ctx = await b.newContext({ viewport:{width:w,height:h}, deviceScaleFactor:1, isMobile: touch && w < 600, hasTouch: touch, locale:'zh-CN' });
  for (const r of ROUTES) {
    const p = await ctx.newPage(); const errs = [];
    p.on('pageerror', e => errs.push('pageerror '+e.message)); p.on('console', m => { if (m.type()==='error' && !ign(m.text())) errs.push(m.text().slice(0,160)); });
    await p.goto(base + r, { waitUntil: 'load', timeout: 60000 });
    if (r === '/lab') await p.waitForFunction(() => window.__LEGACY_BOOTED__ && document.querySelector('.x-toc--grp'), null, { timeout: 60000 });
    await p.waitForTimeout(r === '/pc' ? 3000 : 1500);
    const res = await p.evaluate(() => ({ ov: document.documentElement.scrollWidth - document.documentElement.clientWidth }));
    let lab = null;
    if (r === '/lab') {
      lab = await p.evaluate(() => {
        const toc = document.getElementById('x-toc'), cs = getComputedStyle(toc);
        const q = s => document.querySelector(s); const W = e => e ? Math.round(e.getBoundingClientRect().width) : null;
        const main = q('.x-layout > :not(#x-toc)') || q('.x-layout > main');
        const panel = [...document.querySelectorAll('.x-lab__panel')].find(e => !e.hidden && e.offsetParent);
        // elements overflowing the content column
        const cr = main.getBoundingClientRect();
        const over = [...main.querySelectorAll('*')].filter(e => { if (!e.offsetParent) return false; const r = e.getBoundingClientRect(); if (!r.width) return false; let a=e; while (a && a!==main) { const o=getComputedStyle(a).overflowX; if (a!==e && (o==='auto'||o==='scroll'||o==='hidden'||o==='clip')) return false; a=a.parentElement; } return r.right > cr.right + 1; }).slice(0,5).map(e => e.tagName+'.'+String(e.className).slice(0,40)+':'+Math.round(e.getBoundingClientRect().right));
        return { mode: cs.position, tocW: W(toc), tocFits: toc.scrollHeight <= toc.clientHeight + 1, tocH:[toc.clientHeight,toc.scrollHeight], mainW: W(main),
          panelCols: panel ? getComputedStyle(panel).gridTemplateColumns : null, mainLab: W(panel && panel.querySelector('.x-lab__main')), sideLab: W(panel && panel.querySelector('.x-lab__side')), over };
      });
      if (w >= 1024 && lab.mode !== 'sticky') errs.push('TOC not sidebar at '+w);
      if (w < 1024 && lab.mode !== 'fixed') errs.push('TOC not fixed at '+w);
      if ((w === 1210 || w === 1366) && !lab.tocFits) errs.push('collapsed TOC scrolls');
      if (lab.over.length) errs.push('content overflow '+lab.over.join(' '));
    }
    const tag = `${w}x${h}${r.replace(/\//g,'_')}`;
    await p.screenshot({ path: `${OUT}/${tag}.png` });
    if (res.ov > 0) errs.push('page overflow '+res.ov);
    if (errs.length) bad++;
    console.log(JSON.stringify({ tag, ...res, lab, errs }));
    await p.close();
  }
  // deep link
  if (process.env.NODEEP) { await ctx.close(); continue; }
  const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', e => errs.push('pageerror '+e.message));
  await p.goto(base + '/lab#prop-ds-leaf', { waitUntil: 'load', timeout: 60000 });
  await p.waitForFunction(() => window.__LEGACY_BOOTED__ && document.querySelector('.x-toc--grp'), null, { timeout: 60000 });
  await p.waitForTimeout(2000);
  const d = await p.evaluate(() => { const a = document.querySelector('#x-toc a[data-prop="ds-leaf"]'); return { open: window.X_TOC.state().open.join(','), cur: a && a.getAttribute('aria-current'), vis: !!(a && a.closest('.x-toc__wrap.is-open')), sel: document.querySelector('.x-prop__item[aria-selected="true"]')?.textContent?.slice(0,20) }; });
  if (d.cur !== 'true' || !d.vis) errs.push('deep link not highlighted');
  if (errs.length) bad++;
  console.log(JSON.stringify({ tag: `${w}x${h} #prop-ds-leaf`, ...d, errs }));
  await p.close(); await ctx.close();
}
await b.close(); console.log('BAD', bad); process.exit(bad ? 1 : 0);
