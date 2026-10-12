// 渲染后文字导出：每个页面渲染完成后导出 body 全部文字（含隐藏的实验 / 图解 / 性质面板）。用法：render-text.cjs BASE OUTDIR
const { chromium } = require("/workspace/work/pw/node_modules/playwright-core");
const fs = require("fs"), path = require("path");
const [BASE, OUT] = [process.argv[2], process.argv[3]];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const b = await chromium.launch({ executablePath: "/usr/bin/chromium", args: ["--no-sandbox", "--no-proxy-server", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
  const ctx = await b.newContext({ viewport: { width: 1366, height: 768 } });
  let bad = 0;
  for (const r of ["/", "/lab", "/pc", "/pc?ride=access", "/login", "/register", "/terms", "/privacy", "/nope"]) {
    const p = await ctx.newPage();
    try {
      await p.goto(BASE + r, { waitUntil: "domcontentloaded", timeout: 60000 });
      await p.waitForSelector("main, .rd-panel", { timeout: 60000 }).catch(() => {});
      await sleep(r.startsWith("/pc") ? 8000 : 1500);
      let text = await p.evaluate(() => document.body.innerText + "\n" + document.body.textContent + "\n" + document.title + "\n" + [...document.querySelectorAll("[aria-label],[title],[placeholder],meta[content]")].map((e) => e.getAttribute("aria-label") || e.getAttribute("title") || e.getAttribute("placeholder") || e.getAttribute("content")).join("\n"));
      if (r === "/lab") {
        await p.waitForFunction(() => window.X_OPEN_LAB, null, { timeout: 60000 });
        text += await p.evaluate(async () => {
          const ids = (a) => [...new Set([...document.querySelectorAll("#x-toc a[" + a + "]")].map((x) => x.getAttribute(a)))];
          let t = "";
          for (const id of ids("data-lab")) { window.X_OPEN_LAB(id); for (let i = 0; i < 40; i++) window.X_LAB_ACT && window.X_LAB_ACT("step"); t += document.body.innerText + "\n"; }
          for (const id of ids("data-proc")) { window.X_OPEN_PROC(id); t += (document.getElementById("proc") || document.body).innerText + "\n"; }
          for (const id of ids("data-prop")) { window.X_OPEN_PROP(id, true); t += (document.getElementById("prop") || document.body).innerText + "\n"; }
          return t;
        });
      }
      fs.writeFileSync(path.join(OUT, (r.replace(/[/?=]/g, "_") || "_") + ".txt"), text);
      console.log("rendered", r, text.length);
    } catch (e) { bad++; console.log("render fail", r, e.message.slice(0, 120)); }
    await p.close();
  }
  await b.close();
  process.exit(bad ? 1 : 0);
})();
