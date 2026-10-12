const { chromium } = require('/workspace/work/pw/node_modules/playwright-core');
const [port, W, H] = [process.argv[2], +process.argv[3], +process.argv[4]];
(async () => {
  const b = await chromium.launch({ executablePath: '/usr/bin/chromium', args: ['--no-sandbox','--no-proxy-server'] });
  const p = await (await b.newContext({ viewport: { width: W, height: H }, hasTouch: true, isMobile: W < 900 })).newPage();
  await p.route('**/api/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{"user":null}' }));
  await p.goto(`http://127.0.0.1:${port}/lab`); await p.waitForSelector('.x-lab__tab'); await p.waitForTimeout(1200);
  console.log(await p.evaluate(() => { const m = {}; document.querySelectorAll('.x-page *').forEach(e => { if (e.closest('[hidden]') || e.closest('svg')) return; const r = e.getBoundingClientRect(); if (!r.width) return; if (![...e.childNodes].some(c => c.nodeType === 3 && c.textContent.trim())) return; const fs = parseFloat(getComputedStyle(e).fontSize); if (fs < 13) { const k = e.tagName + '.' + (e.className || '') + ' ' + fs + ' "' + e.textContent.trim().slice(0, 10) + '"'; m[k] = (m[k] || 0) + 1; } }); return JSON.stringify(m, null, 1); }));
  await b.close();
})();
