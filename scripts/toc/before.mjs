import { chromium } from '/workspace/work/pw/node_modules/playwright-core/index.mjs';
const base = process.argv[2], tag = process.argv[3];
const b = await chromium.launch({ executablePath: '/usr/bin/chromium', args: ['--no-sandbox','--no-proxy-server','--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
for (const [w,h,mob] of [[1210,800,true],[393,852,true]]) {
  const ctx = await b.newContext({ viewport:{width:w,height:h}, deviceScaleFactor:1, isMobile:mob, hasTouch:mob, locale:'zh-CN' });
  const p = await ctx.newPage();
  await p.goto(base+'/lab#prop', { waitUntil:'load', timeout:60000 });
  await p.waitForFunction(() => window.__LEGACY_BOOTED__, null, { timeout:60000 });
  await p.waitForTimeout(2500);
  await p.click('#x-tocbtn'); await p.waitForTimeout(500);
  await p.screenshot({ path:`shots/${tag}-${w}x${h}.png` });
  await ctx.close();
}
await b.close();
