const { chromium } = require('/workspace/work/pw/node_modules/playwright-core');
const BASE = process.argv[2] || 'http://localhost:4190';
const OUT = '/workspace/work/todo-r17/shots';
(async () => {
  const b = await chromium.launch({ executablePath: '/usr/bin/chromium', args: ['--no-sandbox', '--no-proxy-server'] });
  const VPS = JSON.parse(process.env.VPS || '[[320,568,true],[852,393,true],[820,1180,true],[1024,1366,true],[1280,800,false],[1440,900,false],[1920,1080,false]]');
  for (const [w, h, touch] of VPS) {
    const ctx = await b.newContext({ viewport: { width: w, height: h }, hasTouch: touch, isMobile: touch && Math.min(w, h) < 600, locale: 'zh-CN' });
    const p = await ctx.newPage(); const errs = [];
    p.on('pageerror', e => errs.push('PE ' + e.message)); p.on('console', m => { if (m.type() === 'error' && !/Failed to load|api|ECONN|WebGL|GPU|COOP|Cross-Origin|untrustworthy/.test(m.text())) errs.push(m.text().slice(0, 120)); });
    await p.goto(BASE + '/lab', { waitUntil: 'load', timeout: 60000 });
    await p.waitForFunction(() => window.__LEGACY_BOOTED__ && document.querySelector('.x-toc--grp'), null, { timeout: 60000 });
    await p.waitForTimeout(1200);
    const r = await p.evaluate(async () => {
      const sleep = ms => new Promise(r => setTimeout(r, ms));
      const o = { W: innerWidth, H: innerHeight, ov: document.documentElement.scrollWidth - innerWidth };
      const toc = document.getElementById('x-toc');
      o.compact = toc.classList.contains('x-toc--compact');
      o.rows = [...toc.querySelectorAll('.x-toc__root > li')].filter(li => !li.hidden && li.offsetParent !== null || getComputedStyle(toc).display === 'none').length;
      // container alignment
      const bi = document.querySelector('.app-bar__in'), pg = document.querySelector('.page.x-page');
      if (bi && pg) { const a = bi.getBoundingClientRect(), c = pg.getBoundingClientRect(); const ba = getComputedStyle(bi), pa = getComputedStyle(pg); const z = parseFloat(pa.zoom) || 1;
        o.align = [Math.round(a.left + parseFloat(ba.paddingLeft)), Math.round(c.left + parseFloat(pa.paddingLeft) * (z !== 1 && Math.abs(c.width - pg.offsetWidth) < 2 ? z : 1)), Math.round(a.right - parseFloat(ba.paddingRight)), Math.round(c.right - parseFloat(pa.paddingRight) * (z !== 1 && Math.abs(c.width - pg.offsetWidth) < 2 ? z : 1))]; }
      const lab = [...document.querySelectorAll('.x-lab__panel')].find(x => !x.hidden);
      o.labCls = lab.className; o.labCols = getComputedStyle(lab).gridTemplateColumns;
      const sb = lab.querySelector('.x-setbtn'); o.setbtn = sb ? !sb.hidden && getComputedStyle(sb).display !== 'none' : false;
      // keyboard boundary
      window.X_LAB_ACT('reset'); await sleep(50); window.X_LAB_ACT('back'); await sleep(50);
      const hb = lab.querySelector('.x-lab__hint'); o.hintStart = hb && !hb.hidden ? hb.textContent : null;
      let n = 0; while (n < 400) { const st = lab.querySelector('[data-a="step"]'); window.X_LAB_ACT('step'); n++; if (hb.textContent.indexOf('最后一步') >= 0) break; }
      o.hintEnd = hb.textContent; o.steps = n;
      const proc = document.getElementById('x-proc-body'); o.procCls = proc && proc.className;
      const sbtn = proc && proc.querySelector('.x-proc__sidebtn'); o.procSideBtn = sbtn ? !sbtn.hidden : null;
      return o;
    });
    // TOC panel on small screens
    if (w < 1024) {
      const btn = await p.$('.x-tocbtn');
      if (btn) { await btn.click(); await p.waitForTimeout(400);
        r.tocPanel = await p.evaluate(() => { const t = document.getElementById('x-toc'); const rc = t.getBoundingClientRect(); return { fits: t.scrollHeight <= t.clientHeight + 1, sh: t.scrollHeight, ch: t.clientHeight, top: Math.round(rc.top), rows: [...t.querySelectorAll('.x-toc__root > li')].filter(li => !li.hidden).length }; });
        await p.screenshot({ path: `${OUT}/${w}x${h}_toc.png` });
        await p.keyboard.press('Escape'); await p.waitForTimeout(200);
        const close = await p.$('.x-toc.is-open .x-toc__x, .x-tocbtn'); 
      }
    }
    if (r.setbtn) {
      await p.evaluate(() => document.getElementById('lab').scrollIntoView());
      await p.click('.x-lab__panel:not([hidden]) .x-setbtn'); await p.waitForTimeout(400);
      r.sheet = await p.evaluate(() => { const s = document.querySelector('.x-sheet'); return { open: !s.hidden, inputs: s.querySelectorAll('input,select,button').length, focus: document.activeElement && s.contains(document.activeElement) }; });
      await p.screenshot({ path: `${OUT}/${w}x${h}_sheet.png` });
      await p.keyboard.press('Escape'); await p.waitForTimeout(300);
      r.sheetClosed = await p.evaluate(() => document.querySelector('.x-sheet').hidden && !!document.querySelector('.x-lab__panel:not([hidden]) .x-lab__main > .x-lab__opts'));
    }
    await p.evaluate(() => document.getElementById('lab').scrollIntoView()); await p.waitForTimeout(300);
    await p.screenshot({ path: `${OUT}/${w}x${h}_lab.png` });
    await p.evaluate(() => document.getElementById('proc').scrollIntoView()); await p.waitForTimeout(500);
    await p.screenshot({ path: `${OUT}/${w}x${h}_proc.png` });
    r.errs = errs;
    console.log(w + 'x' + h, JSON.stringify(r));
    await ctx.close();
  }
  await b.close();
})();
