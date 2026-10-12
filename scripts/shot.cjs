const { chromium, devices } = require('/tmp/pw/node_modules/playwright-core');
(async () => {
  const [,, out, dev, path] = process.argv;
  const b = await chromium.launch({ executablePath: '/usr/bin/chromium', args: ['--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox'] });
  const ctx = await b.newContext(dev === 'phone' ? devices['Pixel 7'] : { viewport: { width: 1366, height: 860 } });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push('pageerror ' + e.message));
  p.on('console', m => { if (m.type() === 'error') errs.push('console ' + m.text().slice(0,300)); });
  const t0 = Date.now();
  await p.goto('http://localhost:4173' + (path || '/lab'), { waitUntil: 'load' });
  if (!path || path === '/lab') {
    await p.waitForFunction(() => window.HERO && window.HERO.ready, null, { timeout: 90000 }).catch(e => errs.push('notready'));
    console.log('ready ms', Date.now() - t0);
    await p.waitForTimeout(2500);
  } else await p.waitForTimeout(1500);
  await p.screenshot({ path: out });
  console.log(JSON.stringify(errs));
  await b.close();
})();
