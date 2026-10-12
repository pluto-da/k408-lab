const { chromium } = require("/workspace/work/pw/node_modules/playwright-core");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const browser = await chromium.launch({ executablePath: "/usr/bin/chromium", args: ["--no-sandbox", "--no-proxy-server"] });
  const page = await (await browser.newContext({ viewport: { width: 1400, height: 900 }, reducedMotion: "reduce" })).newPage();
  await page.goto("http://localhost:4178/lab");
  await page.waitForFunction(() => window.__LEGACY_BOOTED__ === true, null, { timeout: 90000 });
  await sleep(1000);
  const L = [["floyd", "示例二·4 顶点（多次中转）"], ["topo", "示例 AOV（6 顶点·两个入度为 0）"]];
  let i = 0;
  for (const [id, label] of L) {
    await page.evaluate(([id, label]) => { const t = document.getElementById("tab-" + id); t.hidden = false; t.click(); const b = Array.from(document.querySelectorAll("#lab-" + id + " .x-lab__opts button")).find((x) => x.textContent.trim() === label); b.click(); }, [id, label]);
    for (let k = 0; k < 40; k++) await page.click("#lab-" + id + ' [data-a="step"]');
    const st = await page.$("#lab-" + id + " .x-lab__stage");
    await st.screenshot({ path: `/workspace/work/srcfix/shot-${i++}-${id}.png` });
  }
  await browser.close();
})();
