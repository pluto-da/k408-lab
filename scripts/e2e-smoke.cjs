/* 端到端冒烟测试（可选）：需要本机已安装 playwright 与 chromium，并已启动 api(:3000) 与 web 预览(:4173)。
   用法：NODE_PATH=<含 playwright 的 node_modules> node scripts/e2e-smoke.cjs [http://localhost:4173] [截图目录] */
const { chromium } = require("playwright");

const BASE = process.argv[2] || "http://localhost:4173";
const SHOTS = process.argv[3] || null;
const log = (...a) => console.log("•", ...a);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ["--no-sandbox", "--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 }, reducedMotion: "reduce", locale: "zh-CN" });
  const page = await ctx.newPage();
  const errors = [];
  const apiCalls = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  page.on("request", (r) => {
    const u = new URL(r.url());
    if (u.pathname.startsWith("/api/")) apiCalls.push(r.method() + " " + u.pathname);
  });

  // 1. 首页：导航里没有学习进度/错题本
  await page.goto(BASE + "/");
  const navText = await page.$eval("nav", (n) => n.textContent);
  log("导航", navText);
  if (SHOTS) await page.screenshot({ path: SHOTS + "/home.png" });

  // 2. 匿名进入实验室
  await page.goto(BASE + "/lab");
  await page.waitForFunction(() => window.__LEGACY_BOOTED__ === true, null, { timeout: 60000 });
  await sleep(1500);
  const heroState = await page.evaluate(() => ({
    canvas: !!document.querySelector("#stage canvas"),
    labTabs: document.querySelectorAll(".x-lab__tab").length,
    chapters: document.querySelectorAll(".x-ch button").length,
    emit: typeof window.LAB_EMIT,
  }));
  log("实验室已挂载", JSON.stringify(heroState));
  if (SHOTS) await page.screenshot({ path: SHOTS + "/lab-hero.png" });

  // 3. 章节、实验、部件、流程演示都还能用，且不再上报任何学习事件
  await page.click('#ds .x-ch li:nth-child(5) button');
  await page.click("#tab-banker");
  await page.evaluate(() => window.HERO && window.HERO.focus && window.HERO.focus("cpu"));
  await sleep(300);
  await page.keyboard.press("Escape");
  await page.click('#xflows button[data-flow="pagefault"]');
  await sleep(500);
  const flowBar = await page.evaluate(() => !document.getElementById("xflowbar").hidden);
  log("流程演示", flowBar);
  await page.click("#xf-exit");
  await sleep(500);

  // 4. 注册并登录后回到首页
  await page.goto(BASE + "/register");
  const name = "e2e_" + Date.now().toString(36);
  await page.fill('input[autocomplete="username"]', name);
  await page.fill('input[maxlength="20"]', "端到端同学");
  const pw = await page.$$('input[type="password"]');
  await pw[0].fill("password123");
  await pw[1].fill("password123");
  await page.click('button:has-text("注册并登录")');
  await page.waitForURL((u) => new URL(u).pathname === "/");
  const me = await page.evaluate(() => fetch("/api/me").then((r) => r.json()));
  log("登录用户", me.user && me.user.nickname);

  // 5. 旧路由与接口已移除
  await page.goto(BASE + "/dashboard");
  const dashGone = await page.evaluate(() => !document.querySelector(".subj"));
  const gone = await page.evaluate(() =>
    Promise.all(["/api/progress", "/api/mistakes"].map((u) => fetch(u).then((r) => r.status))),
  );
  errors.length = 0; // 上面的 404 是预期的
  log("旧接口状态", JSON.stringify(gone));

  // 6. 整机拆解页可打开
  await page.goto(BASE + "/pc");
  await page.waitForSelector(".pc-page", { timeout: 20000 });

  const posted = apiCalls.filter((c) => /\/api\/(events|progress|mistakes)/.test(c) && !c.startsWith("GET"));
  log("学习事件上报", posted.length);
  log("页面错误", errors.length ? JSON.stringify(errors.slice(0, 8)) : "无");
  await browser.close();
  const ok =
    !/学习进度|错题本|排行榜/.test(navText) && heroState.labTabs > 0 && heroState.emit === "undefined" &&
    flowBar && me.user && dashGone && gone.every((s) => s === 404) && posted.length === 0;
  console.log(ok ? "E2E 通过" : "E2E 失败");
  process.exit(ok ? 0 : 1);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
