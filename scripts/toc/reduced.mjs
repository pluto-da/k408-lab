import { chromium } from '/workspace/work/pw/node_modules/playwright-core/index.mjs';
const base = process.argv[2];
const b = await chromium.launch({ executablePath: '/usr/bin/chromium', args: ['--no-sandbox','--no-proxy-server'] });
const log = (...a) => console.log(...a);
async function boot(ctx, url) { const p = await ctx.newPage(); const errs=[]; p.on('pageerror', e => errs.push(e.message)); p.errs = errs;
  await p.goto(base+url); await p.waitForFunction(() => window.__LEGACY_BOOTED__ && document.querySelector('.x-toc--grp')); await p.waitForTimeout(1200); return p; }
// reduced motion
{
  const ctx = await b.newContext({ viewport:{width:1366,height:768}, reducedMotion: 'reduce' });
  const p = await boot(ctx, '/lab');
  await p.click('#x-toc .x-toc__g[data-g="proc"] > .x-toc__tg'); await p.click('#x-toc .x-toc__g[data-g="proc"] > .x-toc__tg');
  log('reduced: hidden immediately', await p.evaluate(() => document.getElementById('x-toc-w-proc').hidden), await p.evaluate(() => getComputedStyle(document.getElementById('x-toc-w-proc')).transitionDuration));
  await ctx.close();
}
await b.close();
