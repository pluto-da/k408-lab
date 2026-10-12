const { chromium } = require('/workspace/work/pw/node_modules/playwright-core');
(async () => {
  const b = await chromium.launch({ executablePath: '/usr/bin/chromium', args: ['--no-sandbox','--no-proxy-server'] });
  const p = await (await b.newContext({ viewport: { width: 1366, height: 900 } })).newPage();
  await p.route('**/api/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{"user":null}' }));
  await p.goto('http://127.0.0.1:4176/lab'); await p.waitForSelector('.x-lab__tab'); await p.waitForTimeout(900);
  for (const id of ['floyd', 'addressing', 'paging', 'tcpconn']) {
    await p.evaluate((id) => { document.getElementById('tab-' + id).click(); document.activeElement.blur(); const P = document.getElementById('lab-' + id); window.scrollTo(0, P.getBoundingClientRect().top + scrollY - 80); }, id);
    await p.waitForTimeout(150);
    const info = [];
    for (let i = 0; i < 3; i++) await p.keyboard.press('ArrowRight');
    info.push(await p.evaluate(() => document.activeElement.tagName + '.' + document.activeElement.className));
    await p.keyboard.press('Space'); await p.waitForTimeout(80);
    info.push(await p.evaluate((id) => document.querySelector('#lab-' + id + ' [data-a="play"]').getAttribute('aria-pressed') + ' active=' + document.activeElement.tagName + '.' + document.activeElement.className, id));
    console.log(id, info.join(' | '));
  }
  await b.close();
})();
