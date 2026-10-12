import { chromium } from '/workspace/work/pw/node_modules/playwright-core/index.mjs';
const b = await chromium.launch({ executablePath: '/usr/bin/chromium', args: ['--no-sandbox'] });
const p = await (await b.newContext({ viewport:{width:1300,height:900}, deviceScaleFactor:1 })).newPage();
const errs=[]; p.on('pageerror',e=>errs.push(e.message)); p.on('console',m=>{ if(m.type()==='error') errs.push(m.text()); });
await p.goto('file:///workspace/work/dsproc/h.html'); await p.waitForTimeout(500);
const jobs = process.argv.slice(2);
for (const j of jobs) {
  const [id, mode, step] = j.split(':');
  await p.evaluate((id)=>window.X_OPEN_PROC(id), id);
  await p.locator('.x-proc__modes button').nth(Number(mode)).click().catch(()=>{});
  await p.waitForTimeout(100);
  const n = await p.locator('.x-proc__steps li').count();
  const k = step === 'last' ? n-1 : Number(step);
  await p.locator('.x-proc__steps li button').nth(k).click();
  await p.waitForTimeout(150);
  await p.locator('.x-proc__svg').screenshot({ path: `shots/${id}-${mode}-${step}.png` });
  console.log(j, n, await p.locator('.x-proc__t').textContent());
}
console.log('errs', errs);
await b.close();
