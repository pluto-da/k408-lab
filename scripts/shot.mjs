import { chromium, devices } from '/tmp/pw/node_modules/playwright-core/index.mjs';
const base = process.argv[2]; const paths = process.argv.slice(3);
const b = await chromium.launch({ executablePath: process.env.CH, args: ['--use-angle=swiftshader','--no-sandbox','--enable-unsafe-swiftshader','--no-proxy-server'] });
const ctx = await b.newContext({ ...devices['Pixel 7'], locale: 'zh-CN' });
for (const p of paths) {
  const page = await ctx.newPage();
  const logs = [];
  page.on('console', m => { if (['error','warning'].includes(m.type())) logs.push(m.type()+': '+m.text().slice(0,200)); });
  page.on('pageerror', e => logs.push('pageerror: '+e.message.slice(0,200)));
  page.on('requestfailed', r => logs.push('reqfail: '+r.url()));
  const t0 = Date.now();
  await page.goto(base + p, { waitUntil: 'load', timeout: 60000 }).catch(e=>logs.push('goto '+e.message));
  await page.waitForTimeout(p.includes('lab') ? 15000 : 2500);
  const name = p.replace(/[^a-z0-9]/gi,'_') || 'root';
  await page.screenshot({ path: `/workspace/work/shots/${name}.png`, fullPage: !!process.env.FULL });
  const info = await page.evaluate(() => ({ title: document.title, w: document.documentElement.scrollWidth, iw: innerWidth, h: document.documentElement.scrollHeight }));
  console.log(p, Date.now()-t0+'ms', JSON.stringify(info)); logs.slice(0,15).forEach(l=>console.log('  ',l));
  await page.close();
}
await b.close();
