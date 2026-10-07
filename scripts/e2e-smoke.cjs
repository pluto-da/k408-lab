/* 端到端冒烟测试（可选）：需要本机已安装 playwright 与 chromium，并已启动 api(:3000) 与 web 预览(:4173)。
   用法：NODE_PATH=<含 playwright 的 node_modules> node scripts/e2e-smoke.cjs [http://localhost:4173] [截图目录] */
const { chromium } = require("playwright");

const BASE = process.argv[2] || "http://localhost:4173";
const SHOTS = process.argv[3] || null;
const log = (...a) => console.log("•", ...a);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const browser = await chromium.launch({ args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 }, reducedMotion: "reduce", locale: "zh-CN" });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  await page.addInitScript(() => {
    window.__evs = [];
    window.addEventListener("lab:event", (e) => window.__evs.push(e.detail));
  });

  // 1. 匿名进入实验室
  await page.goto(BASE + "/lab");
  await page.waitForFunction(() => window.__LEGACY_BOOTED__ === true, null, { timeout: 60000 });
  await sleep(1500);
  const heroState = await page.evaluate(() => ({
    canvas: !!document.querySelector("#stage canvas"),
    fallback: document.getElementById("hero")?.classList.contains("is-fallback"),
    labTabs: document.querySelectorAll(".x-lab__tab").length,
    quiz: !!document.querySelector(".x-quiz__opt"),
    chapters: document.querySelectorAll(".x-ch button").length,
    graph: !!document.querySelector("#x-graph-stage canvas"),
    hero: !!window.HERO, play: !!window.PLAY, flow: !!window.FLOW,
  }));
  log("实验室已挂载", JSON.stringify(heroState));
  if (SHOTS) await page.screenshot({ path: SHOTS + "/lab-hero.png" });

  // 2. 章节、实验、部件、自测
  await page.click('#ds .x-ch li:nth-child(5) button');
  await page.click("#tab-banker");
  await page.evaluate(() => window.HERO && window.HERO.focus && window.HERO.focus("cpu"));
  await sleep(300);
  await page.keyboard.press("Escape");
  await page.click('.x-quiz__opt[data-k="0"]'); // q1 答错
  await page.click(".x-quiz__nav button");
  await page.click('.x-quiz__opt[data-k="2"]'); // q2 答对
  // 3. 闯关：逐个试答案直到通关（会产生失误）
  await page.evaluate(() => window.PLAY.setup("life"));
  await page.click('.x-play-card button.x-panel__btn--main');
  for (let guard = 0; guard < 80; guard++) {
    const end = await page.evaluate(() => [...document.querySelectorAll(".x-play-card")].some((c) => !c.hidden && /再玩一次/.test(c.textContent)));
    if (end) break;
    const q = () => page.evaluate(() => (document.querySelector(".x-playbar .x-flowbar__meta") || {}).textContent || "");
    const before = await q();
    const btns = await page.$$(".x-play-ans button:not(:disabled)");
    if (btns.length) await btns[0].click({ force: true });
    else {
      for (const p of await page.$$("#xparts button[data-k]")) {
        await p.click({ force: true });
        await sleep(350);
        if ((await q()) !== before || !(await page.$(".x-playbar:not([hidden])"))) break;
      }
    }
    await sleep(400);
  }
  const evs = await page.evaluate(() => window.__evs.map((e) => e.type));
  log("捕获事件", JSON.stringify(evs.reduce((a, t) => ((a[t] = (a[t] || 0) + 1), a), {})));
  const fin = await page.evaluate(() => window.__evs.find((e) => e.type === "flow_finished"));
  log("闯关结算", JSON.stringify(fin));
  const queued = await page.evaluate(() => JSON.parse(sessionStorage.getItem("k408.pendingEvents") || "[]").length);
  log("未登录暂存队列", queued);
  if (SHOTS) await page.screenshot({ path: SHOTS + "/lab-play.png" });

  // 4. 注册（离开 /lab 会整页加载），登录后补传
  await page.click('a.app-btn:has-text("注册")');
  await page.waitForURL(/\/register/);
  const name = "e2e_" + Date.now().toString(36);
  await page.fill('input[autocomplete="username"]', name);
  await page.fill('input[maxlength="20"]', "端到端同学");
  const pw = await page.$$('input[type="password"]');
  await pw[0].fill("password123");
  await pw[1].fill("password123");
  await page.click('button:has-text("注册并登录")');
  await page.waitForURL(/\/dashboard/);
  await sleep(2500);
  await page.reload();
  await page.waitForSelector(".subj");
  const dash = await page.$$eval(".subj", (els) => els.map((e) => e.querySelector("h2").textContent + " " + e.querySelector("strong").textContent));
  log("学习进度", JSON.stringify(dash));
  if (SHOTS) await page.screenshot({ path: SHOTS + "/dashboard.png", fullPage: true });

  const mistakes = await page.evaluate(() => fetch("/api/mistakes").then((r) => r.json()));
  log("错题", mistakes.items.length, JSON.stringify(mistakes.items.map((m) => m.source + ":" + m.prompt.replace(/<[^>]+>/g, "").slice(0, 16))));
  const lb = await page.evaluate(() => fetch("/api/leaderboard/life?period=week").then((r) => r.json()));
  log("排行榜我的名次", JSON.stringify(lb.me));

  // 5. 站内导航：进入 /lab 再离开到错题本
  await page.click('nav a:has-text("实验室")');
  await page.waitForFunction(() => window.__LEGACY_BOOTED__ === true, null, { timeout: 60000 });
  await page.click('nav a:has-text("错题本")');
  await page.waitForSelector(".mistake", { timeout: 20000 });
  const cards = await page.$$eval(".mistake", (e) => e.length);
  log("错题本卡片", cards);
  // 重做第一张（自测题）
  if (SHOTS) await page.screenshot({ path: SHOTS + "/mistakes.png", fullPage: true });
  await page.goto(BASE + "/leaderboard?flow=life");
  await page.waitForSelector(".lb, .empty");
  if (SHOTS) await page.screenshot({ path: SHOTS + "/leaderboard.png", fullPage: true });
  await page.goto(BASE + "/");
  if (SHOTS) await page.screenshot({ path: SHOTS + "/home.png", fullPage: true });

  log("页面错误", errors.length ? JSON.stringify(errors.slice(0, 8)) : "无");
  await browser.close();
  const ok = fin && mistakes.items.length > 0 && lb.me && cards > 0;
  console.log(ok ? "E2E 通过" : "E2E 失败");
  process.exit(ok ? 0 : 1);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
