#!/usr/bin/env node
/*
 * 全站遮挡与溢出体检（site-audit）。
 *
 * 用法（先构建并用任意静态服务器托管 dist；预览环境没有后端时 /profile 用模拟登录）：
 *   node apps/web/scripts/site-audit.cjs [baseUrl]           # 默认 http://127.0.0.1:4182
 *
 * 环境变量：
 *   SITE_OUT        截图与结果目录（默认 /tmp/site-audit）
 *   SITE_VIEWPORTS  只跑部分视口，按名称或宽度匹配，逗号分隔，如 "393,1210"
 *   SITE_ROUTES     只跑部分页面，逗号分隔，如 "/,/lab"
 *   SITE_FAST       1 时只跑每个视口的“扣除浏览器栏”高度，实验室每门课只测第一个实验（日常开发用；部署前必须全跑）
 *   SITE_REAL_API   1 时不模拟 /api/me（线上实测用）
 *   PLAYWRIGHT_CORE / CHROMIUM  同 responsive-audit
 *
 * 视口：12 个尺寸 × 两种高度（实际窗口高度 / 扣除 120 像素浏览器栏）。
 * 状态：首页（含菜单打开）、实验室（初始、目录打开、每个实验的初始 / 运行中 / 完成态、每个过程图解、每条性质）、
 *       整机拆解（总览、选中部件、数据旅程、化身数据入口）、登录、注册、协议、隐私、个人中心、404。
 * 每个状态检查：
 *   overflow   页面横向溢出为 0
 *   overlap    可交互元素两两不重叠（容许 1 像素描边重合）；触控视口每个点击区 ≥ 44 × 44
 *   cover      固定 / 吸顶浮层（工具条、侧栏、抽屉、提示）不遮挡本页声明的关键元素
 *   clip       文字不被裁切：overflow 隐藏且内容超出的文字容器；关键文本出现省略号截断
 *   contrast   文字对比度 ≥ 4.5:1（大字 ≥ 3:1；禁用控件除外）
 *   font       最小字号 ≥ 12 CSS 像素
 *   errors     无 JS 异常、无 console.error、无未处理的 Promise 拒绝
 *   requests   图片、字体、模型、脚本全部加载成功（无 4xx / 5xx / 失败请求；/api 除外）
 * 结果：控制台汇总 + SITE_OUT/results.json + SITE_OUT/report.md；每个不通过的状态截一张图（问题元素描红框）。
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
  throw new Error("找不到 playwright-core：设置 PLAYWRIGHT_CORE 或 npm i -D playwright-core");
}
const { chromium } = loadPlaywright();

const BASE = (process.argv[2] || process.env.SITE_BASE || "http://127.0.0.1:4182").replace(/\/+$/, "");
const OUT = process.env.SITE_OUT || "/tmp/site-audit";
const FAST = process.env.SITE_FAST === "1";
const BAR = 120;
/** [名称, 宽, 高, 触控] */
const SIZES = [
  ["phone-360", 360, 780, true],
  ["phone-393", 393, 852, true],
  ["phone-land", 852, 393, true],
  ["fold-673", 673, 841, true],
  ["fold-884", 884, 1104, true],
  ["tablet-820", 820, 1180, true],
  ["tablet-1180", 1180, 820, true],
  ["tablet-1210", 1210, 800, true],
  ["laptop-1366", 1366, 768, false],
  ["laptop-1440", 1440, 900, false],
  ["desktop-1920", 1920, 1080, false],
  ["desktop-2560", 2560, 1440, false],
];
const VPS = [];
for (const [n, w, h, t] of SIZES) {
  if (!FAST) VPS.push([n, w, h, t]);
  VPS.push([`${n}-bar`, w, h - BAR, t]);
}
const pickVp = (process.env.SITE_VIEWPORTS || "").split(",").map((s) => s.trim()).filter(Boolean);
const vps = VPS.filter((v) => !pickVp.length || pickVp.some((p) => v[0].includes(p) || String(v[1]) === p));
const ROUTES = ["/", "/lab", "/pc", "/login", "/register", "/terms", "/privacy", "/profile", "/nope"];
const routes = process.env.SITE_ROUTES ? process.env.SITE_ROUTES.split(",").map((s) => s.trim()) : ROUTES;

