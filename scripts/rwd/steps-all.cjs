// node steps-all.cjs port name,w,h,touch [name,w,h,touch ...]
const { chromium } = require('/workspace/work/pw/node_modules/playwright-core');
const port = process.argv[2];
const VPS = process.argv.slice(3).map(s => { const [n, w, h, t] = s.split(','); return [n, +w, +h, t === '1']; });
(async () => {
  const b = await chromium.launch({ executablePath: '/usr/bin/chromium', args: ['--no-sandbox', '--no-proxy-server'] });
  for (const [n, W, H, T] of VPS) {
    const ctx = await b.newContext({ viewport: { width: W, height: H }, hasTouch: T, isMobile: T && W < 900 });
    const p = await ctx.newPage();
    const errs = []; p.on('pageerror', e => errs.push(e.message.slice(0, 200))); p.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errs.push(m.text().slice(0, 150)); });
    await p.route('**/api/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{"user":null}' }));
    await p.goto(`http://127.0.0.1:${port}/lab`, { timeout: 60000 }); await p.waitForSelector('.x-lab__tab', { timeout: 60000 }); await p.waitForTimeout(900);
    const r = await p.evaluate(async (T) => {
      const sleep = (ms) => new Promise(r => setTimeout(r, ms));
      const H = innerHeight, res = { labs: 0, labFail: [], ov: [], tall: [], tiny: {}, small: {}, procs: 0, procFail: [], props: 0, propOv: [], wide: [] };
      const scanTxt = (root) => { root.querySelectorAll('*').forEach(e => { if (e.closest('[hidden]') || e.closest('svg') || e.closest('details:not([open]) > :not(summary)')) return; const rc = e.getBoundingClientRect(); if (!rc.width || !rc.height) return; if ([...e.childNodes].some(c => c.nodeType === 3 && c.textContent.trim())) { const f = parseFloat(getComputedStyle(e).fontSize); if (f < (T ? 13 : 12)) { const k = (e.className && e.className.baseVal === undefined ? e.className : e.tagName) + ':' + f; res.tiny[k] = (res.tiny[k] || 0) + 1; } }
        if (T && e.matches('button, a[href], input:not([type=hidden]):not([type=checkbox]):not([type=radio]), select, summary') && (rc.height < 43.5 || rc.width < 43.5)) { const k = (e.className || e.tagName) + ':' + Math.round(rc.width) + 'x' + Math.round(rc.height); res.small[k] = (res.small[k] || 0) + 1; } }); };
      const tabs = [...document.querySelectorAll('.x-lab__tab')];
      for (const t of tabs) {
        t.click(); await sleep(90);
        const id = t.id.replace('tab-', ''), P = document.getElementById('lab-' + id);
        if (P.hidden) { res.labFail.push(id + ':hidden'); continue; }
        const st = P.querySelector('.x-lab__stage'), before = st.innerHTML + P.querySelector('.x-lab__out').innerHTML;
        const sb = P.querySelector('[data-a="step"]'); sb.click(); await sleep(20);
        const after1 = st.innerHTML + P.querySelector('.x-lab__out').innerHTML;
        if (after1 === before) res.labFail.push(id + ':nochange');
        for (let k = 0; k < 150; k++) sb.click();
        await sleep(120);
        if (document.documentElement.scrollWidth > innerWidth + 1) res.ov.push(id);
        const sr = st.getBoundingClientRect();
        if (sr.height > H) res.tall.push(id + ':' + Math.round(sr.height));
        if (P.classList.contains('is-wideout')) res.wide.push(id);
        scanTxt(P);
        res.labs++;
      }
      const ptabs = [...document.querySelectorAll('.x-proc__tab')];
      for (const t of ptabs) {
        t.click(); await sleep(60);
        const body = document.getElementById('x-proc-body'), nx = body.querySelector('[data-a="next"]');
        let k = 0; const c0 = body.querySelector('.x-proc__meta').textContent;
        while (!body.querySelector('.x-proc__ctrl').hidden && !nx.disabled && k < 120) { nx.click(); k++; }
        if (!body.querySelector('.x-proc__ctrl').hidden && k === 0) res.procFail.push(t.id + ':0steps');
        if (document.documentElement.scrollWidth > innerWidth + 1) res.ov.push(t.id);
        scanTxt(body);
        res.procs++;
      }
      const items = [...document.querySelectorAll('.x-prop__item')];
      for (const it of items) {
        it.click(); await sleep(70);
        if (document.documentElement.scrollWidth > innerWidth + 1) res.propOv.push(it.getAttribute('data-id'));
        scanTxt(document.querySelector('.x-prop__card'));
        res.props++;
      }
      scanTxt(document.querySelector('.x-page'));
      return res;
    }, T);
    console.log(n, W + 'x' + H, JSON.stringify(r), 'errs', JSON.stringify(errs));
    await ctx.close();
  }
  await b.close();
})();
