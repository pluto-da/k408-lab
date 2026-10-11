#!/usr/bin/env node
/*
 * 多设备适配回归审计（Prompt 第三节矩阵 × 全部页面）。
 *
 * 用法：
 *   node apps/web/scripts/responsive-audit.cjs [baseUrl]        # 默认 http://127.0.0.1:4174（先 vite preview）
 *
 * 环境变量：
 *   AUDIT_OUT        截图与结果目录（默认 /tmp/rwd-audit）
 *   AUDIT_ROUTES     只跑部分页面，逗号分隔，如 "/,/pc"
 *   AUDIT_VIEWPORTS  只跑部分视口，按名称或宽度匹配，逗号分隔，如 "320,1920,横屏手机"
 *   AUDIT_BASELINE   上一次的 results.json；给出时逐项对比，列出变差的项
 *   AUDIT_SHOTS      all（默认，每页都截图）| key（只截 / /lab /pc）| none
 *   PLAYWRIGHT_CORE  playwright-core 路径（默认 /workspace/work/pw/node_modules/playwright-core，再退回 require("playwright-core")）
 *   CHROMIUM         浏览器可执行文件（默认 /usr/bin/chromium）
 *
 * 每个视口 × 页面检查：
 *   overflow   页面整体是否横向溢出（scrollWidth > innerWidth），以及造成溢出的元素
 *   tiny       字号 < 12px 的文字节点数量
 *   small      触控视口下宽或高 < 40px 的可点元素数量（段落里的行内文字链接除外）
 *   content    主要内容区宽度 / 视口宽度
 *   line       正文段落每行约多少个汉字（宽度 / 字号），取最大值
 *   scene      /pc：3D 场景未被顶部、底部控件遮挡的高度占视口高度的比例
 *   errors     页面 JS 异常与 console.error（忽略预览环境下 /api 请求失败）
 * 结果：控制台表格 + AUDIT_OUT/results.json + AUDIT_OUT/report.md + 截图。
 * 退出码：有横向溢出或 JS 异常时为 1。
 */
const fs = require("node:fs");
const path = require("node:path");

function loadPlaywright() {
  const cands = [process.env.PLAYWRIGHT_CORE, "/workspace/work/pw/node_modules/playwright-core", "playwright-core", "playwright"].filter(Boolean);
  for (const c of cands) {
    try {
      return require(c);
    } catch {
      /* try next */
    }
  }
  throw new Error("找不到 playwright-core：设置 PLAYWRIGHT_CORE 或 npm i -D playwright-core");
}
const { chromium } = loadPlaywright();

const BASE = (process.argv[2] || process.env.AUDIT_BASE || "http://127.0.0.1:4174").replace(/\/+$/, "");
const OUT = process.env.AUDIT_OUT || "/tmp/rwd-audit";
const SHOTS = process.env.AUDIT_SHOTS || "all";

/** [名称, 宽, 高, 触控] —— 与 Prompt 第三节一致 */
const VIEWPORTS = [
  ["iPhone SE", 320, 568, true],
  ["小屏安卓", 360, 740, true],
  ["iPhone 15", 393, 852, true],
  ["主流手机", 390, 844, true],
  ["Pro Max", 430, 932, true],
  ["Fold 外屏", 344, 882, true],
  ["横屏手机", 852, 393, true],
  ["Fold 内屏", 673, 841, true],
  ["iPad mini", 744, 1133, true],
  ["iPad 竖", 820, 1180, true],
  ["iPad Pro 竖", 1024, 1366, true],
  ["安卓平板横", 1280, 800, true],
  ["iPad Pro 横", 1366, 1024, true],
  ["笔记本", 1366, 768, false],
  ["MacBook", 1440, 900, false],
  ["1080p", 1920, 1080, false],
  ["2K", 2560, 1440, false],
];
const ROUTES = ["/", "/lab", "/pc", "/login", "/register", "/terms", "/privacy", "/nope"];

