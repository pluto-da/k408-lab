import { chromium, devices } from '/tmp/pw/node_modules/playwright-core/index.mjs';
const b = await chromium.launch({ executablePath: process.env.CH, args: ['--use-angle=swiftshader','--no-sandbox','--enable-unsafe-swiftshader','--no-proxy-server'] });
const ctx = await b.newContext({ ...devices['iPad Pro 11 landscape'], locale: 'zh-CN', bypassCSP: true });
const page = await ctx.newPage();
await page.goto(process.argv[2] + '/'); await page.waitForTimeout(2500);
await page.screenshot({ path: 'shots/ipad-home.png' });
await page.goto(process.argv[2] + '/lab'); await page.waitForFunction(() => window.__LEGACY_BOOTED__, null, { timeout: 60000 }); await page.waitForTimeout(2000);
await page.screenshot({ path: 'shots/ipad-lab.png' });
await b.close();
