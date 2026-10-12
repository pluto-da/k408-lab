const { chromium } = require('/workspace/work/pw/node_modules/playwright-core');
(async () => {
  const b = await chromium.launch({ executablePath: '/usr/bin/chromium', args: ['--no-sandbox','--no-proxy-server'] });
  for (const [w, h] of [[393, 852], [820, 1180], [1180, 820]]) {
    const p = await (await b.newContext({ viewport: { width: w, height: h }, hasTouch: true, isMobile: w < 900 })).newPage();
    await p.route('**/api/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{"user":null}' }));
    await p.goto('http://127.0.0.1:4176/lab'); await p.waitForSelector('.x-lab__tab'); await p.waitForTimeout(900);
    await p.evaluate(() => window.scrollTo(0, 1500)); await p.waitForTimeout(300);
    await p.tap('#x-tocbtn'); await p.waitForTimeout(300);
    const r = await p.evaluate(() => { const t = document.getElementById('x-toc').getBoundingClientRect(); return [Math.round(t.left), Math.round(t.top), Math.round(t.width), Math.round(t.height), innerHeight]; });
    await p.screenshot({ path: `/tmp/toc-${w}.png` });
    await p.tap('#x-toc a[href="#prop"]'); await p.waitForTimeout(600);
    const r2 = await p.evaluate(() => [document.getElementById('x-toc').classList.contains('is-open'), Math.round(document.getElementById('prop').getBoundingClientRect().top)]);
    console.log(w, r, r2);
  }
  await b.close();
})();
