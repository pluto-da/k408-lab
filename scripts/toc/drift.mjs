import { chromium } from '/workspace/work/pw/node_modules/playwright-core/index.mjs';
const base = process.argv[2];
const b = await chromium.launch({ executablePath: '/usr/bin/chromium', args: ['--no-sandbox','--no-proxy-server'] });
for (const [w,h,mob] of [[1210,800,true],[1366,768,false]]) for (const hash of ['#lab-kmp','#prop-ds-leaf']) {
  const ctx = await b.newContext({ viewport:{width:w,height:h}, isMobile:mob, hasTouch:mob });
  const p = await ctx.newPage(); const bad=[];
  p.on('response', r => { if (r.status()>=500) bad.push(r.url()); });
  await p.goto(base+'/lab'+hash); await p.waitForFunction(() => window.__LEGACY_BOOTED__); 
  const ys=[]; for (let i=0;i<6;i++){ await p.waitForTimeout(400); ys.push(await p.evaluate(()=>Math.round(scrollY)+':'+[...document.querySelectorAll('.x-sec')].filter(s=>s.id&&s.getBoundingClientRect().top<120).map(s=>s.id).pop())); }
  console.log(w, hash, ys.join(' '), bad.slice(0,2).join(' '));
  await ctx.close();
}
await b.close();
