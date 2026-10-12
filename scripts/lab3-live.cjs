const { chromium } = require('/workspace/work/pw/node_modules/playwright-core');
(async () => {
  const b = await chromium.launch({ executablePath: '/usr/bin/chromium', args: ['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
  const p = await (await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })).newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message.slice(0,200))); p.on('console', m => { if (m.type()==='error') errs.push(m.text().slice(0,150)); });
  
  await p.goto('http://154.8.183.93/lab', { timeout: 60000 });
  await p.waitForSelector('.x-lab__tab', { timeout: 60000 }); await p.waitForTimeout(1500);
  const ids = ['slidewin','csmacd','crc','ipfrag','lpm','encoding','rip','ieee754','booth','hamming','addressing','disk','partition','prodcons'];
  const res = {};
  for (const id of ids) {
    const t = await p.$('#tab-' + id); if (!t) { res[id] = 'missing'; continue; }
    await t.click(); await p.waitForTimeout(300);
    const panel = '#lab-' + id;
    const n = await p.evaluate((sel) => { const b = document.querySelector(sel + ' button[data-a="step"]'); if (!b) return -1; for (let i = 0; i < 150; i++) b.click(); return 150; }, panel);
    await p.waitForTimeout(400);
    const ov = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    res[id] = { steps: n, ov };
    await p.locator(panel).screenshot({ path: '/workspace/work/shots/lab-' + id + '.png' }).catch(e => res[id].shot = 'fail');
  }
  const proc = ['encap','webvisit','dns','arp','dhcp','nat','switch','email','icmp','cachewrite','fileopen','spooling'];
  for (const id of proc) {
    const t = await p.$('#ptab-' + id) || await p.$('[data-proc="' + id + '"]'); if (!t) { res[id] = 'missing'; continue; }
    await t.click(); await p.waitForTimeout(300);
    const n = await p.evaluate(() => { const b = document.querySelector('#proc button[data-a="next"]'); let k = 0; while (b && !b.disabled && k < 80) { b.click(); k++; } return k; });
    await p.waitForTimeout(400);
    res[id] = { steps: n };
    await p.locator('#proc').screenshot({ path: '/workspace/work/shots/proc-' + id + '.png' }).catch(()=>{});
  }
  const grp = await p.evaluate(() => [...document.querySelectorAll('.x-lab__grp')].map(g => g.querySelector('.x-lab__gl').textContent + ':' + g.querySelectorAll('.x-lab__tab').length));
  console.log(JSON.stringify(res), JSON.stringify(grp), 'errs', JSON.stringify(errs));
  await b.close();
})();
