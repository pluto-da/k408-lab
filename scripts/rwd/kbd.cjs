const { chromium } = require('/workspace/work/pw/node_modules/playwright-core');
(async () => {
  const b = await chromium.launch({ executablePath: '/usr/bin/chromium', args: ['--no-sandbox','--no-proxy-server'] });
  const p = await (await b.newContext({ viewport: { width: 1366, height: 900 } })).newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message.slice(0, 200)));
  await p.route('**/api/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{"user":null}' }));
  await p.goto('http://127.0.0.1:4176/lab'); await p.waitForSelector('.x-lab__tab'); await p.waitForTimeout(900);
  const ids = await p.$$eval('.x-lab__tab', ts => ts.map(t => t.id.replace('tab-', '')));
  const bad = [], noStep = [], play = [];
  const snap = (id) => p.evaluate((id) => { const P = document.getElementById('lab-' + id); return P.querySelector('.x-lab__stage').innerHTML + '|' + P.querySelector('.x-lab__out').innerHTML; }, id);
  for (const id of ids) {
    await p.evaluate((id) => { document.getElementById('tab-' + id).click(); document.activeElement.blur(); const P = document.getElementById('lab-' + id); window.scrollTo(0, P.getBoundingClientRect().top + scrollY - 80); }, id);
    await p.waitForTimeout(150);
    const s0 = await snap(id);
    for (let i = 0; i < 3; i++) await p.keyboard.press('ArrowRight');
    await p.waitForTimeout(50);
    const s3 = await snap(id);
    if (s3 === s0) noStep.push(id);
    await p.keyboard.press('ArrowRight'); await p.waitForTimeout(50);
    await p.keyboard.press('ArrowLeft'); await p.waitForTimeout(400);
    const s3b = await snap(id);
    if (s3b !== s3) bad.push(id);
    await p.keyboard.press('Space'); await p.waitForTimeout(80);
    const pr = await p.evaluate((id) => document.querySelector('#lab-' + id + ' [data-a="play"]').getAttribute('aria-pressed'), id);
    await p.keyboard.press('Space'); await p.waitForTimeout(50);
    const pr2 = await p.evaluate((id) => document.querySelector('#lab-' + id + ' [data-a="play"]').getAttribute('aria-pressed'), id);
    if (!(pr === 'true' && pr2 === 'false')) play.push(id + ':' + pr + pr2);
  }
  // proc via body focus
  await p.evaluate(() => { document.activeElement.blur(); const b = document.getElementById('x-proc-body'); window.scrollTo(0, b.getBoundingClientRect().top + scrollY - 80); });
  await p.waitForTimeout(200);
  const m0 = await p.$eval('#x-proc-body .x-proc__meta', e => e.textContent);
  await p.keyboard.press('ArrowRight'); await p.keyboard.press('ArrowRight'); await p.waitForTimeout(100);
  const m1 = await p.$eval('#x-proc-body .x-proc__meta', e => e.textContent);
  await p.keyboard.press('ArrowLeft'); await p.waitForTimeout(100);
  const m2 = await p.$eval('#x-proc-body .x-proc__meta', e => e.textContent);
  // tablist arrow should still switch tabs
  await p.focus('#tab-sort'); await p.keyboard.press('ArrowRight'); await p.waitForTimeout(100);
  const sel = await p.$eval('.x-lab__tab[aria-selected="true"]', e => e.id);
  console.log(JSON.stringify({ labs: ids.length, noStep, backMismatch: bad, play, proc: [m0, m1, m2], tabArrow: sel, errs }));
  await b.close();
})();
