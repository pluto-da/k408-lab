#!/usr/bin/env node
/*
 * 化身数据 · 画面遮挡自动检查（ride-audit）。
 *
 * 用法（需要测试构建：RIDE_AUDIT=1 vite build --outDir <dir>，再用任意静态服务器托管该目录）：
 *   node apps/web/scripts/ride-audit.cjs [baseUrl]            # 默认 http://127.0.0.1:4180
 *
 * 环境变量：
 *   RIDE_OUT        截图与结果目录（默认 /tmp/ride-audit）
 *   RIDE_VIEWPORTS  只跑部分视口，按名称匹配，逗号分隔，如 "tablet-land,phone-393"
 *   RIDE_VARIANTS   default,fault（默认两条都跑）
 *   RIDE_SHOTS      key（默认：每个视口第 2 站 TLB、L1 站、页表站、结算卡）| all（每站都截）| none
 *   PLAYWRIGHT_CORE / CHROMIUM  同 responsive-audit
 *
 * 视口按「模拟浏览器栏占用」测：实际窗口高度再扣 120 像素。
 * 对路线一默认参数与「缺页」变体的每一站检查：
 *   1 focus∩hud  焦点对象投影包围盒与可见界面元素（讲解栏、控制条、按钮组、位置条等）的交集为 0
 *   2 focus      焦点完全在观察窗口内，面积 ≥ 观察窗口的 25%
 *   3 font       焦点文字板上最小字的屏幕字号 ≥ 12 CSS 像素
 *   4 buttons    可见按钮两两不相交、间距 ≥ 8；触控视口每个 ≥ 44 × 44
 *   5 labels     画面标签两两不相交
 *   6 lines      讲解正文：矮横屏至少 4 行可见，竖屏抽屉默认至少 2 行
 *   7 overflow / errors  无横向溢出，无 JS 报错
 * 检查接口 window.__ride 只在测试构建里存在；生产构建中没有。
 * 退出码：有任何一项不通过时为 1。
 */
const fs = require("node:fs");
const path = require("node:path");

function loadPlaywright() {
  for (const c of [process.env.PLAYWRIGHT_CORE, "/workspace/work/pw/node_modules/playwright-core", "playwright-core", "playwright"].filter(Boolean)) {
    try {
      return require(c);
    } catch {
      /* 下一个 */
    }
  }
  throw new Error("找不到 playwright-core");
}
const { chromium } = loadPlaywright();

const BASE = process.argv[2] || "http://127.0.0.1:4180";
const OUT = process.env.RIDE_OUT || "/tmp/ride-audit";
const SHOTS = process.env.RIDE_SHOTS || "key";
const BAR = 120;
const ALL = [
  ["phone-360", 360, 780, true],
  ["phone-393", 393, 852, true],
  ["phone-land-852", 852, 393, true],
  ["phone-land-780", 780, 360, true],
  ["fold-673", 673, 841, true],
  ["fold-884", 884, 1104, true],
  ["tablet-portrait", 820, 1180, true],
  ["tablet-land", 1210, 800, true],
  ["tablet-land-1180", 1180, 820, true],
  ["laptop-1366", 1366, 768, false],
  ["laptop-1440", 1440, 900, false],
  ["desktop-1920", 1920, 1080, false],
  ["desktop-2560", 2560, 1440, false],
];
const ONLY = (process.env.RIDE_VIEWPORTS || "").split(",").filter(Boolean);
const VPS = ALL.filter((v) => !ONLY.length || ONLY.includes(v[0]));
const VARIANTS = (process.env.RIDE_VARIANTS || "default,fault").split(",").filter(Boolean);
const PATCH = { default: null, fault: { tlbHit: false, resident: false, outcome: "mem" } };
const SHOT_IDS = { tlb: "tlb", l1: "l1", ptTbl: "pt" };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
fs.mkdirSync(OUT, { recursive: true });

