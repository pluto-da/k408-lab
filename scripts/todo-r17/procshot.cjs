const { chromium } = require('/workspace/work/pw/node_modules/playwright-core');
(async () => {
  const b = await chromium.launch({ executablePath: '/usr/bin/chromium', args: ['--no-sandbox'] });
  for (const [w,h] of [[1280,800],[1440,900]]) {
    const p = await (await b.newContext({ viewport: { width: w, height: h } })).newPage();
    await p.goto((process.argv[2]||'http://localhost:4190')+'/lab', { waitUntil: 'load' });
    await p.waitForFunction(() => window.__LEGACY_BOOTED__, null, { timeout: 60000 }); await p.waitForTimeout(800);
    await p.evaluate(() => { const s = document.querySelector('#x-proc-body .x-proc__side'); s.scrollIntoView({block:'center'}); });
    await p.waitForTimeout(400);
    await p.screenshot({ path: `shots/${w}_procbar.png` });
    await p.click('#x-proc-body .x-proc__sidebtn'); await p.waitForTimeout(600);
    const r = await p.evaluate(() => { const b = document.getElementById('x-proc-body'); const svg = b.querySelector('.x-proc__stage svg'); return { cls: b.className, svgW: Math.round(svg.getBoundingClientRect().width), vb: svg.getAttribute('viewBox'), hint: b.querySelector('.x-proc__hint').textContent }; });
    console.log(w, JSON.stringify(r));
    await p.evaluate(() => document.getElementById('x-proc-body').scrollIntoView());
    await p.waitForTimeout(300);
    await p.screenshot({ path: `shots/${w}_procforced.png` });
  }
  await b.close();
})();
