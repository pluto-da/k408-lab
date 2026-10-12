const { chromium } = require('/workspace/work/pw/node_modules/playwright-core');
const [port, w, h, id, out, steps, mode] = [process.argv[2], +process.argv[3], +process.argv[4], process.argv[5], process.argv[6], +(process.argv[7] || 0), process.argv[8] || 'stage'];
(async () => {
  const b = await chromium.launch({ executablePath: '/usr/bin/chromium', args: ['--no-sandbox','--no-proxy-server'] });
  const touch = w < 1400;
  const p = await (await b.newContext({ viewport: { width: w, height: h }, hasTouch: touch, isMobile: touch && w < 900 })).newPage();
  await p.route('**/api/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{"user":null}' }));
  await p.goto(`http://127.0.0.1:${port}/lab`); await p.waitForSelector('.x-lab__tab'); await p.waitForTimeout(1200);
  await p.evaluate(async ([id, steps, mode]) => {
    let target;
    if (id.startsWith('proc:')) { document.getElementById('ptab-' + id.slice(5)).click(); await new Promise(r => setTimeout(r, 200)); const nx = document.querySelector('#x-proc-body [data-a="next"]'); for (let i = 0; i < steps; i++) nx.click(); target = document.querySelector(mode === 'stage' ? '#x-proc-body .x-proc__stage' : '#x-proc-body'); }
    else if (id.startsWith('prop:')) { window.X_OPEN_PROP(id.slice(5)); await new Promise(r => setTimeout(r, 300)); target = document.querySelector('#x-prop'); }
    else { document.getElementById('tab-' + id).click(); await new Promise(r => setTimeout(r, 200)); const P = document.getElementById('lab-' + id); const sb = P.querySelector('[data-a="step"]'); for (let i = 0; i < steps; i++) sb.click(); target = mode === 'stage' ? P.querySelector('.x-lab__stage') : P; }
    const t = document.querySelector('.x-tool').getBoundingClientRect();
    window.scrollTo(0, target.getBoundingClientRect().top + scrollY - (getComputedStyle(document.querySelector('.x-tool')).position === 'sticky' ? t.height : 0) - 8);
  }, [id, steps, mode]);
  await p.waitForTimeout(1500); await p.screenshot({ path: out }); await b.close();
})();