function pick(list, env, key) {
  if (!env) return list;
  const want = env.split(",").map((s) => s.trim()).filter(Boolean);
  return list.filter((x) => want.some((w) => key(x).includes(w)));
}
const vps = pick(VIEWPORTS, process.env.AUDIT_VIEWPORTS, (v) => `${v[0]}|${v[1]}x${v[2]}|${v[1]}`);
const routes = process.env.AUDIT_ROUTES ? process.env.AUDIT_ROUTES.split(",").map((s) => s.trim()) : ROUTES;

/** 在页面里执行的测量函数 */
function measure({ touch }) {
  const W = innerWidth;
  const H = innerHeight;
  const de = document.documentElement;
  const sw = Math.max(de.scrollWidth, document.body ? document.body.scrollWidth : 0);
  const visible = (e, rc) => {
    if (!rc.width || !rc.height) return false;
    const cs = getComputedStyle(e);
    return cs.visibility !== "hidden" && cs.display !== "none" && Number(cs.opacity) > 0.05;
  };
  const clipped = (e) => {
    for (let q = e.parentElement; q && q !== document.body; q = q.parentElement) {
      const o = getComputedStyle(q).overflowX;
      if (o === "auto" || o === "scroll" || o === "hidden" || o === "clip") return true;
    }
    return false;
  };
  const label = (e) => {
    const c = typeof e.className === "string" ? e.className : e.className && e.className.baseVal;
    return (e.tagName.toLowerCase() + (c ? "." + String(c).trim().split(/\s+/).slice(0, 2).join(".") : "") + (e.id ? "#" + e.id : "")).slice(0, 48);
  };
  const off = [];
  const smallList = [];
  let tiny = 0;
  let small = 0;
  const all = document.querySelectorAll("body *");
  for (const e of all) {
    const rc = e.getBoundingClientRect();
    if (!visible(e, rc)) continue;
    const cs = getComputedStyle(e);
    if (rc.right > W + 1 && cs.position !== "fixed" && !clipped(e) && off.length < 5) off.push(label(e) + "→" + Math.round(rc.right));
    const hasText = [...e.childNodes].some((c) => c.nodeType === 3 && c.textContent.trim());
    if (hasText && parseFloat(cs.fontSize) < 12 && rc.bottom > 0) tiny++;
    if (touch && e.matches('a[href], button, input:not([type="hidden"]), select, textarea, summary, [role="tab"], [role="button"]')) {
      // 段落里的行内文字链接按正文处理，不计入
      if (e.tagName === "A" && cs.display === "inline" && e.parentElement && /^(P|LI|SPAN|SMALL|TD|DD)$/.test(e.parentElement.tagName) && e.parentElement.textContent.trim().length > e.textContent.trim().length + 2) continue;
      // 被包在 label 里的复选框 / 单选框：点击区域是整个 label
      let hit = rc;
      if (e.tagName === "INPUT" && /checkbox|radio|range/.test(e.type)) {
        const lb = e.closest("label");
        if (lb) hit = lb.getBoundingClientRect();
      }
      if (hit.height < 40 || hit.width < 40) {
        small++;
        if (smallList.length < 6) smallList.push(label(e) + ` ${Math.round(hit.width)}×${Math.round(hit.height)}`);
      }
    }
  }
  // 主要内容区：按优先级找第一个存在的容器
  const SEL = [".legal", ".auth-card", ".empty", ".hm-wrap", ".x-wrap", ".legacy-root .x-sec", ".page-pad", "main"];
  let content = 0;
  let contentSel = "";
  for (const s of SEL) {
    const el = [...document.querySelectorAll(s)].find((x) => x.getBoundingClientRect().width > 0);
    if (el) {
      content = Math.round(el.getBoundingClientRect().width);
      contentSel = s;
      break;
    }
  }
  // 正文行长：可见段落中每行能放几个汉字
  let line = 0;
  const bodyPx = document.body ? parseFloat(getComputedStyle(document.body).fontSize) : 16;
  for (const p of document.querySelectorAll("main p, main li")) {
    const rc = p.getBoundingClientRect();
    if (!rc.width || p.textContent.trim().length < 40) continue;
    const fs = parseFloat(getComputedStyle(p).fontSize) || 16;
    if (fs < bodyPx * 0.95) continue; // 只看正文字号的段落，说明性小字不算
    line = Math.max(line, Math.round(rc.width / fs));
  }
  const bodyFs = document.body ? parseFloat(getComputedStyle(document.body).fontSize) : 0;
  const rootFs = parseFloat(getComputedStyle(de).fontSize);
  // /pc：3D 场景净高度
  let scene = null;
  const canvas = document.querySelector(".pc-canvas");
  if (canvas) {
    const cr = canvas.getBoundingClientRect();
    let top = cr.top;
    let bottom = cr.bottom;
    const bar = document.querySelector(".app-bar");
    if (bar) top = Math.max(top, bar.getBoundingClientRect().bottom);
    for (const s of [".pc-head h1", ".pc-tools", ".pc-explode", ".pc-rgb"]) {
      const el = document.querySelector(s);
      if (!el) continue;
      const r = el.getBoundingClientRect();
      if (!r.height || getComputedStyle(el).display === "none") continue;
      if (r.top < cr.top + cr.height / 2) top = Math.max(top, r.bottom);
    }
    for (const s of [".pc-parts", ".pc-panel--sheet", ".pc-journey"]) {
      const el = document.querySelector(s);
      if (!el || el.hidden) continue;
      const r = el.getBoundingClientRect();
      if (!r.height) continue;
      if (r.top > cr.top + cr.height / 2) bottom = Math.min(bottom, r.top);
    }
    scene = Math.round((Math.max(0, bottom - top) / H) * 100) / 100;
  }
  return { W, H, sw, off, tiny, small, smallList, content, contentSel, line, bodyFs, rootFs, scene };
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM || "/usr/bin/chromium",
    args: ["--no-sandbox", "--no-proxy-server", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
  });
  const results = [];
  for (const [name, w, h, touch] of vps) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, hasTouch: touch, isMobile: touch && Math.min(w, h) < 600 });
    for (const r of routes) {
      const page = await ctx.newPage();
      const errors = [];
      page.on("pageerror", (e) => errors.push("pageerror: " + String(e.message || e).slice(0, 160)));
      page.on("console", (m) => {
        if (m.type() !== "error") return;
        const t = m.text();
        if (/Failed to load resource|\/api\/|ERR_CONNECTION|502|ECONNREFUSED/.test(t)) return; // 预览环境没有后端
        if (/WebGL|GPU stall|swiftshader|GL_/i.test(t)) return; // 软件渲染噪声
        if (/Cross-Origin-Opener-Policy header has been ignored|origin was untrustworthy/i.test(t)) return; // HTTP（未上 HTTPS）下浏览器忽略 COOP 头的提示
        errors.push("console: " + t.slice(0, 160));
      });
      const row = { name, vp: `${w}x${h}`, w, h, touch, route: r };
      try {
        await page.goto(BASE + r, { waitUntil: "domcontentloaded", timeout: 30000 });
        if (r === "/lab") {
          await page.waitForSelector(".lab-loading", { state: "detached", timeout: 30000 }).catch(() => undefined);
          await page.waitForTimeout(1200);
        } else if (r === "/pc") {
          await page.waitForSelector(".pc-loading", { state: "detached", timeout: 45000 }).catch(() => undefined);
          await page.waitForTimeout(1500);
        } else {
          await page.waitForTimeout(700);
        }
        Object.assign(row, await page.evaluate(measure, { touch }));
        row.overflow = row.sw > row.W + 1;
        row.errors = errors;
        if (SHOTS === "all" || (SHOTS === "key" && ["/", "/lab", "/pc"].includes(r))) {
          const file = `${w}x${h}${r === "/" ? "_home" : r.replace(/\//g, "_")}.png`;
          await page.screenshot({ path: path.join(OUT, file) });
          row.shot = file;
        }
      } catch (e) {
        row.fail = String(e).slice(0, 160);
        row.errors = errors;
      }
      results.push(row);
      await page.close();
    }
    await ctx.close();
  }
  await browser.close();

  const head = ["视口", "尺寸", "页面", "溢出", "<12px字", "小目标", "内容宽", "占比", "行长", "3D净高", "错误"];
  const lines = results.map((x) =>
    x.fail
      ? [x.name, x.vp, x.route, "FAIL", "", "", "", "", "", "", x.fail]
      : [
          x.name,
          x.vp,
          x.route,
          x.overflow ? `是 ${x.sw} ${x.off.join(" ")}` : "否",
          x.tiny,
          x.touch ? x.small : "-",
          x.content,
          Math.round((x.content / x.W) * 100) + "%",
          x.line || "-",
          x.scene === null || x.scene === undefined ? "-" : Math.round(x.scene * 100) + "%",
          x.errors.length ? x.errors.join(" | ") : "",
        ],
  );
  const md = ["| " + head.join(" | ") + " |", "|" + head.map(() => "---").join("|") + "|", ...lines.map((l) => "| " + l.join(" | ") + " |")].join("\n");
  console.log(md);

  const sum = {
    pages: results.length,
    overflow: results.filter((x) => x.overflow).length,
    jsErrors: results.filter((x) => x.errors && x.errors.length).length,
    failed: results.filter((x) => x.fail).length,
    tiny: results.reduce((a, x) => a + (x.tiny || 0), 0),
    smallTouch: results.reduce((a, x) => a + (x.touch ? x.small || 0 : 0), 0),
  };
  console.log("\n汇总:", JSON.stringify(sum));
  const detail = results.filter((x) => x.touch && x.small).map((x) => `${x.vp} ${x.route}: ${x.smallList.join(", ")}`);
  if (detail.length) console.log("\n小目标样例:\n" + detail.slice(0, 40).join("\n"));

  let regress = [];
  if (process.env.AUDIT_BASELINE && fs.existsSync(process.env.AUDIT_BASELINE)) {
    const base = JSON.parse(fs.readFileSync(process.env.AUDIT_BASELINE, "utf8")).results || [];
    const key = (x) => x.vp + x.route;
    const bm = new Map(base.map((x) => [key(x), x]));
    for (const x of results) {
      const b = bm.get(key(x));
      if (!b || x.fail) continue;
      if (x.overflow && !b.overflow) regress.push(`${x.vp} ${x.route} 新出现横向溢出`);
      if ((x.tiny || 0) > (b.tiny || 0)) regress.push(`${x.vp} ${x.route} 小字 ${b.tiny} → ${x.tiny}`);
      if (x.touch && (x.small || 0) > (b.small || 0)) regress.push(`${x.vp} ${x.route} 小目标 ${b.small} → ${x.small}`);
      if ((x.errors || []).length > (b.errors || []).length) regress.push(`${x.vp} ${x.route} 新增报错`);
      if (x.scene != null && b.scene != null && x.scene < b.scene - 0.02) regress.push(`${x.vp} ${x.route} 3D 净高 ${b.scene} → ${x.scene}`);
    }
    console.log(regress.length ? "\n相对基线变差:\n" + regress.join("\n") : "\n相对基线：没有变差的项");
  }
  fs.writeFileSync(path.join(OUT, "results.json"), JSON.stringify({ base: BASE, at: new Date().toISOString(), sum, results, regress }, null, 2));
  fs.writeFileSync(path.join(OUT, "report.md"), md + "\n\n汇总: " + JSON.stringify(sum) + "\n");
  console.log(`\n结果与截图：${OUT}`);
  process.exit(sum.overflow || sum.jsErrors || sum.failed ? 1 : 0);
})().catch((e) => {
  console.error(e);
  process.exit(2);
});
