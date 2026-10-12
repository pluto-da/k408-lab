const { chromium } = require("/workspace/work/pw/node_modules/playwright-core");
(async () => {
  const b = await chromium.launch({ executablePath: "/usr/bin/chromium", args: ["--no-sandbox"] });
  for (const [w,h] of [[852,393],[393,852],[820,1180]]) {
  const c = await b.newContext({ viewport: { width: w, height: h }, hasTouch: true });
  const p = await c.newPage();
  await p.goto("http://127.0.0.1:4193/lab");
  await p.waitForFunction(() => window.X_OPEN_LAB, null, { timeout: 60000 });
  await p.click("#x-tocbtn");
  await new Promise((r) => setTimeout(r, 500));
  const r1 = await p.evaluate(() => { const bt = document.querySelector("#x-tocbtn").getBoundingClientRect(); const t = document.elementFromPoint(bt.x + bt.width/2, bt.y + bt.height/2); return { open: document.querySelector(".x-toc").classList.contains("is-open"), top: t && (t.id || t.className) }; });
  await p.mouse.click(5, h - 5);
  await new Promise((r) => setTimeout(r, 300));
  const closed = await p.evaluate(() => !document.querySelector(".x-toc").classList.contains("is-open"));
  // reopen and click a link
  await p.click("#x-tocbtn"); await new Promise((r) => setTimeout(r, 400));
  const linkOk = await p.evaluate(() => { const a = [...document.querySelectorAll(".x-toc a")].find(x => x.offsetParent); return !!a; });
  console.log(w, h, JSON.stringify(r1), "closedByBackdrop", closed, "link", linkOk);
  if (w === 852) await p.screenshot({ path: "/workspace/work/v20/dbg-toc2.png" });
  await c.close();
  }
  await b.close();
})();
