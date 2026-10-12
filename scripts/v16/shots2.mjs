import { chromium } from '/workspace/work/pw/node_modules/playwright-core/index.mjs';
const base = process.argv[2] || 'http://127.0.0.1:4178'; const pre = process.argv[3] || '';
const b = await chromium.launch({ executablePath: '/usr/bin/chromium', args: ['--no-sandbox','--no-proxy-server'] });
// tablet 1210x800: collapsed TOC, scrolled to 性质与公式
let ctx = await b.newContext({ viewport:{width:1210,height:800}, hasTouch:true, locale:'zh-CN' });
let p = await ctx.newPage();
await p.goto(base + '/lab#prop', { waitUntil:'load' });
await p.waitForFunction(() => window.__LEGACY_BOOTED__ && document.querySelector('.x-toc--grp'));
await p.waitForTimeout(1500);
await p.evaluate(() => { const s = document.getElementById('prop'); const st = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--x-sticky')) || 70; window.scrollTo(0, s.getBoundingClientRect().top + scrollY - st - 60); });
await p.waitForTimeout(800);
await p.click('.x-toc__all'); await p.waitForTimeout(600);
console.log(JSON.stringify(await p.evaluate(() => { const t = document.getElementById('x-toc'); return { open: window.X_TOC.state().open, fits: t.scrollHeight <= t.clientHeight + 1, h: [t.clientHeight, t.scrollHeight] }; })));
await p.screenshot({ path: `/workspace/work/v16/${pre}tablet-toc.png` });
await ctx.close();
// phone 393: bottom sheet open
ctx = await b.newContext({ viewport:{width:393,height:852}, deviceScaleFactor:2, isMobile:true, hasTouch:true, locale:'zh-CN' });
p = await ctx.newPage();
await p.goto(base + '/lab#prop-ds-leaf', { waitUntil:'load' });
await p.waitForFunction(() => window.__LEGACY_BOOTED__ && document.querySelector('.x-toc--grp'));
await p.waitForTimeout(1500);
await p.evaluate(() => document.getElementById('x-tocbtn').click()); await p.waitForTimeout(600);
await p.screenshot({ path: `/workspace/work/v16/${pre}phone-toc.png` });
await b.close();
