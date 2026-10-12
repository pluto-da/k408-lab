#!/usr/bin/env node
/*
 * 化身数据 · 画面遮挡自动检查（ride-audit）。
 *
 * 用法（需要测试构建：RIDE_AUDIT=1 vite build --outDir <dir>，再用任意静态服务器托管该目录）：
 *   node apps/web/scripts/ride-audit.cjs [baseUrl]            # 默认 http://127.0.0.1:4180
 *
 * 环境变量：
 *   RIDE_OUT        截图与结果目录（默认 /tmp/ride-audit）
 *   RIDE_SETTLE_MS  每站等待“到站且镜头稳定”的上限毫秒数（默认 9000；软件渲染的超大视口可调大）
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
 *   6 lines      讲解正文：矮横屏至少 4 行可见，竖屏抽屉默认至少 2 行（到站出现结论卡片且讲解区放不下两者时，以 13 项为准）
 *   7 overflow / errors  无横向溢出，无 JS 报错
 *   8 contrast   界面文字对其底色的对比度 ≥ 4.5:1（大字 ≥ 3:1；禁用按钮除外）
 *   9 height     画面浮层与操作区里的按钮高度一致
 *  10 bottom     画面下半部分没有任何控件（操作全部在讲解栏 / 抽屉里）
 *  11 unique     「下一站」只有一个入口；进入后网站顶栏不显示，界面上没有亮白色大块
 *  12 void       电脑 / 平板讲解栏没有超过 40 像素的空洞（讲解区内容已全部展开时除外）
 *  13 concl      有结论的站：结论卡片到站后无需手动滚动即完整可见（不被讲解区底部、渐隐区裁掉）
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
    lines = { visible: Math.floor((visH + 2) / lh), text: Math.round(pr.height / lh), lh, room: sc.height };
  }
  // 8 对比度：文字颜色对其所在的不透明底色（逐层叠加半透明底色，最底层按页面底色 #0b0d12）
  const parse = (c) => {
    const m = /rgba?\(([^)]+)\)/.exec(c || "");
    if (!m) return null;
    const v = m[1].split(/[ ,/]+/).filter(Boolean).map(Number);
    return { r: v[0], g: v[1], b: v[2], a: v.length > 3 ? v[3] : 1 };
  };
  const lum = (c) => {
    const f = (x) => {
      x /= 255;
      return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
    };
    return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
  };
  const over = (top, bot) => ({ r: top.r * top.a + bot.r * (1 - top.a), g: top.g * top.a + bot.g * (1 - top.a), b: top.b * top.a + bot.b * (1 - top.a), a: 1 });
  const bgOf = (el) => {
    const layers = [];
    for (let e = el; e && e !== document.documentElement; e = e.parentElement) {
      const c = parse(getComputedStyle(e).backgroundColor);
      if (c && c.a > 0) layers.push(c);
      if (c && c.a >= 1) break;
    }
    let base = { r: 11, g: 13, b: 18, a: 1 };
    for (let i = layers.length - 1; i >= 0; i--) base = over(layers[i], base);
    return base;
  };
  const contrastIssues = [];
  let minContrast = 99;
  for (const el of document.querySelectorAll(".rd-root *")) {
    if (el.closest("svg, .rd-sum, .rd-card, .rd-menu")) continue;
    const own = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
    if (!own || !vis(el)) continue;
    if (el.closest("button:disabled")) continue;
    const cs = getComputedStyle(el);
    const fg = parse(cs.color);
    if (!fg) continue;
    const bg = bgOf(el);
    const fgc = fg.a < 1 ? over(fg, bg) : fg;
    const a = lum(fgc), b = lum(bg);
    const ratio = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
    const size = parseFloat(cs.fontSize);
    const large = size >= 24 || (size >= 18.66 && Number(cs.fontWeight) >= 600);
    minContrast = Math.min(minContrast, ratio);
    if (ratio < (large ? 3 : 4.5)) contrastIssues.push(`${name(el)} ${ratio.toFixed(2)}`);
  }
  // 9 按钮高度一致（画面浮层 + 操作区）
  const hs = new Set();
  for (const el of document.querySelectorAll(".rd-root .rd-tl button, .rd-root .rd-tr button, .rd-root .rd-ctl button")) {
    const r = vis(el);
    if (r) hs.add(Math.round(r.h));
  }
  // 10 画面下半部分没有控件
  const stage = document.querySelector(".rd-stage");
  const sr = stage && stage.getBoundingClientRect();
  const lowCtl = [];
  if (sr) for (const el of stage.querySelectorAll("button, a, input, select")) {
    const r = vis(el);
    if (r && r.y > sr.top + sr.height / 2) lowCtl.push(name(el));
  }
  // 11 「下一站」入口唯一；顶栏隐藏；没有亮白色大块
  let nextCount = 0;
  for (const el of document.querySelectorAll(".rd-root button")) {
    if (el.closest(".rd-card, .rd-menu, .rd-sum")) continue;
    if (!vis(el)) continue;
    const t = (el.getAttribute("aria-label") || "") + el.textContent;
    if (/下一站|到站|看小结/.test(t)) nextCount++;
  }
  const bar = document.querySelector(".app-bar");
  const barShown = !!(bar && vis(bar));
  const white = [];
  for (const el of document.querySelectorAll(".rd-root *")) {
    const c = parse(getComputedStyle(el).backgroundColor);
    if (!c || c.a < 0.5 || lum(c) < 0.5) continue;
    const r = vis(el);
    if (r && r.w * r.h > 1500) white.push(name(el));
  }
  // 12 讲解栏空洞：讲解区内容的底到操作区的顶
  let voidPx = null;
  let allOpen = true;
  const sc = document.querySelector(".rd-scroll");
  if (sc && vis(sc)) {
    const kids = [...sc.children].filter((k) => vis(k));
    const last = kids[kids.length - 1];
    if (last) {
      const pad = parseFloat(getComputedStyle(sc).paddingBottom) || 0;
      voidPx = Math.round(sc.getBoundingClientRect().bottom - pad - last.getBoundingClientRect().bottom);
    }
    const d = sc.querySelector("details");
    allOpen = !d || d.open;
  }
  // 13 结论卡片完整可见
  let concl = null;
  const cc = document.querySelector(".rd-scroll .rd-concl");
  if (cc && cc.querySelector("p") && sc && vis(sc)) {
    const r = cc.getBoundingClientRect();
    const b = sc.getBoundingClientRect();
    const fade = sc.classList.contains("is-more") ? parseFloat(getComputedStyle(sc).getPropertyValue("--rd-fade")) || 28 : 0;
    concl = { ok: r.top >= b.top - 0.5 && r.bottom <= b.bottom - fade + 0.5, top: Math.round(r.top - b.top), cut: Math.round(r.bottom - (b.bottom - fade)), h: Math.round(r.height), fade };
  }
  const overflow = document.documentElement.scrollWidth > window.innerWidth + 1;
  const layout = (document.querySelector(".rd-root")?.className.match(/rd-L--(\w+)/) || [])[1] || "?";
  return { hud, buttons: buttons.length, btnIssues, lines, overflow, layout, contrastIssues, minContrast, heights: [...hs], lowCtl, nextCount, barShown, white, voidPx, allOpen, concl };
}

const inter = (a, b) => Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
const inside = (a, b) => a.x >= b.x - 0.5 && a.y >= b.y - 0.5 && a.x + a.w <= b.x + b.w + 0.5 && a.y + a.h <= b.y + b.h + 0.5;

async function waitSettled(page, i, ms = Number(process.env.RIDE_SETTLE_MS) || 9000) {
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
          if (s.result) {
            // 等结论卡片出现，再给自动滚动留出时间
            for (let k = 0; k < 40 && !(await page.$(".rd-scroll .rd-concl p")); k++) await sleep(150);
            await sleep(700);
          }
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
            // 到站出现结论卡片、而讲解区放不下「正文 need 行 + 结论卡片」时（小屏），以结论卡片完整可见为准（13 项）：
            // 正文在到站前已从顶部完整展示，到站后讲解区自动滚到结论卡片
            const both = pc.concl ? pc.concl.h + Math.min(need, pc.lines.text) * pc.lines.lh + pc.concl.fade + 24 : 0;
            const waived = !!(pc.concl && pc.concl.ok && pc.lines.room < both);
            if (waived) row.linesWaived = true;
            else if (pc.lines.visible < Math.min(need, pc.lines.text)) fails.push(`6 正文只露 ${pc.lines.visible} 行（要 ${need}）`);
          }
          if (pc.overflow) fails.push("7 横向溢出");
          row.contrast = +pc.minContrast.toFixed(2);
          if (pc.contrastIssues.length) fails.push(`8 对比度不足：${pc.contrastIssues.slice(0, 3).join("；")}`);
          if (pc.heights.length > 1) fails.push(`9 按钮高度不一致：${pc.heights.join(" / ")}`);
          if (pc.lowCtl.length) fails.push(`10 画面下半部分有控件：${pc.lowCtl.slice(0, 3).join("；")}`);
          if (pc.nextCount !== 1) fails.push(`11 「下一站」入口 ${pc.nextCount} 个`);
          if (pc.barShown) fails.push("11 网站顶栏仍然显示");
          if (pc.white.length) fails.push(`11 亮白色大块：${pc.white.slice(0, 2).join("；")}`);
          row.void = pc.voidPx;
          if (pc.layout !== "short" && s.kind !== "bus" && pc.voidPx !== null && pc.voidPx > 40 && !pc.allOpen) fails.push(`12 讲解栏空洞 ${pc.voidPx}px`);
          row.concl = pc.concl;
          if (s.result && pc.layout !== "tall" && !pc.concl) fails.push("13 没有出现结论卡片");
          if (pc.concl && !pc.concl.ok) fails.push(`13 结论卡片被裁 ${pc.concl.cut}px（顶 ${pc.concl.top}）`);
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
