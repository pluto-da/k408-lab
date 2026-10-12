// 人工复核截图：手机竖屏 / 平板横屏 / 电脑，各页面一张（实验室加一张打开实验后的）。用法：review-shots.cjs BASE OUTDIR
const { chromium } = require("/workspace/work/pw/node_modules/playwright-core");
const fs = require("fs");
const [BASE, OUT] = [process.argv[2], process.argv[3]];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const VPS = [["phone", 393, 732, true], ["tablet", 1180, 700, true], ["desktop", 1366, 648, false]];
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const b = await chromium.launch({ executablePath: "/usr/bin/chromium", args: ["--no-sandbox", "--no-proxy-server", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
  for (const [n, w, h, t] of VPS) {
    const ctx = await b.newContext({ viewport: { width: w, height: h }, hasTouch: t, isMobile: t && w < 600, userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36" });
    await ctx.route("**/api/me", (rt) => rt.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ user: { id: "a", username: "review_user", email: null, nickname: "测试同学", createdAt: "2026-10-01T00:00:00Z" } }) }));
    for (const r of ["/", "/lab", "/pc?dpr=1", "/pc?ride=access&dpr=1", "/login", "/register", "/terms", "/privacy", "/profile", "/nope"]) {
      const p = await ctx.newPage();
      try {
        await p.goto(BASE + r, { waitUntil: "domcontentloaded", timeout: 60000 });
        await sleep(r.startsWith("/pc") ? 9000 : 2500);
        const f = `${OUT}/${n}${r.replace(/[/?=&]/g, "_")}.png`;
        await p.screenshot({ path: f });
        if (r === "/lab") {
          await p.waitForFunction(() => window.X_OPEN_LAB, null, { timeout: 60000 });
          for (const id of ["lru", "tcp", "gantt"]) {
            await p.evaluate((x) => { window.X_OPEN_LAB(x); for (let i = 0; i < 6; i++) window.X_LAB_ACT("step"); }, id);
            await sleep(1500);
            await p.screenshot({ path: `${OUT}/${n}_lab-${id}.png` });
          }
        }
      } catch (e) { console.log("fail", n, r, e.message.slice(0, 100)); }
      await p.close();
    }
    await ctx.close();
  }
  await b.close();
  console.log("done");
})();
