import { chromium } from '/workspace/work/pw/node_modules/playwright-core/index.mjs';
const base = process.argv[2] || 'http://localhost:4173';
const ids = (process.argv[3] || '').split(',').filter(Boolean);
const vw = Number(process.argv[4] || 1280), vh = vw < 600 ? 844 : 900;
const b = await chromium.launch({ executablePath: '/usr/bin/chromium', args: ['--no-sandbox','--no-proxy-server'] });
const ctx = await b.newContext({ viewport:{width:vw,height:vh}, isMobile: vw<600, hasTouch: vw<600, deviceScaleFactor: 1, locale:'zh-CN' });
const p = await ctx.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message)); p.on('console',m=>{ if(m.type()==='error') errs.push(m.text()); });
await p.goto(base + '/lab', { waitUntil: 'load', timeout: 60000 });
await p.waitForFunction(() => window.X_OPEN_PROC, null, { timeout: 60000 });
for (const id of ids) {
  const [pid, mode, steps] = id.split(':');
  await p.evaluate((pid) => { window.X_OPEN_PROC(pid); document.getElementById('proc').scrollIntoView(); }, pid);
  if (mode) { await p.locator('.x-proc__modes button').nth(Number(mode)).click(); }
  const n = Number(steps || 3);
  for (let i = 0; i < n; i++) { const nx = p.locator('.x-proc [data-a="next"]'); if (await nx.isVisible() && await nx.isEnabled()) await nx.click(); }
  await p.waitForTimeout(900);
  const el = p.locator('#x-proc');
  await el.screenshot({ path: `shots/proc/${pid}-${mode||0}-${vw}.png` });
  const ov = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  console.log(id, 'overflowX', ov, 'card:', (await p.locator('.x-proc__t').textContent()));
}
console.log('errs', errs);
await b.close();
