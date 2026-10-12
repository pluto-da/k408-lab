const { chromium } = require('/workspace/work/pw/node_modules/playwright-core');
const [port, W, H] = [process.argv[2], +(process.argv[3]||852), +(process.argv[4]||393)];
(async () => {
  const b = await chromium.launch({ executablePath: '/usr/bin/chromium', args: ['--no-sandbox','--no-proxy-server'] });
  const p = await (await b.newContext({ viewport: { width: W, height: H }, hasTouch: true, isMobile: true })).newPage();
  await p.route('**/api/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{"user":null}' }));
  await p.goto(`http://127.0.0.1:${port}/lab`); await p.waitForSelector('.x-lab__tab'); await p.waitForTimeout(900);
  const ids = await p.$$eval('.x-lab__tab', ts => ts.map(t => t.id.replace('tab-', '')));
  const bad = [], ok = [];
  for (const id of ids) {
    await p.evaluate((id) => document.getElementById('tab-' + id).click(), id); await p.waitForTimeout(150);
    // scenario: user scrolls so the canvas top is at the top of the screen
    const r = await p.evaluate(async (id) => { const P = document.getElementById('lab-' + id); const s = P.querySelector('.x-lab__stage');
      window.scrollTo(0, s.getBoundingClientRect().top + scrollY - 6); await new Promise(r => setTimeout(r, 80));
      const sr = s.getBoundingClientRect(), br = P.querySelector('[data-a="step"]').getBoundingClientRect();
      const a = sr.top >= -1 && sr.bottom <= innerHeight + 1 && br.top >= 0 && br.bottom <= innerHeight;
      // scenario 2: panel top at top
      window.scrollTo(0, P.getBoundingClientRect().top + scrollY); await new Promise(r => setTimeout(r, 80));
      const sr2 = s.getBoundingClientRect(), br2 = P.querySelector('[data-a="step"]').getBoundingClientRect();
      const b = br2.top >= 0 && br2.bottom <= innerHeight && sr2.top < innerHeight - 60;
      return { a, b, sh: Math.round(sr.height), st: Math.round(sr.top), bt: Math.round(br.top) }; }, id);
    (r.a ? ok : bad).push(id + (r.a ? '' : JSON.stringify(r)));
  }
  console.log('ok', ok.length, 'bad', bad.length, bad.join(' '));
  await b.close();
})();
