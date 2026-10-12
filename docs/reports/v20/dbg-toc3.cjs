const { chromium } = require("/workspace/work/pw/node_modules/playwright-core");
(async () => {
  const b = await chromium.launch({ executablePath: "/usr/bin/chromium", args: ["--no-sandbox"] });
  const [w,h]=[852,393];
  const c = await b.newContext({ viewport: { width: w, height: h }, hasTouch: true });
  const p = await c.newPage();
  await p.goto("http://127.0.0.1:" + (process.argv[2]||4193) + "/lab");
  await p.waitForFunction(() => window.X_OPEN_LAB, null, { timeout: 60000 });
  const st = () => p.evaluate(() => document.querySelector(".x-toc").classList.contains("is-open"));
  await p.click("#x-tocbtn"); await new Promise((r) => setTimeout(r, 500));
  console.log("after open", await st());
  await p.mouse.click(5, h - 5);
  for (const t of [50, 300, 1000]) { await new Promise((r) => setTimeout(r, t)); console.log("after backdrop +" + t, await st()); }
  await p.click("#x-tocbtn", { timeout: 5000 }).catch(e => console.log("click fail"));
  await new Promise((r) => setTimeout(r, 400)); console.log("after reopen", await st());
  await p.tap("#x-tocbtn", { timeout: 5000, force: true }).catch(e => console.log("tap fail"));
  await new Promise((r) => setTimeout(r, 400)); console.log("after tap on btn (backdrop)", await st());
  await b.close();
})();
