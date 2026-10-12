import { chromium, devices } from '/tmp/pw/node_modules/playwright-core/index.mjs';
const b = await chromium.launch({ executablePath: process.env.CH, args: ['--use-angle=swiftshader','--no-sandbox','--enable-unsafe-swiftshader','--no-proxy-server'] });
const ctx = await b.newContext({ ...devices['Pixel 7'], locale: 'zh-CN' });
const page = await ctx.newPage();
await page.goto(process.argv[2] + '/lab', { waitUntil: 'load' });
await page.waitForFunction(() => window.__LEGACY_BOOTED__, null, { timeout: 60000 });
await page.waitForTimeout(2000);
for (const y of [1373, 2746]) {
  await page.evaluate(y => window.scrollTo({top:y, behavior:'instant'}), y); await page.waitForTimeout(2500);
  console.log(y, await page.evaluate(() => { const e = document.elementFromPoint(200, 400); return e && (e.tagName+'#'+e.id+'.'+e.className+' | '+(e.closest('section')?.id)); }), await page.evaluate(()=>scrollY));
  await page.screenshot({ path: `shots/l2-${y}.png` });
}
await b.close();
