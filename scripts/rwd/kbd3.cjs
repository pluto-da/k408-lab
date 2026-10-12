const { chromium } = require('/workspace/work/pw/node_modules/playwright-core');
(async () => {
  const b = await chromium.launch({ executablePath: '/usr/bin/chromium', args: ['--no-sandbox','--no-proxy-server'] });
  const p = await (await b.newContext({ viewport: { width: 1366, height: 900 } })).newPage();
  await p.route('**/api/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{"user":null}' }));
  await p.goto('http://127.0.0.1:4176/lab'); await p.waitForSelector('.x-lab__tab'); await p.waitForTimeout(900);
  const r = await p.evaluate(async () => { document.getElementById('tab-floyd').click(); const P = document.getElementById('lab-floyd'); window.scrollTo(0, P.getBoundingClientRect().top + scrollY - 80); await new Promise(r=>setTimeout(r,100));
    const pl = P.querySelector('[data-a="play"]'); const o = [];
    const rect = P.getBoundingClientRect(); o.push('panel ' + Math.round(rect.top) + ' ' + Math.round(rect.height));
    const pb = document.getElementById('x-proc-body').getBoundingClientRect(); o.push('proc ' + Math.round(pb.top));
    const sb = P.querySelector('[data-a="step"]'); sb.click(); sb.click(); sb.click(); o.push('done=' + (P.querySelector('.x-lab__out').textContent.slice(0,60))); pl.click(); o.push(pl.getAttribute('aria-pressed')); await new Promise(r=>setTimeout(r,50)); o.push(pl.getAttribute('aria-pressed')); return o.join(' '); });
  console.log(r); await b.close();
})();
