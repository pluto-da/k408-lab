const { chromium } = require("/workspace/work/pw/node_modules/playwright-core");
(async () => {
  const b = await chromium.launch({ executablePath: "/usr/bin/chromium", args: ["--no-sandbox"] });
  const c = await b.newContext({ viewport: { width: 1366, height: 648 } });
  const p = await c.newPage();
  await p.goto(process.argv[2] || "http://127.0.0.1:4192/lab");
  await p.waitForFunction(() => window.X_OPEN_LAB, null, { timeout: 60000 });
  await p.evaluate(() => window.X_OPEN_LAB("bst"));
  await new Promise((r) => setTimeout(r, 2500));
  const info = await p.evaluate(() => { const s = document.querySelector(".x-lab__panel:not([hidden]) .x-lab__side").getBoundingClientRect(); const t = document.querySelector("#x-tool").getBoundingClientRect(); return { side: [s.top, s.bottom], tool: [t.top, t.bottom] }; });
  console.log(JSON.stringify(info));
  await p.screenshot({ path: "/workspace/work/v20/dbg-1366.png" });
  await b.close();
})();
