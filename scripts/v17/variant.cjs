// 化身数据：缺页 + 一级页表 + 数据在主存 + FIFO 的走查，截取缺页、L3、内存颗粒、装入 L1 各站
const path = require("node:path");
const { chromium } = require("/workspace/work/pw/node_modules/playwright-core");
const BASE = process.argv[2] || "http://localhost:4174";
const W = Number(process.argv[3] || 1366), H = Number(process.argv[4] || 768);
const OUT = "/workspace/work/v17";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const browser = await chromium.launch({ executablePath: "/usr/bin/chromium", args: ["--no-sandbox", "--no-proxy-server", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
  const ctx = await browser.newContext({ viewport: { width: W, height: H } });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const seen = [];
  try {
    await page.goto(`${BASE}/pc?ride=access&dpr=1`);
    await page.waitForSelector(".rd-cap", { timeout: 60000 });
    await page.click(".rd-tools button:has-text('参数')");
    await page.click(".rd-card--params .rd-row:has-text('页表') button:has-text('一级')");
    await page.click(".rd-card--params .rd-row:has-text('页在主存') button:has-text('不在')");
    await page.click(".rd-card--params .rd-row:has-text('替换策略') button:has-text('FIFO')");
    await page.click(".rd-card--params button:has-text('按新参数出发')");
    await sleep(500);
    for (let i = 0; i < 5; i++) await page.keyboard.press("e");
    const t0 = Date.now();
    const want = { "缺页": "v-fault", "L3": "v-l3", "内存颗粒": "v-dram", "装入 L1": "v-fill", "页表：只有一层": "v-pt" };
    while (Date.now() - t0 < 200000 && !(await page.$(".rd-sum"))) {
      const t = await page.$eval(".rd-cap h2", (e) => e.textContent).catch(() => "");
      const nx = await page.$eval(".rd-next", (e) => e.textContent).catch(() => "");
      if (seen[seen.length - 1] !== t) seen.push(t);
      if (nx.includes("继续") || nx.includes("小结")) {
        const k = Object.keys(want).find((x) => t.includes(x));
        if (k) {
          await sleep(2600);
          await page.screenshot({ path: path.join(OUT, `${want[k]}.png`) });
          delete want[k];
        }
        await page.click(".rd-next");
      }
      await sleep(400);
    }
    await sleep(500);
    await page.screenshot({ path: path.join(OUT, "v-summary.png") });
  } catch (e) {
    errors.push("script " + e.message);
  }
  console.log(JSON.stringify({ seen, errors }));
  await browser.close();
})();
