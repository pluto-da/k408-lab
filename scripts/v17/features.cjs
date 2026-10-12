// 化身数据：入口、路线选择、我来判断、视角、手动游走、文字版、参数、退出、减少动态效果
const path = require("node:path");
const { chromium } = require("/workspace/work/pw/node_modules/playwright-core");
const BASE = process.argv[2] || "http://localhost:4174";
const OUT = "/workspace/work/v17";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...a) => console.log(...a);

async function untilArrived(page, ms = 30000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    const t = await page.$eval(".rd-next", (e) => e.textContent).catch(() => "");
    if (t.includes("继续") || t.includes("小结")) return true;
    await sleep(300);
  }
  return false;
}

(async () => {
  const browser = await chromium.launch({
    executablePath: "/usr/bin/chromium",
    args: ["--no-sandbox", "--no-proxy-server", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
  });
  const errors = [];
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 } });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
  page.on("console", (m) => m.type() === "error" && !/api|favicon|Failed to load resource/i.test(m.text()) && errors.push("console: " + m.text()));
  const checks = {};
  try {
    await page.goto(`${BASE}/pc?dpr=1`);
    const btn = page.locator("button.pc-btn--tour", { hasText: "化身数据" });
    await btn.waitFor({ timeout: 60000 });
    await page.waitForFunction(() => [...document.querySelectorAll("button.pc-btn--tour")].some((b) => b.textContent.includes("化身数据") && !b.disabled), null, { timeout: 60000 });
    checks.entry = true;
    await btn.click();
    await page.waitForSelector(".rd-pick", { timeout: 20000 });
    await page.screenshot({ path: path.join(OUT, "pick.png") });
    checks.pickRoutes = await page.$$eval(".rd-pick li", (l) => l.length);
    await page.click(".rd-pick li:first-child button");
    await page.waitForSelector(".rd-cap", { timeout: 30000 });
    for (let i = 0; i < 5; i++) await page.keyboard.press("e");
    // 我来判断
    await page.click(".rd-tools button:has-text('设置')");
    await page.click(".rd-card--set button:has-text('我来判断')");
    await page.click(".rd-card--set .rd-x");
    // 第 1 站 → 第 2 站（TLB，岔路口）
    await untilArrived(page);
    await page.click(".rd-next");
    await untilArrived(page);
    checks.forkTitle = await page.$eval(".rd-cap h2", (e) => e.textContent);
    checks.nextDisabledBeforeAnswer = await page.$eval(".rd-next", (e) => e.disabled);
    await page.click(".rd-opt:has-text('命中')");
    await sleep(300);
    checks.wrongFeedback = await page.$eval(".rd-fork small", (e) => e.className + " " + e.textContent).catch(() => "");
    await sleep(1500);
    await page.screenshot({ path: path.join(OUT, "judge.png") });
    checks.nextEnabledAfter = !(await page.$eval(".rd-next", (e) => e.disabled));
    // 视角
    await page.keyboard.press("v");
    await sleep(1200);
    await page.screenshot({ path: path.join(OUT, "view-follow.png") });
    await page.keyboard.press("v");
    await sleep(1500);
    await page.screenshot({ path: path.join(OUT, "view-map.png") });
    checks.viewLabel = await page.$eval(".rd-tools .pc-btn:nth-child(2)", (e) => e.textContent);
    await page.keyboard.press("v");
    // 手动游走：按住 W
    const before = await page.$eval(".rd-cap h2", (e) => e.textContent);
    await page.keyboard.down("w");
    await sleep(4000);
    await page.keyboard.up("w");
    await sleep(500);
    checks.manual = { before, after: await page.$eval(".rd-cap h2", (e) => e.textContent), mode: await page.$eval(".rd-ctl .pc-seg .is-on", (e) => e.textContent) };
    checks.padShown = !!(await page.$(".rd-pad"));
    // 拖动转头
    const box = await page.$eval(".rd-look", (e) => { const r = e.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 3]; });
    await page.mouse.move(box[0], box[1]);
    await page.mouse.down();
    await page.mouse.move(box[0] + 160, box[1] + 40, { steps: 8 });
    await sleep(200);
    await page.screenshot({ path: path.join(OUT, "look.png") });
    await page.mouse.up();
    // 时间轴跳站
    await page.click(".rd-timeline button:nth-child(1)");
    await sleep(800);
    checks.timelineJump = await page.$eval(".rd-cap h2", (e) => e.textContent);
    // 这是什么
    await page.click(".rd-what");
    checks.what = await page.$eval(".rd-card--what h3", (e) => e.textContent);
    checks.whatLinks = await page.$$eval(".rd-card--what a", (l) => l.map((a) => a.getAttribute("href")));
    await page.click(".rd-card--what .rd-x");
    // 文字版
    await page.click(".rd-tools button:has-text('文字版')");
    await sleep(300);
    await page.screenshot({ path: path.join(OUT, "text.png") });
    checks.textItems = await page.$$eval(".rd-textroute li", (l) => l.length);
    await page.click(".rd-card--text .rd-x");
    // 参数：TLB 命中 + 直接映射
    await page.click(".rd-tools button:has-text('参数')");
    await page.click(".rd-card--params .rd-row:has-text('TLB') button:has-text('命中')");
    await page.selectOption(".rd-card--params .rd-row:has-text('相联度') select", "1");
    await page.screenshot({ path: path.join(OUT, "params.png") });
    await page.click(".rd-card--params button:has-text('按新参数出发')");
    await sleep(800);
    checks.afterParams = await page.$$eval(".rd-timeline button", (l) => l.map((b) => b.getAttribute("title")));
    // 退出
    await page.keyboard.press("Escape");
    await sleep(2500);
    checks.exited = !(await page.$(".rd-root")) && (await page.isVisible(".pc-tools"));
    await page.screenshot({ path: path.join(OUT, "exit.png") });
  } catch (e) {
    errors.push("script: " + e.message);
    await page.screenshot({ path: path.join(OUT, "features-fail.png") });
  }
  await ctx.close();

  // 减少动态效果（手机）
  const ctx2 = await browser.newContext({ viewport: { width: 393, height: 852 }, hasTouch: true, isMobile: true, reducedMotion: "reduce" });
  const p2 = await ctx2.newPage();
  p2.on("pageerror", (e) => errors.push("rm pageerror: " + e.message));
  try {
    await p2.goto(`${BASE}/pc?ride=access&dpr=1`);
    await p2.waitForSelector(".rd-cap", { timeout: 60000 });
    const seen = [];
    for (let i = 0; i < 40 && !(await p2.$(".rd-sum")); i++) {
      const t = await p2.$eval(".rd-cap h2", (e) => e.textContent);
      if (seen[seen.length - 1] !== t) seen.push(t);
      const b = await p2.$(".rd-next:not([disabled])");
      if (b) await b.click();
      await sleep(700);
    }
    checks.reduced = { stations: seen.length, summary: !!(await p2.$(".rd-sum")) };
    await p2.screenshot({ path: path.join(OUT, "reduced-summary.png") });
  } catch (e) {
    errors.push("rm script: " + e.message);
  }
  await browser.close();
  log(JSON.stringify({ checks, errors }, null, 2));
})();
