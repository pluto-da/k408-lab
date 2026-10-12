// Usage: node audit-lab.cjs <port> <outdir> [onlyNames comma]
const { chromium } = require('/workspace/work/pw/node_modules/playwright-core');
const fs = require('fs');
const PORT = process.argv[2] || '4175', OUT = process.argv[3] || '/workspace/work/rwd/shots', ONLY = process.argv[4] ? process.argv[4].split(',') : null;
fs.mkdirSync(OUT, { recursive: true });
const VP = [['se',320,568,true],['ip15',393,852,true],['promax',430,932,true],['fold-out',344,882,true],['fold-in',673,841,true],['ipadmini',744,1133,true],['ipad',820,1180,true],['ipadpro-p',1024,1366,true],['andtab',1280,800,true],['ipadpro-l',1366,1024,true],['laptop',1366,768,false],['mbp',1440,900,false],['1080p',1920,1080,false],['2k',2560,1440,false],['land',852,393,true]];
(async () => {
  const b = await chromium.launch({ executablePath: '/usr/bin/chromium', args: ['--no-sandbox','--no-proxy-server','--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
  const rows = [];
  for (const [n,w,h,touch] of VP) {
    if (ONLY && !ONLY.includes(n)) continue;
    const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, hasTouch: touch, isMobile: touch && w < 900 });
    const p = await ctx.newPage();
    const errs = []; p.on('pageerror', e => errs.push(e.message.slice(0,160))); p.on('console', m => { if (m.type()==='error' && !/api\/|Failed to load resource/.test(m.text())) errs.push(m.text().slice(0,160)); });
    await p.route('**/api/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{"user":null}' }));
    await p.goto(`http://127.0.0.1:${PORT}/lab`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await p.waitForSelector('.x-lab__tab', { timeout: 60000 }); await p.waitForTimeout(1200);
    await p.screenshot({ path: `${OUT}/${n}-top.png` });
    const m = await p.evaluate((coarse) => {
      const W = innerWidth, H = innerHeight;
      let tiny = 0, tiny13 = 0, small = 0; const tinyEx = [], smallEx = [];
      const vis = (e) => { const r = e.getBoundingClientRect(); if (!r.width || !r.height) return null; const cs = getComputedStyle(e); if (cs.visibility === 'hidden' || cs.display === 'none') return null; return r; };
      document.querySelectorAll('.x-page *').forEach(e => {
        if (e.closest('[hidden]') || e.closest('svg') ) return;
        const r = vis(e); if (!r) return;
        if ([...e.childNodes].some(c => c.nodeType === 3 && c.textContent.trim())) {
          const fs = parseFloat(getComputedStyle(e).fontSize);
          if (fs < 12) { tiny++; if (tinyEx.length < 6) tinyEx.push((e.className || e.tagName) + ':' + fs); }
          if (fs < 13) tiny13++;
        }
        if (coarse && e.matches('button, a[href], input:not([type=hidden]), select, summary, [role=tab]')) {
          if (r.height < 43.5 || (r.width < 43.5 && e.type !== 'checkbox')) { small++; if (smallEx.length < 8) smallEx.push((e.className || e.tagName).toString().slice(0, 30) + ':' + Math.round(r.width) + 'x' + Math.round(r.height)); }
        }
      });
      const lay = document.querySelector('.x-layout').getBoundingClientRect();
      const page = document.querySelector('.page.x-page').getBoundingClientRect();
      const panel = [...document.querySelectorAll('.x-lab__panel')].find(x => !x.hidden);
      const st = panel.querySelector('.x-lab__stage').getBoundingClientRect();
      const stepB = panel.querySelector('[data-a="step"]').getBoundingClientRect();
      const note = panel.querySelector('.x-lab__note').getBoundingClientRect();
      const toolB = document.querySelector('.x-tool').getBoundingClientRect();
      const pb = document.querySelector('#x-proc-body'), pst = pb && pb.querySelector('.x-proc__stage').getBoundingClientRect(), pcard = pb && pb.querySelector('.x-proc__card').getBoundingClientRect();
      const pl = document.querySelector('.x-prop__list'), pc = document.querySelector('.x-prop__card');
      return { sw: document.documentElement.scrollWidth, W, tiny, tiny13, small, tinyEx, smallEx,
        layW: Math.round(lay.width), ratio: +(lay.width / W).toFixed(2), pageW: Math.round(page.width),
        labSplit: stepB.left > st.right - 4, stageH: Math.round(st.height), stageW: Math.round(st.width),
        span: Math.round(Math.max(stepB.bottom, st.bottom) - Math.min(st.top, stepB.top)), avail: Math.round(H - Math.max(0, toolB.height)), noteRight: note.left > st.right - 4,
        procSplit: pst ? pcard.left > pst.right - 4 : null, propSplit: pl && pc ? pc.getBoundingClientRect().left > pl.getBoundingClientRect().right - 4 : null,
        rootFs: getComputedStyle(document.querySelector('.x-page p') || document.body).fontSize };
    }, touch);
    // section screenshots
    for (const sel of ['#lab', '#proc', '#prop']) {
      await p.evaluate((s) => { const e = document.querySelector(s); window.scrollTo(0, e.getBoundingClientRect().top + scrollY - 60); }, sel);
      await p.waitForTimeout(250);
      await p.screenshot({ path: `${OUT}/${n}-${sel.slice(1)}.png` });
    }
    // lab panel in view: scroll stage to just below sticky tool
    await p.evaluate(() => { const panel = [...document.querySelectorAll('.x-lab__panel')].find(x => !x.hidden); const t = document.querySelector('.x-tool').getBoundingClientRect(); const s = panel.querySelector('.x-lab__stage'); window.scrollTo(0, s.getBoundingClientRect().top + scrollY - Math.max(0, t.bottom) - 4); });
    await p.waitForTimeout(250);
    let fit = await p.evaluate(() => { const panel = [...document.querySelectorAll('.x-lab__panel')].find(x => !x.hidden); const s = panel.querySelector('.x-lab__stage').getBoundingClientRect(); const b = panel.querySelector('[data-a="step"]').getBoundingClientRect(); return { stTop: Math.round(s.top), stBot: Math.round(s.bottom), stepBot: Math.round(b.bottom), stepTop: Math.round(b.top), H: innerHeight, bothVisible: s.top >= -2 && b.top >= 0 && b.bottom <= innerHeight + 1 && s.height > 60 }; });
    if (!fit.bothVisible) { await p.evaluate(() => { const panel = [...document.querySelectorAll('.x-lab__panel')].find(x => !x.hidden); const t = document.querySelector('.x-tool').getBoundingClientRect(); window.scrollTo(0, panel.getBoundingClientRect().top + scrollY - Math.max(0, t.bottom)); }); await p.waitForTimeout(200);
      fit = await p.evaluate(() => { const panel = [...document.querySelectorAll('.x-lab__panel')].find(x => !x.hidden); const s = panel.querySelector('.x-lab__stage').getBoundingClientRect(); const b = panel.querySelector('[data-a="step"]').getBoundingClientRect(); return { alt: 1, stTop: Math.round(s.top), stBot: Math.round(s.bottom), stepBot: Math.round(b.bottom), stepTop: Math.round(b.top), H: innerHeight, bothVisible: s.top >= -2 && s.bottom <= innerHeight + 1 && b.top >= 0 && b.bottom <= innerHeight + 1 }; }); }
    await p.screenshot({ path: `${OUT}/${n}-labfit.png` });
    rows.push({ n, vp: w + 'x' + h, overflow: m.sw > m.W + 1 ? m.sw : 0, ...m, fit, errs });
    console.log(JSON.stringify(rows[rows.length - 1]));
    await ctx.close();
  }
  fs.writeFileSync(OUT + '/audit.json', JSON.stringify(rows, null, 1));
  await b.close();
})();
