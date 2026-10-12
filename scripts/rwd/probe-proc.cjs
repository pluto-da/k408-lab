const { chromium } = require('/workspace/work/pw/node_modules/playwright-core');
const [port, W, H] = [process.argv[2], +process.argv[3], +process.argv[4]];
(async () => {
  const b = await chromium.launch({ executablePath: '/usr/bin/chromium', args: ['--no-sandbox','--no-proxy-server'] });
  const p = await (await b.newContext({ viewport: { width: W, height: H } })).newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message.slice(0, 200)));
  await p.route('**/api/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{"user":null}' }));
  await p.goto(`http://127.0.0.1:${port}/lab`); await p.waitForSelector('.x-proc__tab'); await p.waitForTimeout(800);
  const ids = await p.$$eval('.x-proc__tab', ts => ts.map(t => t.id.replace('ptab-', '')));
  const res = [];
  for (const id of ids) {
    await p.evaluate((id) => document.getElementById('ptab-' + id).click(), id); await p.waitForTimeout(120);
    res.push(await p.evaluate((id) => { const b = document.getElementById('x-proc-body'); const s = b.querySelector('.x-proc__stage svg'); const vb = s && s.viewBox.baseVal;
      return id + ':' + (s ? (s.style.minWidth || '-') + '/' + (vb ? vb.width + 'x' + vb.height : '') : 'nosvg') + (b.classList.contains('is-split') ? ' SPLIT' : '') + ' bw=' + b.clientWidth; }, id));
  }
  console.log(res.join('\n')); console.log('errs', errs);
  await b.close();
})();
