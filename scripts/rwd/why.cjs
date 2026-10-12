const { chromium } = require('/workspace/work/pw/node_modules/playwright-core');
(async () => {
  const b = await chromium.launch({ executablePath: '/usr/bin/chromium', args: ['--no-sandbox','--no-proxy-server'] });
  const p = await (await b.newContext({ viewport: { width: 1366, height: 1024 } })).newPage();
  await p.route('**/api/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{"user":null}' }));
  await p.goto('http://127.0.0.1:4176/lab'); await p.waitForSelector('.x-lab__tab'); await p.waitForTimeout(800);
  const ids = await p.$$eval('.x-lab__tab', ts => ts.map(t => t.id.replace('tab-', '')));
  for (const id of ids) {
    await p.evaluate((id) => document.getElementById('tab-' + id).click(), id); await p.waitForTimeout(150);
    const r = await p.evaluate((id) => { const P = document.getElementById('lab-' + id); const b = P.querySelector('[data-a="step"]'); for (let k = 0; k < 20; k++) b.click();
      const o = P.querySelector('.x-lab__out'); if (!P.classList.contains('is-wideout')) return null;
      // temporarily move back to side to measure
      const side = P.querySelector('.x-lab__side'); side.insertBefore(o, side.querySelector('.x-lab__note'));
      const res = [...o.querySelectorAll('*')].filter(e => e.scrollWidth > e.clientWidth + 4 && e.clientWidth).slice(0, 3).map(e => e.className + ':' + e.clientWidth + '/' + e.scrollWidth + ' ' + (e.firstElementChild ? e.firstElementChild.tagName + '.' + e.firstElementChild.className : ''));
      const self = o.scrollWidth + '/' + o.clientWidth;
      P.appendChild(o); return self + ' ' + res.join(' | '); }, id);
    if (r) console.log(id, r);
  }
  await b.close();
})();
