const { chromium } = require('/workspace/work/pw/node_modules/playwright-core');
(async () => {
  const b = await chromium.launch({ executablePath: '/usr/bin/chromium', args: ['--no-sandbox','--no-proxy-server'] });
  const p = await (await b.newContext({ viewport: { width: 1366, height: 900 } })).newPage();
  await p.route('**/api/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{"user":null}' }));
  await p.goto('http://127.0.0.1:4176/lab'); await p.waitForSelector('.x-lab__tab'); await p.waitForTimeout(900);
  for (const id of ['paging', 'tcpconn']) {
  const r = await p.evaluate(async (id) => { document.getElementById('tab-' + id).click(); const P = document.getElementById('lab-' + id);
    const snap = () => P.querySelector('.x-lab__stage').innerHTML + '|' + P.querySelector('.x-lab__out').innerHTML;
    for (let i = 0; i < 3; i++) X_LAB_ACT('step'); await new Promise(r=>setTimeout(r,500)); const a = snap(); X_LAB_ACT('step'); X_LAB_ACT('back'); await new Promise(r=>setTimeout(r,500)); const b = snap();
    let i = 0; while (i < a.length && a[i] === b[i]) i++; return id + ' len ' + a.length + '/' + b.length + ' @' + i + ' A:' + a.slice(i - 60, i + 80) + '\n B:' + b.slice(i - 60, i + 80); }, id);
  console.log(r); }
  await b.close();
})();
