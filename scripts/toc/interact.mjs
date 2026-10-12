import { chromium } from '/workspace/work/pw/node_modules/playwright-core/index.mjs';
const base = process.argv[2];
const b = await chromium.launch({ executablePath: '/usr/bin/chromium', args: ['--no-sandbox','--no-proxy-server'] });
const log = (...a) => console.log(...a);
async function boot(ctx, url) { const p = await ctx.newPage(); const errs=[]; p.on('pageerror', e => errs.push(e.message)); p.errs = errs;
  await p.goto(base+url); await p.waitForFunction(() => window.__LEGACY_BOOTED__ && document.querySelector('.x-toc--grp')); await p.waitForTimeout(1200); return p; }
// desktop
{
  const ctx = await b.newContext({ viewport:{width:1366,height:768} });
  let p = await boot(ctx, '/lab');
  // page tab click → toc highlight, page scroll unaffected by toc reveal
  await p.evaluate(() => document.getElementById('lab').scrollIntoView()); await p.waitForTimeout(600);
  const y0 = await p.evaluate(() => scrollY);
  await p.evaluate(() => document.getElementById('tab-hash').click()); await p.waitForTimeout(500);
  log('lab tab click', await p.evaluate(() => ({ cur: document.querySelector('#x-toc a[data-lab][aria-current]')?.textContent, open: X_TOC.state().open })), 'page dy', (await p.evaluate(() => scrollY)) - y0);
  // proc via X_OPEN_PROC
  await p.evaluate(() => { document.getElementById('proc').scrollIntoView(); }); await p.waitForTimeout(500);
  await p.evaluate(() => document.getElementById('ptab-dns').click()); await p.waitForTimeout(500);
  const vis = await p.evaluate(() => { const t = document.getElementById('x-toc'), a = t.querySelector('a[data-proc="dns"]'); const tr=t.getBoundingClientRect(), ar=a.getBoundingClientRect(); return { cur: a.getAttribute('aria-current'), visible: ar.top>=tr.top && ar.bottom<=tr.bottom, tocScroll: t.scrollTop, open: X_TOC.state().open }; });
  log('proc tab', vis);
  // chapter link in toc
  await p.evaluate(() => document.querySelector('#x-toc .x-toc__g[data-g="os"] > .x-toc__tg').click()); await p.waitForTimeout(300);
  await p.click('#x-toc a[data-ch="os:2"]'); await p.waitForTimeout(1200);
  log('chapter', await p.evaluate(() => ({ pressed: document.querySelectorAll('#os .x-ch button')[2].getAttribute('aria-pressed'), cur: document.querySelector('#x-toc a[data-ch^="os:"][aria-current]')?.textContent, osTop: Math.round(document.getElementById('os').getBoundingClientRect().top) })));
  // animation: collapse hides after delay; inert immediately
  const tg = '#x-toc .x-toc__g[data-g="os"] > .x-toc__tg';
  await p.click(tg);
  log('collapse t0', await p.evaluate(() => { const w = document.getElementById('x-toc-w-os'); return { inert: w.inert, hidden: w.hidden }; }));
  await p.waitForTimeout(300);
  log('collapse t300', await p.evaluate(() => { const w = document.getElementById('x-toc-w-os'); return { inert: w.inert, hidden: w.hidden }; }));
  // keyboard: focus toggle, ArrowRight expands, Tab goes into list
  await p.focus('#x-toc .x-toc__g[data-g="prop"] > .x-toc__tg'); await p.keyboard.press('ArrowRight'); await p.waitForTimeout(300);
  log('arrow expand', await p.evaluate(() => document.querySelector('#x-toc .x-toc__g[data-g="prop"] > .x-toc__tg').getAttribute('aria-expanded')));
  await p.keyboard.press('Tab'); log('tab →', await p.evaluate(() => document.activeElement.className + ' ' + document.activeElement.textContent.trim().slice(0,12)));
  await p.keyboard.press('Shift+Tab'); await p.keyboard.press('Enter'); await p.waitForTimeout(300);
  await p.keyboard.press('Tab'); log('after collapse tab →', await p.evaluate(() => document.activeElement.textContent.trim().slice(0,12)));
  // persistence
  await p.evaluate(() => document.querySelector('#x-toc .x-toc__g[data-g="lab"] > .x-toc__tg').click());
  const ls = await p.evaluate(() => localStorage.getItem('x408.toc.open'));
  await p.evaluate(() => scrollTo(0,0));
  await p.close(); p = await boot(ctx, '/lab');
  log('persist', ls, '→ after reload', await p.evaluate(() => X_TOC.state().open));
  // jump menu
  await p.click('#x-toc .x-toc__jump'); await p.keyboard.press('ArrowDown'); await p.keyboard.press('ArrowDown');
  const f = await p.evaluate(() => document.activeElement.textContent); await p.keyboard.press('Escape');
  log('menu focus', f, 'closed', await p.evaluate(() => document.getElementById('x-toc-menu').hidden), 'focus back', await p.evaluate(() => document.activeElement.className));
  await p.click('#x-toc .x-toc__jump'); await p.click('#x-toc-menu a[data-g="prop"]'); await p.waitForTimeout(1200);
  log('menu jump', await p.evaluate(() => ({ hash: location.hash, top: Math.round(document.getElementById('prop').getBoundingClientRect().top), open: X_TOC.state().open })));
  // overscroll / page scroll during toc scroll: wheel inside toc
  const y1 = await p.evaluate(() => scrollY);
  await p.mouse.move(150, 500); await p.mouse.wheel(0, 3000); await p.waitForTimeout(400);
  log('wheel in toc: toc scrollTop', await p.evaluate(() => document.getElementById('x-toc').scrollTop), 'page dy', (await p.evaluate(() => scrollY)) - y1);
  // global search hides sections → toc groups hidden
  await p.fill('#x-q', 'TCP'); await p.waitForTimeout(600);
  log('global search hidden groups', await p.evaluate(() => [...document.querySelectorAll('.x-toc__root > li[hidden]')].map(l => l.dataset.g).join(',')));
  log('errs', p.errs);
  await ctx.close();
}
// phone sheet
{
  const ctx = await b.newContext({ viewport:{width:393,height:852}, isMobile:true, hasTouch:true });
  const p = await boot(ctx, '/lab');
  await p.evaluate(() => document.getElementById('x-tocbtn').click()); await p.waitForTimeout(400);
  await p.tap('#x-toc .x-toc__g[data-g="lab"] > .x-toc__tg'); await p.waitForTimeout(400);
  log('sheet after chevron', await p.evaluate(() => ({ open: document.getElementById('x-toc').classList.contains('is-open'), lock: document.documentElement.classList.contains('x-toc-lock') })));
  await p.tap('#x-toc .x-toc__sg[data-g="lab:cn"] > .x-toc__sh'); await p.waitForTimeout(400);
  await p.tap('#x-toc a[data-lab="tcp"]'); await p.waitForTimeout(1200);
  log('sheet after item', await p.evaluate(() => ({ open: document.getElementById('x-toc').classList.contains('is-open'), lock: document.documentElement.classList.contains('x-toc-lock'), sel: document.getElementById('tab-tcp').getAttribute('aria-selected'), labTop: Math.round(document.getElementById('lab').getBoundingClientRect().top), y: scrollY })));
  await p.screenshot({ path: 'shots/after-393-afteritem.png' });
  log('errs', p.errs);
  await ctx.close();
}
// reduced motion
{
  const ctx = await b.newContext({ viewport:{width:1366,height:768}, reducedMotion: 'reduce' });
  const p = await boot(ctx, '/lab');
  await p.click('#x-toc .x-toc__g[data-g="proc"] > .x-toc__tg'); await p.click('#x-toc .x-toc__g[data-g="proc"] > .x-toc__tg');
  log('reduced: hidden immediately', await p.evaluate(() => document.getElementById('x-toc-w-proc').hidden), await p.evaluate(() => getComputedStyle(document.getElementById('x-toc-w-proc')).transitionDuration));
  await ctx.close();
}
await b.close();
