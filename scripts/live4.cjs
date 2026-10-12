const { chromium } = require('/workspace/work/pw/node_modules/playwright-core');
(async () => {
  const b = await chromium.launch({ executablePath: '/usr/bin/chromium', args: ['--no-sandbox','--no-proxy-server'] });
  const p = await (await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })).newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message.slice(0,200)));
  await p.goto('http://154.8.183.93/lab#lab-kmp', { timeout: 90000, state: 'attached' });
  await p.waitForSelector('#tab-kmp', { timeout: 90000, state: 'attached' }); await p.waitForTimeout(2000);
  const r = await p.evaluate(() => ({ labs: document.querySelectorAll('.x-lab__tab').length, procs: document.querySelectorAll('.x-proc__tab').length, sel: document.querySelector('.x-lab__tab[aria-selected="true"]')?.id, ov: document.documentElement.scrollWidth - innerWidth }));
  await p.goto('about:blank'); await p.goto('http://154.8.183.93/lab#proc-rbtree'); await p.waitForSelector('#ptab-rbtree', { timeout: 90000, state: 'attached' }); await p.waitForTimeout(1500);
  r.proc = await p.evaluate(() => document.querySelector('.x-proc__tab[aria-selected="true"]')?.id);
  console.log(JSON.stringify(r), JSON.stringify(errs)); await b.close();
})().catch(e => { console.log('ERR', e.message.slice(0,300)); process.exit(1); });
