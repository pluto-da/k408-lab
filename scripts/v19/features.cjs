// v19 功能截图：更多菜单、视角菜单、我来判断、抽屉展开、沉浸、手动、参数、文字版
const { chromium } = require("/workspace/work/pw/node_modules/playwright-core");
const fs = require("fs");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const BASE = process.argv[2] || "http://127.0.0.1:4182";
const OUT = process.argv[3] || "/workspace/work/v19/feat";
fs.mkdirSync(OUT, { recursive: true });
async function open(b, w, h, touch) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, hasTouch: touch, isMobile: touch && w < 900 });
  const p = await ctx.newPage();
  p.on("pageerror", (e) => console.log("pageerror", e.message));
  await p.goto(`${BASE}/pc?ride=access&dpr=1`);
  await p.waitForFunction(() => window.__ride && document.querySelector(".rd-panel"), null, { timeout: 90000 });
  await sleep(6500);
  return { ctx, p };
}
async function go(p, i) {
  await p.evaluate((k) => window.__ride.goTo(k), i);
  await sleep(3800);
}
(async () => {
  const b = await chromium.launch({ executablePath: "/usr/bin/chromium", args: ["--no-sandbox", "--no-proxy-server", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
  if (!process.env.PHONE_ONLY) {
  {
    const { ctx, p } = await open(b, 1366, 640, false);
    await go(p, 1);
    await p.click(".rd-tr .rd-more:last-child > button");
    await sleep(400);
    await p.screenshot({ path: `${OUT}/desktop-menu.png` });
    await p.keyboard.press("Escape");
    await p.click(".rd-view-btn");
    await sleep(300);
    await p.screenshot({ path: `${OUT}/desktop-view-menu.png` });
    await p.keyboard.press("Escape");
    // 我来判断
    await p.click(".rd-tr .rd-more:last-child > button");
    await sleep(200);
    await p.click("text=岔路口由我来判断");
    await p.keyboard.press("Escape");
    await p.evaluate(() => window.__ride.start({}));
    await sleep(1500);
    await go(p, 1);
    await p.screenshot({ path: `${OUT}/desktop-judge.png` });
    await p.click(".rd-opt >> nth=0");
    await sleep(2500);
    await p.screenshot({ path: `${OUT}/desktop-judge-answered.png` });
    // 手动游走
    await p.click(".rd-mode");
    await sleep(400);
    await p.screenshot({ path: `${OUT}/desktop-manual.png` });
    await p.keyboard.press("h");
    await sleep(600);
    await p.screenshot({ path: `${OUT}/desktop-immersive.png` });
    await p.keyboard.press("h");
    await sleep(300);
    await p.click(".rd-tr .rd-more:last-child > button");
    await sleep(200);
    await p.click("text=参数");
    await sleep(400);
    await p.screenshot({ path: `${OUT}/desktop-params.png` });
    await p.keyboard.press("Escape");
    await p.click(".rd-tr .rd-more:last-child > button");
    await sleep(200);
    await p.click("text=文字版路线");
    await sleep(400);
    await p.screenshot({ path: `${OUT}/desktop-text.png` });
    await ctx.close();
  }
  }
  {
    const { ctx, p } = await open(b, 393, 732, true);
    await go(p, 1);
    await p.click(".rd-head__t");
    await sleep(700);
    await p.screenshot({ path: `${OUT}/phone-drawer-full.png` });
    await p.click(".rd-ctl .rd-more > button");
    await sleep(400);
    await p.screenshot({ path: `${OUT}/phone-menu.png` });
    await p.keyboard.press("Escape");
    await p.evaluate(() => window.__ride.pause(true));
    await go(p, 2);
    await p.screenshot({ path: `${OUT}/phone-bus.png` });
    await ctx.close();
  }
  {
    const { ctx, p } = await open(b, 852, 273, true);
    await go(p, 1);
    await p.click(".rd-tr .rd-more > button");
    await sleep(400);
    await p.screenshot({ path: `${OUT}/phone-land-menu.png` });
    await ctx.close();
  }
  await b.close();
  console.log("done");
})();