/** 页面内：读界面元素与按钮，做 1、4、6、7 项 */
function pageChecks({ touch }) {
  const vis = (el) => {
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height) return null;
    for (let e = el; e && e !== document.body; e = e.parentElement) {
      const cs = getComputedStyle(e);
      if (cs.visibility === "hidden" || cs.display === "none" || Number(cs.opacity) === 0) return null;
    }
    return { x: r.left, y: r.top, w: r.width, h: r.height };
  };
  const name = (el) => `${el.tagName.toLowerCase()}.${String(el.className).split(" ").filter(Boolean).join(".")}${el.textContent ? ` "${el.textContent.trim().slice(0, 12)}"` : ""}`;
  const hud = [];
  for (const el of document.querySelectorAll(".rd-root .rd-ov, .rd-root .rd-panel, .rd-root .rd-ctl, .rd-root .rd-strip")) {
    const r = vis(el);
    if (r) hud.push({ name: name(el), r });
  }
  const buttons = [];
  for (const el of document.querySelectorAll(".rd-root button")) {
    if (el.closest(".rd-card, .rd-menu, .rd-sum")) continue;
    const r = vis(el);
    if (!r) continue;
    // 可滚动容器里被裁掉的按钮不算
    let clipped = false;
    for (let p = el.parentElement; p && !p.classList.contains("rd-root"); p = p.parentElement) {
      const o = getComputedStyle(p).overflowY;
      if (o === "auto" || o === "scroll" || o === "hidden") {
        const pr = p.getBoundingClientRect();
        if (r.y + r.h > pr.bottom + 1 || r.y < pr.top - 1) clipped = true;
      }
    }
    if (!clipped) buttons.push({ name: name(el), r });
  }
  const btnIssues = [];
  for (let i = 0; i < buttons.length; i++) {
    const a = buttons[i];
    if (touch && (a.r.w < 43.5 || a.r.h < 43.5)) btnIssues.push(`小于 44：${a.name} ${Math.round(a.r.w)}×${Math.round(a.r.h)}`);
    for (let j = i + 1; j < buttons.length; j++) {
      const b = buttons[j];
      const gx = Math.max(b.r.x - (a.r.x + a.r.w), a.r.x - (b.r.x + b.r.w));
      const gy = Math.max(b.r.y - (a.r.y + a.r.h), a.r.y - (b.r.y + b.r.h));
      const gap = Math.max(gx, gy);
      if (gap < 7.5) btnIssues.push(`间距 ${gap.toFixed(1)}：${a.name} / ${b.name}`);
    }
  }
  let lines = null;
  const body = document.querySelector(".rd-body");
  const p = body && body.querySelector("p");
  if (body && p && vis(body)) {
    const lh = parseFloat(getComputedStyle(p).lineHeight) || 20;
    const pr = p.getBoundingClientRect();
    const sc = (body.parentElement && body.parentElement.classList.contains("rd-scroll") ? body.parentElement : body).getBoundingClientRect();
    const visH = Math.max(0, Math.min(sc.bottom, pr.bottom) - Math.max(sc.top, pr.top));
    lines = { visible: Math.floor((visH + 2) / lh), text: Math.round(pr.height / lh) };
  }
  const overflow = document.documentElement.scrollWidth > window.innerWidth + 1;
  const layout = (document.querySelector(".rd-root")?.className.match(/rd-L--(\w+)/) || [])[1] || "?";
  return { hud, buttons: buttons.length, btnIssues, lines, overflow, layout };
}

const inter = (a, b) => Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
const inside = (a, b) => a.x >= b.x - 0.5 && a.y >= b.y - 0.5 && a.x + a.w <= b.x + b.w + 0.5 && a.y + a.h <= b.y + b.h + 0.5;

