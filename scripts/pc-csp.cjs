// Loads the production build (served with the Caddy CSP) and reports CSP violations / load success.
const { chromium } = require("/tmp/pw/node_modules/playwright");
(async () => {
  const url = process.argv[2] || "http://127.0.0.1:4180/pc?dpr=1";
  const browser = await chromium.launch({ executablePath: "/usr/bin/chromium", args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--no-sandbox"] });
  const page = await browser.newPage({ viewport: { width: 1180, height: 820 } });
  const logs = [];
  page.on("console", (m) => logs.push(`[${m.type()}] ${m.text()}`));
  page.on("pageerror", (e) => logs.push(`[pageerror] ${e.message}`));
  const reqs = [];
  page.on("request", (r) => reqs.push(r.url()));
  await page.addInitScript(() => {
    window.__csp = [];
    document.addEventListener("securitypolicyviolation", (e) => window.__csp.push(`${e.violatedDirective} ${e.blockedURI}`));
  });
  const t0 = Date.now();
  await page.goto(url);
  const ok = await page.waitForFunction(() => !document.querySelector(".pc-loading") && window.__pcStats && window.__pcStats.frames > 5, null, { timeout: 150000 }).then(() => true).catch(() => false);
  await page.waitForTimeout(4000);
  const csp = await page.evaluate(() => window.__csp);
  const external = reqs.filter((u) => !u.startsWith("http://127.0.0.1") && !u.startsWith("data:") && !u.startsWith("blob:"));
  console.log(JSON.stringify({ ok, secs: (Date.now() - t0) / 1000, csp, external, errors: logs.filter((l) => /error|refused|violat/i.test(l)).slice(0, 10) }, null, 1));
  await page.screenshot({ path: "/tmp/csp.png", timeout: 120000 }).catch(() => {});
  await browser.close();
})();
