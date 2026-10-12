const { chromium } = require('/tmp/pw/node_modules/playwright-core');
(async () => {
  const [,, out, key] = process.argv;
  const b = await chromium.launch({ executablePath: '/usr/bin/chromium', args: ['--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox'] });
  const p = await (await b.newContext({ viewport: { width: 1366, height: 860 }, deviceScaleFactor: 2 })).newPage();
  await p.goto('http://localhost:4173/lab');
  await p.waitForFunction(() => window.HERO && window.HERO.ready, null, { timeout: 90000 });
  await p.evaluate(k => window.HERO.focus(k), key || 'cpu');
  await p.waitForTimeout(3000);
  const box = await (await p.$('#hero')).boundingBox();
  await p.screenshot({ path: out, clip: { x: box.x, y: box.y, width: box.width, height: Math.min(box.height, 700) } });
  await b.close();
})();
