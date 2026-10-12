const { chromium } = require('/tmp/pw/node_modules/playwright-core');
(async () => {
  const b = await chromium.launch({ executablePath: '/usr/bin/chromium', args: ['--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox'] });
  const p = await (await b.newContext({ viewport: { width: 1366, height: 860 } })).newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message.slice(0,150))); p.on('console', m => { if (m.type()==='error' && !m.text().includes('500')) errs.push(m.text().slice(0,150)); });
  await p.route('**/api/me', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{"user":null}' }));
  const t0 = Date.now(); const prog = [];
  await p.goto('http://localhost:4173/lab');
  const iv = setInterval(async () => { try { prog.push(await p.textContent('.lab-loading p')); } catch {} }, 150);
  await p.waitForFunction(() => window.HERO && window.HERO.ready, null, { timeout: 90000 });
  clearInterval(iv);
  const t = Date.now() - t0;
  await p.click('#tab-banker'); await p.click('#ds .x-ch li:nth-child(5) button');
  const st = await p.evaluate(() => ({ tabs: document.querySelectorAll('.x-lab__tab').length, secs: [...document.querySelectorAll('main section[id]')].map(s => s.id), lost: (() => { const c = document.querySelector('#stage canvas'); const g = c && c.getContext('webgl2'); return g ? g.isContextLost() : 'nogl'; })() }));
  await p.waitForTimeout(1500); await p.screenshot({ path: 'final_lab.png' });
  console.log('ready ms', t, JSON.stringify(st), 'progress samples', JSON.stringify([...new Set(prog)].slice(0, 12)), 'errs', JSON.stringify(errs));
  await b.close();
})();
