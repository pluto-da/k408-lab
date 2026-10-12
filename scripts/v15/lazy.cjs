const { chromium } = require("/workspace/work/pw/node_modules/playwright-core");
const BASE = process.argv[2];
(async () => {
  const b = await chromium.launch({ executablePath: "/usr/bin/chromium", args: ["--no-sandbox","--no-proxy-server","--use-angle=swiftshader","--enable-unsafe-swiftshader"] });
  for (const [w,h,t] of [[393,852,true],[1366,1024,false]]) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, hasTouch: t, isMobile: t });
  const p = await ctx.newPage(); let n = 0;
  p.on("response", res => { n++; if (res.status() >= 300 && res.status() !== 304) console.log(w, res.status(), res.url()); });
  p.on("requestfailed", q => console.log(w, "FAILED", q.url(), q.failure() && q.failure().errorText));
  p.on("pageerror", e => console.log(w, "pageerror", e.message));
  p.on("console", m => { if (m.type()==="error") console.log(w, "console.error", m.text().slice(0,200)); });
  await p.goto(BASE + "/lab", { waitUntil: "networkidle", timeout: 60000 });
  await p.click("#x-3d-toggle").catch(e => console.log("toggle", e.message));
  await p.waitForTimeout(15000);
  await p.evaluate(() => document.getElementById("links") && document.getElementById("links").scrollIntoView());
  await p.waitForTimeout(8000);
  // open first lab
  await p.evaluate(() => { const a = document.querySelector("[data-lab]"); if (a && window.X_OPEN_LAB) X_OPEN_LAB(a.getAttribute("data-lab")); });
  await p.waitForTimeout(2000);
  const sw = await p.evaluate(() => [document.documentElement.scrollWidth, innerWidth]);
  console.log(w, "responses", n, "scrollWidth/innerWidth", sw);
  await ctx.close(); }
  await b.close();
})();
