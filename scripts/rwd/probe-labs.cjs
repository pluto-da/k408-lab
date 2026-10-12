// node probe-labs.cjs port w h touch(0/1) [steps]
const { chromium } = require('/workspace/work/pw/node_modules/playwright-core');
const [port, W, H, T, STEPS] = [process.argv[2], +process.argv[3], +process.argv[4], process.argv[5] === '1', +(process.argv[6] || 25)];
(async () => {
  const b = await chromium.launch({ executablePath: '/usr/bin/chromium', args: ['--no-sandbox','--no-proxy-server','--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
  const p = await (await b.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1, hasTouch: T, isMobile: T && W < 900 })).newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message.slice(0, 200)));
  await p.route('**/api/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{"user":null}' }));
  await p.goto(`http://127.0.0.1:${port}/lab`, { timeout: 60000 });
  await p.waitForSelector('.x-lab__tab', { timeout: 60000 }); await p.waitForTimeout(1000);
  const ids = await p.$$eval('.x-lab__tab', ts => ts.map(t => t.id.replace('tab-', '')));
  const out = [];
  for (const id of ids) {
    await p.evaluate((id) => document.getElementById('tab-' + id).click(), id);
    await p.waitForTimeout(150);
    const r = await p.evaluate(async ([id, n]) => {
      const P = document.getElementById('lab-' + id), b = P.querySelector('[data-a="step"]');
      let k = 0; for (; k < n; k++) b.click();
      await new Promise(r => setTimeout(r, 200));
      const st = P.querySelector('.x-lab__stage'), svg = st.querySelector('svg');
      let minFs = 99, minTxt = '';
      if (svg) {
        const sc = svg.getBoundingClientRect().width / (svg.viewBox.baseVal && svg.viewBox.baseVal.width || svg.getBoundingClientRect().width);
        svg.querySelectorAll('text').forEach(t => { const f = parseFloat(getComputedStyle(t).fontSize) * sc; if (t.textContent.trim() && f < minFs) { minFs = f; minTxt = t.textContent.slice(0, 12); } });
      }
      const outEl = P.querySelector('.x-lab__out');
      return { id, wide: P.classList.contains('is-wideout'), vbw: svg && svg.viewBox.baseVal ? svg.viewBox.baseVal.width : 0, svgW: svg ? Math.round(svg.getBoundingClientRect().width) : 0, svgMin: svg ? getComputedStyle(svg).minWidth : '', stCW: st.clientWidth, stSW: st.scrollWidth, stH: Math.round(st.getBoundingClientRect().height), minFs: +minFs.toFixed(1), minTxt, outCW: outEl.clientWidth, outSW: outEl.scrollWidth, ov: document.documentElement.scrollWidth - innerWidth };
    }, [id, STEPS]);
    out.push(r);
  }
  for (const r of out) console.log(JSON.stringify(r));
  console.log('errs', JSON.stringify(errs));
  await b.close();
})();