/** 每个页面的关键元素（不能被浮层压住） */
const KEYS = {
  "/": ["main h1", "main .hm-cta, main .app-btn"],
  "/lab": [".x-lab__panel:not([hidden]) .x-lab__stage", ".x-lab__panel:not([hidden]) .x-lab__out", "#x-proc-body", ".x-prop__card:not([hidden]), #prop .x-card"],
  "/pc": [".pc-journey"],
  "/login": ["main form"],
  "/register": ["main form"],
  "/terms": [".legal h1", ".legal h2"],
  "/privacy": [".legal h1", ".legal h2"],
  "/profile": ["main h1"],
  "/nope": ["main h1"],
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
/** 等页面滚动停下来（打开实验 / 图解时页面会平滑滚动，滚动中检查会得到不确定的位置） */
const scrollIdle = (page) =>
  page.evaluate(
    () =>
      new Promise((res) => {
        let last = -1, same = 0, n = 0;
        const tick = () => {
          const y = scrollY;
          same = y === last ? same + 1 : 0;
          last = y;
          if (same >= 6 || ++n > 150) res(n);
          else requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      }),
  );

/** 页面内：全部检查。keys = 关键元素选择器；scope = 只检查这个容器内的元素（逐个实验时用） */
async function audit({ touch, keys, scope, skipCover }) {
  // 先等进行中的过渡动画结束（颜色渐变到一半时量对比度会得到中间色）；最多等 1.5 秒
  await Promise.race([
    Promise.all(document.getAnimations().filter((a) => typeof CSSTransition !== "undefined" && a instanceof CSSTransition).map((a) => a.finished.catch(() => undefined))),
    new Promise((r) => setTimeout(r, 1500)),
  ]);
  const W = innerWidth;
  const H = innerHeight;
  const root = (scope && document.querySelector(scope)) || document.body;
  const issues = [];
  const marks = [];
  const label = (e) => {
    const c = typeof e.className === "string" ? e.className : e.className && e.className.baseVal;
    const t = (e.textContent || "").trim().replace(/\s+/g, " ").slice(0, 14);
    return (e.tagName.toLowerCase() + (e.id ? "#" + e.id : "") + (c ? "." + String(c).trim().split(/\s+/).slice(0, 2).join(".") : "")).slice(0, 56) + (t ? ` "${t}"` : "");
  };
  const shown = (e) => {
    const r = e.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) return null;
    for (let q = e; q && q !== document.documentElement; q = q.parentElement) {
      const cs = getComputedStyle(q);
      if (cs.display === "none" || cs.visibility === "hidden" || Number(cs.opacity) < 0.05) return null;
      if (q.hidden || q.getAttribute("aria-hidden") === "true" && q !== e && q.tagName !== "svg") {
        if (q.hidden) return null;
      }
    }
    return r;
  };
  const srOnly = (e) => {
    for (let q = e; q && q !== document.body; q = q.parentElement) {
      const cs = getComputedStyle(q);
      const r = q.getBoundingClientRect();
      if ((cs.position === "absolute" || cs.position === "fixed") && r.width <= 2 && r.height <= 2) return true;
      if (cs.clip && cs.clip !== "auto" && /rect\(0/.test(cs.clip)) return true;
      if (cs.clipPath && /inset\(50%/.test(cs.clipPath)) return true;
    }
    return false;
  };
  /** 被 overflow 裁掉、在视口之外的部分不算 */
  const visRect = (e, r) => {
    let x1 = r.left, y1 = r.top, x2 = r.right, y2 = r.bottom;
    for (let q = e.parentElement; q && q !== document.body; q = q.parentElement) {
      const cs = getComputedStyle(q);
      if (/(auto|scroll|hidden|clip)/.test(cs.overflowX + cs.overflowY)) {
        const p = q.getBoundingClientRect();
        if (/(auto|scroll|hidden|clip)/.test(cs.overflowX)) { x1 = Math.max(x1, p.left); x2 = Math.min(x2, p.right); }
        if (/(auto|scroll|hidden|clip)/.test(cs.overflowY)) { y1 = Math.max(y1, p.top); y2 = Math.min(y2, p.bottom); }
      }
    }
    x1 = Math.max(x1, 0); y1 = Math.max(y1, 0); x2 = Math.min(x2, W); y2 = Math.min(y2, H);
    return x2 - x1 > 0.5 && y2 - y1 > 0.5 ? { x1, y1, x2, y2 } : null;
  };
  const add = (kind, msg, el) => {
    issues.push(`${kind}: ${msg}`);
    if (el && marks.length < 12) {
      const r = el.getBoundingClientRect();
      marks.push({ x: r.left + scrollX, y: r.top + scrollY, w: r.width, h: r.height });
    }
  };

  // ---- overflow
  const sw = Math.max(document.documentElement.scrollWidth, document.body.scrollWidth);
  if (sw > W + 1) {
    const off = [];
    for (const e of document.querySelectorAll("body *")) {
      const r = e.getBoundingClientRect();
      if (r.right > W + 1 && r.width && getComputedStyle(e).position !== "fixed" && off.length < 3) {
        let clipped = false;
        for (let q = e.parentElement; q && q !== document.body; q = q.parentElement) if (/(auto|scroll|hidden|clip)/.test(getComputedStyle(q).overflowX)) clipped = true;
        if (!clipped) off.push(e);
      }
    }
    add("overflow", `scrollWidth ${sw} > ${W}：${off.map(label).join("，")}`, off[0]);
  }

  // 贴着视口上边或下边、至少半屏宽的固定 / 吸顶条（网站顶栏、工具栏、手机底部控制条）：内容从它下面滚过是正常的
  const edgeBar = (e) => {
    for (let q = e; q && q !== document.body; q = q.parentElement) {
      const p = getComputedStyle(q).position;
      if (p !== "fixed" && p !== "sticky") continue;
      const b = q.getBoundingClientRect();
      if (b.width >= W * 0.5 && b.height < H * 0.35 && (b.top <= 1 || b.bottom >= H - 1)) return q;
    }
    return null;
  };
  // ---- 可交互元素
  const SEL = 'a[href], button, input:not([type="hidden"]), select, textarea, summary, [role="button"], [role="tab"], [role="switch"], [role="slider"]';
  const ctl = [];
  for (const e of root.querySelectorAll(SEL)) {
    if (e.closest("[inert]")) continue;
    if (touch && e.hasAttribute("data-touch-alt")) continue; // 有同等功能的 44 像素按钮可用（WCAG 2.5.8 的“等效控件”例外）
    const r = shown(e);
    if (!r || srOnly(e)) continue;
    const v = visRect(e, r);
    if (!v) continue;
    // 只看真正在最上层、能点到的元素（被弹窗遮罩盖住的不算）
    const cx = (v.x1 + v.x2) / 2, cy = (v.y1 + v.y2) / 2;
    const top = document.elementFromPoint(cx, cy);
    if (!top || !(e === top || e.contains(top) || top.contains(e) || (e.tagName === "INPUT" && top.tagName === "LABEL"))) continue;
    // 段落里的行内文字链接按正文处理
    const cs = getComputedStyle(e);
    const inline = e.tagName === "A" && cs.display === "inline" && e.parentElement && e.parentElement.textContent.trim().length > e.textContent.trim().length + 2;
    let hit = r;
    if (e.tagName === "INPUT" && /checkbox|radio|range|color/.test(e.type)) {
      const lb = e.closest("label") || (e.id && document.querySelector(`label[for="${e.id}"]`));
      if (lb) hit = lb.getBoundingClientRect();
    }
    ctl.push({ e, r, v, inline, hit });
  }
  if (touch) {
    for (const c of ctl) {
      if (c.inline) continue;
      if (c.hit.width < 43.5 || c.hit.height < 43.5) add("touch", `${label(c.e)} ${Math.round(c.hit.width)}×${Math.round(c.hit.height)} < 44`, c.e);
    }
  }
  for (let i = 0; i < ctl.length; i++) {
    for (let j = i + 1; j < ctl.length; j++) {
      const a = ctl[i], b = ctl[j];
      if (a.e.contains(b.e) || b.e.contains(a.e)) continue;
      const lbA = a.e.closest("label"), lbB = b.e.closest("label");
      if (lbA && lbA === lbB) continue;
      if (edgeBar(a.e) !== edgeBar(b.e)) continue; // 一个在吸顶 / 吸底条里，另一个从它下面滚过
      // 换行的行内链接按每一行的矩形算（整体包围盒会把两行之间的空白也算进去）
      const boxes = (c) => (c.inline ? [...c.e.getClientRects()].map((q) => ({ x1: q.left, y1: q.top, x2: q.right, y2: q.bottom })) : [c.v]);
      let ox = 0, oy = 0;
      for (const p of boxes(a))
        for (const q of boxes(b)) {
          const x = Math.min(p.x2, q.x2) - Math.max(p.x1, q.x1), y = Math.min(p.y2, q.y2) - Math.max(p.y1, q.y1);
          if (x > 1.5 && y > 1.5 && x * y > ox * oy) { ox = x; oy = y; }
        }
      if (ox > 1.5 && oy > 1.5) add("overlap", `${label(a.e)} 与 ${label(b.e)} 重叠 ${Math.round(ox)}×${Math.round(oy)}`, a.e);
    }
  }

  // ---- 浮层遮挡关键元素：关键元素滚到视口中部，取样点上最上层元素若属于固定 / 吸顶浮层即为遮挡
  const isOverlay = (e) => {
    for (let q = e; q && q !== document.body; q = q.parentElement) {
      const p = getComputedStyle(q).position;
      if (p === "fixed" || p === "sticky") return q;
    }
    return null;
  };
  if (!skipCover) {
    for (const sel of keys || []) {
      const el = [...document.querySelectorAll(sel)].find((x) => shown(x) && (!scope || root.contains(x)));
      if (!el) continue;
      const own = isOverlay(el);
      // 先把关键元素放到顶部吸顶条下方，再量出上下两条边条占掉的高度
      const edges = () => {
        let top = 0, bot = H;
        for (const e of document.querySelectorAll("body *")) {
          const p = getComputedStyle(e).position;
          if (p !== "fixed" && p !== "sticky") continue;
          if (e.contains(el)) continue;
          const b = shown(e);
          if (!b || b.width < W * 0.5 || b.height >= H * 0.35) continue;
          if (b.top <= 1) top = Math.max(top, b.bottom);
          else if (b.bottom >= H - 1) bot = Math.min(bot, b.top);
        }
        return { top, bot };
      };
      // 关键元素在吸顶容器里（如宽屏实验的侧栏）：把吸顶容器所在的块滚到顶栏下方，即用户打开该块时看到的位置
      // display: contents 的包裹层（如 .x-lab__top）没有盒子，量不出位置：往上找到真正占位的祖先
      let anchor = own ? own.parentElement : el;
      while (anchor && anchor !== document.body && getComputedStyle(anchor).display === "contents") anchor = anchor.parentElement;
      if (anchor) {
        const e0 = edges();
        document.documentElement.style.scrollBehavior = "auto"; // 页面设置了平滑滚动：检查时要立即到位
        window.scrollTo({ top: scrollY + anchor.getBoundingClientRect().top - e0.top - 4, behavior: "instant" });
        await new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(res)));
      }
      const r = el.getBoundingClientRect();
      const ed = edges();
      const fits = r.height <= ed.bot - ed.top - 4;
      // 放得下时整块都要露出来（边条也不能压）；放不下时只看两条边条之间的部分
      const y1 = Math.max(r.top, fits ? 0 : ed.top, 0), y2 = Math.min(r.bottom, fits ? H : ed.bot, H);
      const x1 = Math.max(r.left, 0), x2 = Math.min(r.right, W);
      if (y2 - y1 < 4 || x2 - x1 < 4) continue;
      let hits = 0, n = 0, by = null;
      for (let iy = 0; iy < 6; iy++)
        for (let ix = 0; ix < 6; ix++) {
          const x = x1 + ((ix + 0.5) / 6) * (x2 - x1), y = y1 + ((iy + 0.5) / 6) * (y2 - y1);
          const t = document.elementFromPoint(x, y);
          n++;
          if (!t || el.contains(t) || t.contains(el)) continue;
          const ov = isOverlay(t);
          if (ov && ov !== own && !ov.contains(el)) { hits++; by = ov; }
        }
      if (hits) add("cover", `${sel} 有 ${hits}/${n} 个取样点被 ${label(by)} 压住`, by);
    }
  }

  // ---- 文字：裁切、省略号、字号、对比度
  const parse = (c) => {
    const m = /rgba?\(([^)]+)\)/.exec(c || "");
    if (!m) return null;
    const v = m[1].split(/[ ,/]+/).filter(Boolean).map(Number);
    return { r: v[0], g: v[1], b: v[2], a: v.length > 3 ? v[3] : 1 };
  };
  const lum = (c) => {
    const f = (x) => ((x /= 255) <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4));
    return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
  };
  const over = (t, b) => ({ r: t.r * t.a + b.r * (1 - t.a), g: t.g * t.a + b.g * (1 - t.a), b: t.b * t.a + b.b * (1 - t.a), a: 1 });
  const pageBg = parse(getComputedStyle(document.body).backgroundColor) || { r: 255, g: 255, b: 255, a: 1 };
  const base0 = pageBg.a >= 1 ? pageBg : parse(getComputedStyle(document.documentElement).backgroundColor) || { r: 255, g: 255, b: 255, a: 1 };
  const bgOf = (el) => {
    const layers = [];
    for (let e = el; e && e !== document.documentElement; e = e.parentElement) {
      const cs = getComputedStyle(e);
      if (cs.backgroundImage && cs.backgroundImage !== "none" && !/gradient/.test(cs.backgroundImage)) return null; // 图片底：无法判定
      const c = parse(cs.backgroundColor);
      if (c && c.a > 0) layers.push(c);
      if (c && c.a >= 1) break;
      if (e.tagName === "CANVAS" || (e.parentElement && e.parentElement.querySelector(":scope > canvas") && cs.position !== "static" && !(c && c.a >= 1))) {
        /* 叠在画布上的浮层，若自身没有不透明底色，底色无法判定 */
      }
    }
    let b = layers.length && layers[layers.length - 1].a >= 1 ? null : base0;
    if (!b) b = layers.pop();
    for (let i = layers.length - 1; i >= 0; i--) b = over(layers[i], b);
    return b;
  };
  let minFont = 99, minContrast = 99, clipN = 0, fontN = 0, conN = 0;
  for (const e of root.querySelectorAll("*")) {
    if (e.closest("svg, canvas, script, style, noscript")) continue;
    const own = [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
    if (!own) continue;
    const r = shown(e);
    if (!r || srOnly(e)) continue;
    const v = visRect(e, r);
    if (!v) continue;
    const cs = getComputedStyle(e);
    const fs = parseFloat(cs.fontSize);
    if (fs < 1) continue; // font-size: 0 的文字不显示（只作无障碍名称）
    minFont = Math.min(minFont, fs);
    if (fs < 11.95 && fontN++ < 6) add("font", `${label(e)} ${fs}px`, e);
    // 对比度
    if (!e.closest("button:disabled, [aria-disabled='true'], input:disabled, select:disabled, option")) {
      const fg = parse(cs.color);
      const bg = bgOf(e);
      if (fg && bg) {
        const f = fg.a < 1 ? over(fg, bg) : fg;
        const a = lum(f), b = lum(bg);
        const ratio = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
        const ownText = [...e.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join("").trim();
        // 纯符号（星级、圆点、箭头）按图形对比度 3:1
        const glyph = /^[★☆●○◆◇▲△▼▽►◄→←↑↓·•✓✕×]+$/u.test(ownText);
        const large = glyph || fs >= 24 || (fs >= 18.66 && Number(cs.fontWeight) >= 600);
        minContrast = Math.min(minContrast, ratio);
        if (ratio < (large ? 3 : 4.5) - 0.01 && conN++ < 6) add("contrast", `${label(e)} ${ratio.toFixed(2)}:1`, e);
      }
    }
  }
  // 裁切：任何 overflow 隐藏 / clip 的块，文字内容超出它自身
  for (const e of root.querySelectorAll("*")) {
    if (e.closest("svg, canvas")) continue;
    const r = shown(e);
    if (!r || srOnly(e) || !visRect(e, r)) continue;
    const cs = getComputedStyle(e);
    const hidX = /(hidden|clip)/.test(cs.overflowX), hidY = /(hidden|clip)/.test(cs.overflowY);
    if (!hidX && !hidY) continue;
    if (!(e.textContent || "").trim()) continue;
    // 只看直接包含文字（或只含行内元素）的容器
    const textual = [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()) || [...e.children].every((c) => /^(inline|inline-block|contents)$/.test(getComputedStyle(c).display));
    if (!textual) continue;
    const clampY = hidY && e.scrollHeight > e.clientHeight + 2;
    const clampX = hidX && e.scrollWidth > e.clientWidth + 2;
    if ((clampY || clampX) && clipN++ < 6) add("clip", `${label(e)} ${clampX ? `宽 ${e.scrollWidth}>${e.clientWidth}` : ""}${clampY ? `高 ${e.scrollHeight}>${e.clientHeight}` : ""}${cs.textOverflow === "ellipsis" ? "（省略号）" : ""}`, e);
  }
  return { issues, marks, minFont: minFont === 99 ? null : minFont, minContrast: minContrast === 99 ? null : +minContrast.toFixed(2) };
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM || "/usr/bin/chromium",
    args: ["--no-sandbox", "--no-proxy-server", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
  });
  const results = [];
  let failStates = 0;
  let shotN = 0;
  for (const [vname, w, h, touch] of vps) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, hasTouch: touch, isMobile: touch && Math.min(w, h) < 600 });
    if (process.env.SITE_REAL_API !== "1") {
      await ctx.route("**/api/me", (rt) =>
        rt.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ user: { id: "audit", username: "audit_user", email: "audit@example.com", nickname: "测试同学", createdAt: "2026-10-01T00:00:00.000Z" } }) }),
      );
    }
    const vrow = { name: vname, w, h, touch, states: [] };
    for (const r of routes) {
      const page = await ctx.newPage();
      const errors = [];
      const bad = [];
      page.on("pageerror", (e) => errors.push("pageerror: " + String(e.message || e).slice(0, 160)));
      page.on("console", (m) => {
        if (m.type() !== "error") return;
        const t = m.text();
        if (/Failed to load resource/.test(t)) return; // 由 requests 检查统计
        if (/WebGL|GPU stall|swiftshader|GL_|ReadPixels/i.test(t)) return; // 软件渲染噪声
        if (/Cross-Origin-Opener-Policy header has been ignored|origin was untrustworthy/i.test(t)) return; // 未上 HTTPS 时浏览器忽略 COOP 的提示
        errors.push("console: " + t.slice(0, 160));
      });
      page.on("response", (res) => {
        const u = res.url();
        if (res.status() >= 400 && !/\/api\//.test(u) && !(r === "/nope" && res.request().resourceType() === "document")) bad.push(`${res.status()} ${u.replace(BASE, "")}`);
      });
      page.on("requestfailed", (q) => {
        const u = q.url();
        if (/\/api\//.test(u) || /ERR_ABORTED/.test(q.failure()?.errorText || "")) return;
        bad.push(`失败 ${u.replace(BASE, "")} ${q.failure()?.errorText || ""}`);
      });
      const keys = KEYS[r] || [];
      const run = async (state, opts = {}) => {
        const o = await page.evaluate(audit, { touch, keys: opts.keys || keys, scope: opts.scope || null, skipCover: !!opts.skipCover });
        const issues = [...o.issues];
        if (errors.length) issues.push(...errors.splice(0).map((e) => "errors: " + e));
        if (bad.length) issues.push(...bad.splice(0).map((e) => "requests: " + e));
        const row = { route: r, state, issues, minFont: o.minFont, minContrast: o.minContrast };
        if (issues.length) {
          failStates++;
          if (shotN < 400) {
            const f = path.join(OUT, `${vname}${r.replace(/\//g, "_") || "_"}-${state.replace(/[^\w-]+/g, "_")}.png`);
            await page.evaluate((ms) => {
              for (const m of ms) {
                const d = document.createElement("div");
                d.className = "__audit_mark";
                Object.assign(d.style, { position: "absolute", left: m.x + "px", top: m.y + "px", width: m.w + "px", height: m.h + "px", outline: "2px solid #f00", zIndex: 2147483647, pointerEvents: "none" });
                document.body.appendChild(d);
              }
            }, o.marks);
            await page.screenshot({ path: f }).catch(() => {});
            await page.evaluate(() => document.querySelectorAll(".__audit_mark").forEach((d) => d.remove()));
            row.shot = f;
            shotN++;
          }
        }
        vrow.states.push(row);
        return row;
      };
      try {
        await page.goto(BASE + (r === "/pc" ? "/pc?dpr=1" : r), { waitUntil: "domcontentloaded", timeout: 45000 });
        await sleep(600);
        if (r === "/") {
          await page.waitForSelector("main h1", { timeout: 15000 });
          await run("initial");
          const menu = await page.$(".app-menu");
          if (menu && (await menu.isVisible())) {
            await menu.click();
            await sleep(350);
            await run("menu-open", { keys: [] });
          }
          await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
          await sleep(300);
          await run("bottom", { keys: [] });
        } else if (r === "/lab") {
          await page.waitForSelector(".lab-loading", { state: "detached", timeout: 60000 }).catch(() => undefined);
          await page.waitForFunction(() => window.X_LAB_ACT && window.X_OPEN_LAB, null, { timeout: 60000 });
          await sleep(500);
          await run("initial", { keys: [] });
          if (w < 1024) {
            const opened = await page.evaluate(() => {
              const b = document.querySelector("#x-toc-btn, .x-tocbtn, [aria-controls='x-toc']");
              if (b) { b.click(); return true; }
              return false;
            });
            if (opened) {
              await sleep(400);
              await run("toc-open", { keys: [] });
              await page.keyboard.press("Escape");
              await page.evaluate(() => document.getElementById("x-toc")?.classList.remove("is-open"));
              await sleep(300);
            }
          }
          const lists = await page.evaluate(() => {
            const ids = (attr) => [...new Set([...document.querySelectorAll("#x-toc a[" + attr + "]")].map((a) => a.getAttribute(attr)))];
            return { lab: ids("data-lab"), proc: ids("data-proc"), prop: ids("data-prop") };
          });
          let labs = lists.lab;
          if (FAST) {
            const seen = new Set();
            labs = labs.filter((id) => {
              const k = id.split("-")[0];
              if (seen.has(k)) return false;
              seen.add(k);
              return true;
            });
          }
          for (const id of labs) {
            await page.evaluate((x) => window.X_OPEN_LAB(x), id);
            await sleep(250);
            await scrollIdle(page);
            const scope = ".x-lab__panel:not([hidden])";
            const LK = [".x-lab__panel:not([hidden]) .x-lab__stage", ".x-lab__panel:not([hidden]) .x-lab__out"];
            await run(`lab:${id}:init`, { scope, keys: LK });
            const steps = await page.evaluate(() => {
              window.X_LAB_ACT("reset");
              const hb = [...document.querySelectorAll(".x-lab__panel")].find((x) => !x.hidden)?.querySelector(".x-lab__hint");
              let n = 0;
              while (n < 600 && !(hb && /最后一步/.test(hb.textContent))) {
                window.X_LAB_ACT("step");
                n++;
              }
              window.X_LAB_ACT("reset");
              for (let i = 0; i < Math.max(1, Math.floor(n / 2)); i++) window.X_LAB_ACT("step");
              return n;
            });
            await sleep(200);
            await run(`lab:${id}:run`, { scope, keys: LK });
            await page.evaluate((n) => { for (let i = 0; i < n; i++) window.X_LAB_ACT("step"); }, steps);
            await sleep(200);
            await run(`lab:${id}:done`, { scope, keys: LK });
            await page.evaluate(() => window.X_LAB_ACT("reset"));
          }
          for (const id of FAST ? lists.proc.slice(0, 2) : lists.proc) {
            await page.evaluate((x) => { window.X_OPEN_PROC(x); document.getElementById("proc")?.scrollIntoView(); }, id);
            await sleep(200);
            await scrollIdle(page);
            await run(`proc:${id}`, { scope: "#proc", keys: ["#x-proc-body"] });
          }
          for (const id of FAST ? lists.prop.slice(0, 2) : lists.prop) {
            await page.evaluate((x) => window.X_OPEN_PROP(x, true), id);
            await sleep(200);
            await scrollIdle(page);
            await run(`prop:${id}`, { scope: "#prop", keys: [] });
          }
        } else if (r === "/pc") {
          await page.waitForFunction(() => document.querySelector(".pc-btn--tour:not([disabled])"), null, { timeout: 120000 });
          await sleep(1500);
          await run("overview", { keys: [] });
          const part = await page.$(".pc-parts button");
          if (part && (await part.isVisible())) {
            await part.click();
            await sleep(2500);
            await run("part-open", { keys: [] });
            const back = await page.$(".pc-btn--back:not([disabled])");
            if (back) await back.click();
            await page.waitForFunction(() => document.querySelector(".pc-btn--tour:not([disabled])"), null, { timeout: 30000 }).catch(() => undefined);
            await sleep(1500);
          }
          const tours = await page.$$(".pc-btn--tour");
          if (tours[0]) {
            await tours[0].click();
            await page.waitForSelector(".pc-journey", { timeout: 20000 }).catch(() => undefined);
            await sleep(2500);
            await run("journey", { keys: [".pc-journey"] });
            await page.keyboard.press("Escape");
            await sleep(500);
          }
          await page.goto(BASE + "/pc?ride=access&dpr=1", { waitUntil: "domcontentloaded" });
          await page.waitForSelector(".rd-panel", { timeout: 120000 }).catch(() => undefined);
          await sleep(6000);
          await run("ride", { keys: [] });
        } else {
          await page.waitForSelector("main", { timeout: 15000 });
          await sleep(400);
          await run("initial");
          if (r === "/terms" || r === "/privacy") {
            await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
            await sleep(300);
            await run("bottom", { keys: [] });
          }
        }
      } catch (e) {
        failStates++;
        vrow.states.push({ route: r, state: "script", issues: ["script: " + String(e.message).slice(0, 200)] });
        await page.screenshot({ path: path.join(OUT, `${vname}${r.replace(/\//g, "_")}-script.png`) }).catch(() => {});
      }
      await page.close();
    }
    const nBad = vrow.states.filter((s) => s.issues.length).length;
    console.log(`${vname} ${w}×${h}  ${vrow.states.length - nBad}/${vrow.states.length} 通过`);
    for (const s of vrow.states) if (s.issues.length) console.log(`   ✗ ${s.route} ${s.state}: ${s.issues.slice(0, 4).join("；")}${s.issues.length > 4 ? ` 等 ${s.issues.length} 项` : ""}`);
    results.push(vrow);
    fs.writeFileSync(path.join(OUT, `results-${vname}.json`), JSON.stringify(vrow, null, 2));
    await ctx.close();
  }
  fs.writeFileSync(path.join(OUT, "results.json"), JSON.stringify(results, null, 2));
  const md = ["# site-audit", "", `基址 ${BASE}，${results.length} 个视口，不通过的状态 ${failStates} 个`, ""];
  for (const v of results) {
    md.push(`## ${v.name} ${v.w}×${v.h}`);
    for (const s of v.states) md.push(`- ${s.issues.length ? "✗" : "✓"} ${s.route} ${s.state}${s.issues.length ? "：" + s.issues.join("；") : ""}`);
    md.push("");
  }
  fs.writeFileSync(path.join(OUT, "report.md"), md.join("\n"));
  await browser.close();
  console.log(failStates ? `不通过：${failStates} 个状态` : "全部通过");
  process.exit(failStates ? 1 : 0);
})();
