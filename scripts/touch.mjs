import { chromium, devices } from '/tmp/pw/node_modules/playwright-core/index.mjs';
const b = await chromium.launch({ executablePath: process.env.CH, args: ['--use-angle=swiftshader','--no-sandbox','--enable-unsafe-swiftshader','--no-proxy-server'] });
for (const dev of ['Pixel 7', 'iPad Pro 11 landscape']) {
const ctx = await b.newContext({ ...devices[dev], locale: 'zh-CN', bypassCSP: true });
const page = await ctx.newPage(); const errs=[];
page.on('pageerror', e => errs.push(e.message));
await page.goto(process.argv[2] + '/lab');
await page.waitForFunction(() => window.__LEGACY_BOOTED__, null, { timeout: 60000 });
await page.waitForTimeout(1500);
// chapter tab
const tab = page.locator('#ds .x-ch button').nth(1); await tab.scrollIntoViewIfNeeded(); await tab.tap();
console.log(dev, 'tab pressed', await tab.getAttribute('aria-pressed'), (await page.locator('#card-ds h3').textContent()));
// sort step
const step = page.getByRole('button', { name: '单步' }).first(); await step.scrollIntoViewIfNeeded();
const before = await page.locator('#lab').innerText(); await step.tap(); await step.tap(); await page.waitForTimeout(500);
console.log(dev, 'step changed', before !== await page.locator('#lab').innerText());
// quiz answer
const opt = page.locator('#quiz button').filter({ hasText: '(rear+1)%M==front' }).first(); await opt.scrollIntoViewIfNeeded(); await opt.tap(); await page.waitForTimeout(300);
console.log(dev, 'quiz', (await page.locator('#quiz').innerText()).includes('正确') || (await page.locator('#quiz').innerText()).slice(0,200).replace(/\s+/g,' '));
// hotspot
await page.evaluate(()=>scrollTo(0,0)); const hot = page.locator('.x-hot').first(); 
if (await hot.isVisible()) { await hot.tap(); await page.waitForTimeout(800); console.log(dev, 'hot tapped, panel:', (await page.locator('#hero').innerText()).slice(0,120).replace(/\s+/g,' ')); }
await page.screenshot({ path: `shots/touch-${dev.replace(/\W/g,'')}.png` });
console.log(dev, 'errors', errs);
await ctx.close();
}
await b.close();
