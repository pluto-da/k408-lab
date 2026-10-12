import { chromium } from '/tmp/pw/node_modules/playwright-core/index.mjs';
const b = await chromium.launch({ executablePath: '/usr/bin/chromium', args: ['--use-angle=swiftshader','--no-sandbox','--enable-unsafe-swiftshader','--no-proxy-server'] });
for (const [w,h] of [[390,844],[360,780]]) {
  const ctx = await b.newContext({ viewport:{width:w,height:h}, deviceScaleFactor:2, isMobile:true, hasTouch:true, locale:'zh-CN' });
  const p = await ctx.newPage();
  await p.goto('http://localhost:4173/pc',{waitUntil:'load',timeout:60000});
  await p.waitForTimeout(6000);
  await p.screenshot({path:`/workspace/work/redesign/pc-fix-${w}.png`});
  console.log(w, await p.evaluate(()=>[document.documentElement.scrollHeight, innerHeight, ...['.app-bar','.pc-head','.pc-tools','.pc-explode','.pc-parts','.pc-rgb'].map(s=>{const e=document.querySelector(s); if(!e) return s+':none'; const r=e.getBoundingClientRect(); return `${s} ${Math.round(r.top)}-${Math.round(r.bottom)} l${Math.round(r.left)} r${Math.round(r.right)}`})]));
  await ctx.close();
}
await b.close();
