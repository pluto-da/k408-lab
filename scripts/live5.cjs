const { chromium } = require('/workspace/work/pw/node_modules/playwright-core');
(async () => {
  const b = await chromium.launch({ executablePath: '/usr/bin/chromium', args: ['--no-sandbox','--no-proxy-server'] });
  const p = await (await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true })).newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message.slice(0,200))); p.on('requestfailed', r => errs.push('FAIL ' + r.url().slice(-60)));
  const t=Date.now(); await p.goto('http://154.8.183.93/lab', { timeout: 60000, waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(20000);
  await p.screenshot({path:'/tmp/live.png'}); const r = await p.evaluate(() => ({ body: document.body.innerText.slice(0,200), legacy: !!window.LAB, n: (window.LAB||[]).length, labs: document.querySelectorAll('.x-lab__tab').length, procs: document.querySelectorAll('.x-proc__tab').length, load: document.querySelector('.lab-loading p')?.textContent, ov: document.documentElement.scrollWidth - innerWidth }));
  console.log(Date.now()-t, JSON.stringify(r), JSON.stringify(errs.slice(0,8))); await b.close();
})();
