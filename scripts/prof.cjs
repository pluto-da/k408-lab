const { chromium, devices } = require('/tmp/pw/node_modules/playwright-core');
(async () => {
  const b = await chromium.launch({ executablePath: '/usr/bin/chromium', args: ['--no-sandbox'] });
  const ctx = await b.newContext(devices['Pixel 7']); const p = await ctx.newPage();
  let authed = true, calls = [];
  await p.route('**/api/me', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ user: authed ? { id: 'u1', username: 'kaoyan_er', email: null, nickname: '考研人', createdAt: '2026-09-01T08:00:00.000Z' } : null }) }));
  await p.route('**/api/auth/logout-all', r => { calls.push(r.request().method()); authed = false; r.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' }); });
  await p.goto('http://localhost:4173/profile'); await p.waitForTimeout(800);
  await p.getByRole('button', { name: '退出所有设备', exact: true }).click();
  await p.screenshot({ path: 'prof_confirm.png' , clip: { x: 0, y: 380, width: 412, height: 420 } });
  await p.getByRole('button', { name: '确认退出所有设备' }).click();
  await p.waitForTimeout(1500);
  console.log('calls', calls, 'url', p.url(), 'bar', await p.textContent('.app-user'));
  await b.close();
})();
