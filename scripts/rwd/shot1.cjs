const { chromium } = require('/workspace/work/pw/node_modules/playwright-core');
const [port, w, h, out, sel] = [process.argv[2], +process.argv[3], +process.argv[4], process.argv[5], process.argv[6] || '#lab'];
(async () => {
  const b = await chromium.launch({ executablePath: '/usr/bin/chromium', args: ['--no-sandbox','--no-proxy-server'] });
  const p = await (await b.newContext({ viewport: { width: w, height: h }, hasTouch: w < 1400, isMobile: w < 900 })).newPage();
  await p.route('**/api/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{"user":null}' }));
  await p.goto(`http://127.0.0.1:${port}/lab`); await p.waitForSelector('.x-lab__tab'); await p.waitForTimeout(1500);
  await p.evaluate((s) => { const e = document.querySelector(s); window.scrollTo(0, e.getBoundingClientRect().top + scrollY - 60); }, sel);
  await p.waitForTimeout(400); await p.screenshot({ path: out }); await b.close();
})();