async function waitSettled(page, i, ms = 9000) {
  const t0 = Date.now();
  let pr = null;
  while (Date.now() - t0 < ms) {
    pr = await page.evaluate(() => window.__ride && window.__ride.probe());
    if (pr && pr.station === i && pr.arrived && pr.settled) return pr;
    await sleep(150);
  }
  return pr;
}

(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM || "/usr/bin/chromium",
    args: ["--no-sandbox", "--no-proxy-server", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
  });
  const results = [];
  let failed = 0;
  for (const [vname, w, h0, touch] of VPS) {
    const h = h0 - BAR;
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, hasTouch: touch, isMobile: touch && Math.min(w, h0) < 900 });
    const page = await ctx.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
    page.on("console", (m) => {
      if (m.type() === "error" && !/api|favicon|Failed to load resource/i.test(m.text())) errors.push("console: " + m.text());
    });
    const vres = { name: vname, w, h, touch, variants: {}, errors };
    try {
      await page.goto(`${BASE}/pc?ride=access&dpr=1`, { waitUntil: "domcontentloaded" });
      await page.waitForFunction(() => window.__ride && document.querySelector(".rd-panel"), null, { timeout: 90000 });
      await sleep(7000); // 等提示条淡出、俯冲进 CPU 结束
      for (const variant of VARIANTS) {
        if (PATCH[variant]) {
          await page.evaluate((p) => window.__ride.start(p), PATCH[variant]);
          await sleep(1500);
        }
        const stations = await page.evaluate(() => window.__ride.stations());
        const rows = [];
        for (let i = 0; i < stations.length; i++) {
          const s = stations[i];
          // 不停靠的站（总线）：先暂停，免得自动巡航直接开走
          await page.evaluate((v) => window.__ride.pause(v), s.kind === "bus");
          await sleep(120);
          await page.evaluate((k) => window.__ride.goTo(k), i);
          await sleep(300);
          const pr = await waitSettled(page, i);
          const shotKey = SHOT_IDS[s.id] || (s.kind === "pt" && s.id !== "ptDir" ? "pt" : null);
          const wantShot = SHOTS === "all" || (SHOTS === "key" && variant === "default" && shotKey);
          if (wantShot || s.kind === "tlb" || s.kind === "cache") await sleep(2400); // 本站动画播完
          const pc = await page.evaluate(pageChecks, { touch });
          const fails = [];
          const pr2 = (await page.evaluate(() => window.__ride.probe())) || pr;
          const row = { i: i + 1, id: s.id, layout: pc.layout, compact: pr2 && pr2.compact, fails };
          if (!pr2 || !pr2.arrived) fails.push("未到站");
          const hasFocus = s.kind !== "bus";
          if (hasFocus && pr2) {
            if (!pr2.focus) fails.push("没有焦点矩形");
            else {
              const f = pr2.focus;
              const hits = pc.hud.filter((x) => inter(f, x.r) > 0.5).map((x) => `${x.name}(${Math.round(inter(f, x.r))}px²)`);
              if (hits.length) fails.push(`1 焦点被界面压住：${hits.join("，")}`);
              const area = (f.w * f.h) / (pr2.view.w * pr2.view.h);
              row.area = +area.toFixed(3);
              if (!inside(f, pr2.view)) fails.push("2 焦点出了观察窗口");
              if (area < 0.25) fails.push(`2 焦点面积 ${(area * 100).toFixed(0)}% < 25%`);
            }
            row.font = pr2.minFontPx === null ? null : +pr2.minFontPx.toFixed(1);
            if (process.env.RIDE_DEBUG && (pr2.minFontPx === null || pr2.minFontPx < 12)) {
              await sleep(1500);
              const again = await page.evaluate(() => window.__ride.probe());
              console.log("   [debug]", s.id, JSON.stringify({ first: pr2, again }));
            }
            if (pr2.minFontPx === null || pr2.minFontPx < 11.95) fails.push(`3 最小字 ${row.font}px < 12`);
            row.occluded = +pr2.occluded.toFixed(2);
            row.faded = pr2.faded;
          }
          if (pc.btnIssues.length) fails.push(`4 按钮：${pc.btnIssues.slice(0, 4).join("；")}`);
          const labs = (pr2 && pr2.labels) || [];
          for (let a = 0; a < labs.length; a++)
            for (let b = a + 1; b < labs.length; b++) if (inter(labs[a].rect, labs[b].rect) > 0.5) fails.push(`5 标签相交：${labs[a].text} / ${labs[b].text}`);
          row.labels = labs.length;
          if (pc.lines && s.kind !== "bus") {
            row.lines = pc.lines.visible;
            const need = pc.layout === "short" ? 4 : pc.layout === "tall" ? 2 : 3;
            if (pc.lines.visible < Math.min(need, pc.lines.text)) fails.push(`6 正文只露 ${pc.lines.visible} 行（要 ${need}）`);
          }
          if (pc.overflow) fails.push("7 横向溢出");
          if (wantShot) {
            const f = path.join(OUT, SHOTS === "all" ? `${vname}-${variant}-${String(i + 1).padStart(2, "0")}-${s.id}.png` : `${vname}-${shotKey}.png`);
            await page.screenshot({ path: f });
            row.shot = f;
          }
          rows.push(row);
        }
        // 结算卡
        if (variant === "default") {
          await page.evaluate((k) => window.__ride.goTo(k), stations.length - 1);
          await sleep(800);
          for (let k = 0; k < 6 && !(await page.$(".rd-sum")); k++) {
            const b = await page.$(".rd-next:not([disabled])");
            if (b) await b.click();
            await sleep(700);
          }
          const sum = await page.evaluate(() => {
            const c = document.querySelector(".rd-sum__card");
            if (!c) return null;
            const r = c.getBoundingClientRect();
            const foot = c.querySelector(".rd-sum__foot");
            return { fits: r.bottom <= window.innerHeight + 1 && r.top >= -1, scrolls: c.scrollHeight > c.clientHeight + 1 ? getComputedStyle(c).overflowY : "none", foot: !!foot };
          });
          const fails = [];
          if (!sum) fails.push("没有出现结算卡");
          else if (!sum.fits) fails.push("结算卡超出窗口");
          rows.push({ i: "sum", id: "summary", fails, sum });
          if (SHOTS !== "none") await page.screenshot({ path: path.join(OUT, `${vname}-summary.png`) });
          await page.evaluate(() => document.querySelector(".rd-sum .rd-x")?.click());
          await sleep(300);
        }
        vres.variants[variant] = rows;
      }
    } catch (e) {
      errors.push("script: " + e.message);
      await page.screenshot({ path: path.join(OUT, `${vname}-fail.png`) }).catch(() => {});
    }
    const nFail = Object.values(vres.variants).flat().filter((r) => r.fails.length).length + (errors.length ? 1 : 0);
    vres.failCount = nFail;
    failed += nFail;
    results.push(vres);
    const line = Object.entries(vres.variants)
      .map(([k, rows]) => `${k}: ${rows.filter((r) => !r.fails.length).length}/${rows.length}`)
      .join("  ");
    console.log(`${vname} ${w}×${h} ${line}${errors.length ? "  errors: " + errors.slice(0, 2).join(" | ") : ""}`);
    for (const rows of Object.values(vres.variants)) for (const r of rows) if (r.fails.length) console.log(`   ✗ ${r.i} ${r.id}: ${r.fails.join("；")}`);
    fs.writeFileSync(path.join(OUT, `results-${vname}.json`), JSON.stringify(vres, null, 2));
    await ctx.close();
  }
  fs.writeFileSync(path.join(OUT, "results.json"), JSON.stringify(results, null, 2));
  await browser.close();
  console.log(failed ? `不通过：${failed} 项` : "全部通过");
  process.exit(failed ? 1 : 0);
})();
