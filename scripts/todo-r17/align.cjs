const { chromium } = require('/workspace/work/pw/node_modules/playwright-core');
(async () => {
  const b = await chromium.launch({ executablePath: '/usr/bin/chromium', args: ['--no-sandbox'] });
  for (const [w,h] of [[1280,800],[1600,900],[1920,1080],[2560,1440],[390,844],[820,1180],[1024,768]]) {
    const p = await (await b.newContext({ viewport: { width: w, height: h } })).newPage();
    await p.goto('http://localhost:4190/lab', { waitUntil: 'load' });
    await p.waitForFunction(() => window.__LEGACY_BOOTED__, null, { timeout: 60000 }); await p.waitForTimeout(800);
    const r = await p.evaluate(() => {
      const bi = document.querySelector('.app-bar__in'), a = bi.getBoundingClientRect(), ba = getComputedStyle(bi);
      const brand = document.querySelector('.app-brand').getBoundingClientRect();
      const lay = document.querySelector('.x-layout').getBoundingClientRect();
      return { barL: Math.round((a.left + parseFloat(ba.paddingLeft))*10)/10, brandL: Math.round(brand.left*10)/10, layL: Math.round(lay.left*10)/10, layR: Math.round(lay.right*10)/10, barR: Math.round((a.right - parseFloat(ba.paddingRight))*10)/10 };
    });
    console.log(w, JSON.stringify(r));
  }
  await b.close();
})();
