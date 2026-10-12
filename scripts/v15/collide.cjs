const { chromium } = require("/workspace/work/pw/node_modules/playwright-core");
const BASE = process.argv[2] || "http://127.0.0.1:4174";
const OUT = "/workspace/work/v15/shots";
require("fs").mkdirSync(OUT, { recursive: true });
(async () => {
  const b = await chromium.launch({ executablePath: "/usr/bin/chromium", args: ["--no-sandbox","--use-angle=swiftshader","--enable-unsafe-swiftshader"] });
  for (const [w, h, touch] of [[393, 852, true], [820, 1180, true], [1366, 1024, true], [2560, 1440, false]]) {
    const ctx = await b.newContext({ viewport: { width: w, height: h }, hasTouch: touch, isMobile: touch && w < 600 });
    const p = await ctx.newPage();
    const errs = []; p.on("pageerror", e => errs.push(String(e.message)));
    await p.goto(BASE + "/lab", { waitUntil: "domcontentloaded" });
    await p.waitForSelector(".lab-loading", { state: "detached", timeout: 30000 }).catch(() => {});
    await p.waitForTimeout(1500);
    // scroll down and check header vs toolbar
    await p.evaluate(() => window.scrollTo(0, 1500));
    await p.waitForTimeout(500);
    const r = await p.evaluate(() => {
      const q = s => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); const cs = getComputedStyle(e); return { top: Math.round(r.top), bottom: Math.round(r.bottom), pos: cs.position, z: cs.zIndex, disp: cs.display }; };
      return { bar: q(".app-bar"), tool: q("#x-tool"), toc: q("#x-toc"), sticky: getComputedStyle(document.documentElement).getPropertyValue("--x-sticky") };
    });
    console.log(w, "scrolled", JSON.stringify(r));
    await p.screenshot({ path: `${OUT}/${w}_lab_scrolled.png` });
    // open TOC if button visible
    const btn = await p.$("#x-tocbtn");
    if (btn && await btn.isVisible()) {
      await btn.click(); await p.waitForTimeout(400);
      const t = await p.evaluate(() => { const r = document.querySelector("#x-toc").getBoundingClientRect(); const tb = document.querySelector("#x-tool").getBoundingClientRect(); return { toc: [Math.round(r.top), Math.round(r.bottom), Math.round(r.left), Math.round(r.right)], toolBottom: Math.round(tb.bottom), overlapTool: r.top < tb.bottom - 1 && r.bottom > tb.top }; });
      console.log(w, "toc open", JSON.stringify(t));
      await p.screenshot({ path: `${OUT}/${w}_lab_toc.png` });
      await p.keyboard.press("Escape"); await p.waitForTimeout(200);
    }
    // drawer: scroll top, open menu
    await p.evaluate(() => window.scrollTo(0, 0)); await p.waitForTimeout(300);
    const menu = await p.$(".app-menu");
    if (menu && await menu.isVisible()) {
      await menu.click(); await p.waitForTimeout(400);
      const d = await p.evaluate(() => {
        const nav = document.querySelector(".app-bar .app-nav").getBoundingClientRect();
        const cx = Math.round(nav.left + nav.width / 2), cy = Math.round(nav.top + nav.height * 0.7);
        const el = document.elementFromPoint(cx, cy);
        return { nav: [Math.round(nav.top), Math.round(nav.bottom)], topEl: el && (el.closest(".app-bar") ? "app-bar" : el.className || el.tagName) };
      });
      console.log(w, "drawer", JSON.stringify(d));
      await p.screenshot({ path: `${OUT}/${w}_lab_drawer.png` });
      // also drawer while TOC open (open toc via JS, then menu)
    }
    console.log(w, "errors", errs.length, errs.slice(0,3).join(" | "));
    await ctx.close();
  }
  await b.close();
})();
