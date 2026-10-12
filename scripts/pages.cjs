const { chromium, devices } = require('/tmp/pw/node_modules/playwright-core');
(async () => {
  const b = await chromium.launch({ executablePath: '/usr/bin/chromium', args: ['--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox'] });
  const user = { id: 'u1', username: 'kaoyan_er', email: null, nickname: '考研人', createdAt: '2026-09-01T08:00:00.000Z' };
  async function shot(name, path, dev, opts = {}) {
    const ctx = await b.newContext(dev === 'phone' ? devices['Pixel 7'] : { viewport: { width: 1366, height: 860 } });
    const p = await ctx.newPage();
    const errs = [];
    p.on('pageerror', e => errs.push(e.message.slice(0, 200)));
    p.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 200)); });
    await p.route('**/api/me', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ user: opts.authed ? user : null }) }));
    await p.goto('http://localhost:4173' + path, { waitUntil: 'load' });
    if (path === '/lab') await p.waitForFunction(() => window.HERO && window.HERO.ready, null, { timeout: 90000 }).catch(() => errs.push('NOT READY'));
    await p.waitForTimeout(path === '/lab' ? 2500 : 800);
    if (opts.before) await opts.before(p);
    await p.screenshot({ path: `pg_${name}.png`, fullPage: !!opts.full });
    const info = await p.evaluate(() => ({ title: document.title, quiz: !!document.getElementById('quiz'), overflow: document.documentElement.scrollWidth > window.innerWidth }));
    console.log(name, JSON.stringify(info), JSON.stringify(errs));
    await ctx.close();
  }
  await shot('lab_phone', '/lab', 'phone');
  await shot('terms_phone', '/terms', 'phone');
  await shot('privacy_desk', '/privacy', 'desk');
  await shot('register_phone', '/register', 'phone', { full: true });
  await shot('profile_phone', '/profile', 'phone', { authed: true, full: true, before: async p => { await p.click('text=退出所有设备'); await p.click('summary'); } });
  await shot('home_phone_foot', '/', 'phone', { before: async p => { await p.evaluate(() => window.scrollTo(0, document.body.scrollHeight)); await p.waitForTimeout(300); } });
  await b.close();
})();
