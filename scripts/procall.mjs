import { chromium } from '/workspace/work/pw/node_modules/playwright-core/index.mjs';
const base = process.argv[2] || 'http://localhost:4173';
const b = await chromium.launch({ executablePath: '/usr/bin/chromium', args: ['--no-sandbox','--no-proxy-server'] });
const ctx = await b.newContext({ viewport:{width:390,height:844}, isMobile:true, hasTouch:true, locale:'zh-CN' });
const p = await ctx.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message));
await p.goto(base + '/lab#proc-tlbcache', { waitUntil: 'load', timeout: 60000 });
await p.waitForFunction(() => window.X_OPEN_PROC, null, { timeout: 60000 });
await p.waitForTimeout(800);
console.log('hash open selected:', await p.locator('.x-proc__tab[aria-selected="true"]').textContent());
const tabs = await p.locator('.x-proc__tab').count(); let total=0;
for (let t = 0; t < tabs; t++) {
  await p.locator('.x-proc__tab').nth(t).click();
  const nm = await p.locator('.x-proc__modes button').count();
  for (let m = 0; m < Math.max(1, nm); m++) {
    if (nm) await p.locator('.x-proc__modes button').nth(m).click();
    const next = p.locator('.x-proc [data-a="next"]'); let n = 0;
    if (await next.isVisible()) { while (await next.isEnabled() && n < 40) { await next.click(); n++; } }
    total += n;
  }
}
console.log('tabs', tabs, 'steps clicked', total);
// circuits interaction
await p.evaluate(()=>window.X_OPEN_PROC('gates'));
await p.locator('.x-c__swb').first().tap(); console.log('gates A after tap', await p.locator('.x-c__swb b').first().textContent(), 'hi row', await p.locator('.x-c__tt tr.is-hi td').first().textContent(), await p.locator('.x-proc__meta').textContent());
await p.evaluate(()=>window.X_OPEN_PROC('adder')); await p.locator('.x-proc__modes button').nth(2).click();
await p.locator('.x-c__bit').nth(4).tap(); console.log('adder kv', await p.locator('.x-proc__kv').innerText());
await p.evaluate(()=>window.X_OPEN_PROC('decoder')); await p.locator('.x-proc__modes button').nth(1).click();
const inp = p.locator('.x-proc__in input'); await inp.fill('E123'); await inp.press('Enter'); await p.waitForTimeout(300);
console.log('decoder', await p.locator('.x-proc__t').textContent());
await p.evaluate(()=>window.X_OPEN_PROC('mixidx')); await p.locator('.x-proc__preset').nth(3).click(); await p.waitForTimeout(200);
await p.locator('.x-proc__steps li').last().locator('button').click(); console.log('mixidx', await p.locator('.x-proc__d').textContent());
await inp.fill('abc'); await p.locator('.x-proc__in input').first().press('Enter'); await p.waitForTimeout(200); console.log('err', await p.locator('.x-proc__err').textContent().catch(()=>'none'));
// search
await p.fill('#x-q', 'DMA'); await p.waitForTimeout(400); console.log('search', await p.locator('#x-q-sum').textContent());
console.log('overflow', await p.evaluate(() => document.documentElement.scrollWidth - innerWidth));
console.log('errs', errs);
await b.close();
