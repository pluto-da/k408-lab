import { chromium, devices } from '/tmp/pw/node_modules/playwright-core/index.mjs';
const base = process.argv[2]; const dev = process.argv[3] || 'Pixel 7';
const b = await chromium.launch({ executablePath: process.env.CH, args: ['--use-angle=swiftshader','--no-sandbox','--enable-unsafe-swiftshader','--no-proxy-server'] });
const ctx = await b.newContext({ ...devices[dev], locale: 'zh-CN', bypassCSP: !!process.env.BYPASS });
const page = await ctx.newPage();
const logs = [];
page.on('console', m => { if (['error','warning'].includes(m.type())) logs.push(m.type()+': '+m.text().slice(0,200)); });
page.on('pageerror', e => logs.push('pageerror: '+e.message.slice(0,300)));
await page.goto(base + '/lab', { waitUntil: 'load', timeout: 60000 });
await page.waitForFunction(() => window.__LEGACY_BOOTED__, null, { timeout: 60000 });
await page.waitForTimeout(3000);
const H = await page.evaluate(() => document.documentElement.scrollHeight);
const vh = page.viewportSize().height;
// overflow check
const over = await page.evaluate(() => { const W = document.documentElement.clientWidth; const r=[]; document.querySelectorAll('body *').forEach(e => { const b = e.getBoundingClientRect(); if (b.right > W + 2 && b.width>0 && getComputedStyle(e).position!=='fixed') { let p=e.parentElement, clipped=false; while(p){ const s=getComputedStyle(p); if(/(auto|scroll|hidden|clip)/.test(s.overflowX)){clipped=true;break;} p=p.parentElement;} if(!clipped) r.push(e.tagName+'.'+e.className+' '+Math.round(b.right)); } }); return r.slice(0,15); });
console.log('H', H, 'overflow', over);
let i = 0;
for (let y = 0; y < H; y += vh * 1.5) { await page.evaluate(y => window.scrollTo(0, y), y); await page.waitForTimeout(700); await page.screenshot({ path: `shots/lab-${dev.replace(/\W/g,'')}-${String(i++).padStart(2,'0')}.png` }); }
// small tap targets
const small = await page.evaluate(() => { const r=[]; document.querySelectorAll('button, a, [role=button], input, select').forEach(e => { const b=e.getBoundingClientRect(); if (b.width>0 && (b.height<32||b.width<32)) r.push((e.textContent||e.getAttribute('aria-label')||e.className).trim().slice(0,20)+' '+Math.round(b.width)+'x'+Math.round(b.height)); }); return [r.length, r.slice(0,25)]; });
console.log('small targets', JSON.stringify(small));
const unlabeled = await page.evaluate(() => [...document.querySelectorAll('input,select,textarea')].filter(e => !e.labels?.length && !e.getAttribute('aria-label') && !e.getAttribute('aria-labelledby') && e.type!=='hidden').map(e => e.outerHTML.slice(0,120)));
console.log('unlabeled', unlabeled.length, unlabeled.slice(0,10));
console.log(logs.slice(0,20).join('\n'));
await b.close();
