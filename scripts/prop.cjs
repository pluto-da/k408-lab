const { chromium } = require('/workspace/work/pw/node_modules/playwright-core');
(async () => {
  const b = await chromium.launch({ executablePath: '/usr/bin/chromium', args: ['--no-sandbox','--no-proxy-server'] });
  const p = await b.newPage({ viewport: { width: 390, height: 844 } });
  const errs = []; p.on('pageerror', e => errs.push(String(e))); p.on('console', m => { if (m.type()==='error') errs.push(m.text()); });
  await p.goto('http://127.0.0.1:4173/lab#prop-ds-leaf', { waitUntil: 'networkidle' }); await p.waitForTimeout(2500);
  const ids = await p.evaluate(() => (window.PROP||[]).map(x => x.id));
  const ov = [];
  for (const id of ids) {
    await p.evaluate(i => window.X_OPEN_PROP(i, false), id); await p.waitForTimeout(60);
    const btns = await p.$$('#x-prop button');
    for (const bt of btns.slice(-6)) { try { await bt.click({ timeout: 300 }); } catch (e) {} }
    if (await p.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)) ov.push(id);
  }
  await p.evaluate(() => window.X_OPEN_PROP('os-deadlock-min', true)); await p.waitForTimeout(400);
  await p.screenshot({ path: '/workspace/work/shots/prop-os.png' });
  console.log(ids.length, 'overflow:', JSON.stringify(ov), 'errs:', JSON.stringify(errs.slice(0,5)));
  await b.close();
})();
