#!/usr/bin/env node
/*
 * 界面审计总入口（pnpm audit:ui）：依次运行
 *   site-audit        全站遮挡、溢出、裁切、触控尺寸、对比度、字号、报错、资源加载（12 个视口 × 实际高度 / 扣除浏览器栏）
 *   ride-audit        化身数据每一站的画面遮挡与结论卡完整可见
 *   responsive-audit  多设备适配回归（版心对齐、目录形态、键盘操作、行长等）
 *
 * 默认先做一次测试构建（RIDE_AUDIT=1，带化身数据检查接口），用与线上相同的 CSP 在本机托管，再逐个审计。
 *
 * 环境变量：
 *   AUDIT_UI_SKIP=1   跳过（日常开发跑 pnpm check 时可用；部署前必须全跑）
 *   AUDIT_UI_FAST=1   快速模式：site-audit 只测扣除浏览器栏的高度、每门课一个实验；ride-audit 只测三个视口
 *   AUDIT_UI_BASE     不构建，直接审计已托管的地址（需是 RIDE_AUDIT=1 的测试构建）
 *   AUDIT_UI_ONLY     只跑其中几项，逗号分隔：site,ride,rwd
 *   AUDIT_UI_OUT      截图与结果的根目录（默认 系统临时目录/k408-audit-ui）
 * 任何一项不通过时退出码为 1。
 */
const { spawnSync, spawn } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const http = require("node:http");

if (process.env.AUDIT_UI_SKIP === "1") {
  console.log("audit:ui 已跳过（AUDIT_UI_SKIP=1）。部署前必须完整运行一次。");
  process.exit(0);
}
const WEB = path.resolve(__dirname, "..");
const ROOT = path.resolve(WEB, "../..");
const OUT = process.env.AUDIT_UI_OUT || path.join(os.tmpdir(), "k408-audit-ui");
const FAST = process.env.AUDIT_UI_FAST === "1";
const ONLY = (process.env.AUDIT_UI_ONLY || "site,ride,rwd").split(",").map((s) => s.trim());
fs.mkdirSync(OUT, { recursive: true });

function serve(dir) {
  const caddy = fs.readFileSync(path.join(ROOT, "deploy/caddy/Caddyfile"), "utf8");
  const m = /Content-Security-Policy "([^"]+)"/.exec(caddy);
  const csp = m ? m[1] : "";
  const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".woff2": "font/woff2", ".json": "application/json", ".png": "image/png", ".webp": "image/webp", ".glb": "model/gltf-binary", ".bin": "application/octet-stream" };
  return new Promise((res) => {
    const srv = http.createServer((req, rsp) => {
      const u = decodeURIComponent(req.url.split("?")[0]);
      if (u.startsWith("/api/")) {
        rsp.writeHead(401, { "content-type": "application/json" });
        return rsp.end('{"error":"unauthorized"}');
      }
      let f = path.join(dir, u);
      if (!f.startsWith(dir) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) f = path.join(dir, "index.html");
      rsp.writeHead(200, { "content-type": types[path.extname(f)] || "application/octet-stream", ...(csp ? { "content-security-policy": csp } : {}) });
      fs.createReadStream(f).pipe(rsp);
    });
    srv.listen(0, "127.0.0.1", () => res(srv));
  });
}

const run = (name, script, env) =>
  new Promise((res) => {
    console.log(`\n==== ${name} ====`);
    const p = spawn(process.execPath, [path.join(__dirname, script), env.BASE], { stdio: "inherit", env: { ...process.env, ...env } });
    p.on("exit", (code) => res(code === 0));
  });

(async () => {
  let base = process.env.AUDIT_UI_BASE;
  let srv = null;
  if (!base) {
    const dist = path.join(OUT, "dist");
    console.log("测试构建（RIDE_AUDIT=1）→", dist);
    const env = { ...process.env, RIDE_AUDIT: "1" };
    delete env.K408_FP_OUT;
    const b = spawnSync("npx", ["vite", "build", "--outDir", dist, "--emptyOutDir", "--logLevel", "warn"], { cwd: WEB, stdio: "inherit", env });
    if (b.status !== 0) {
      console.error("测试构建失败");
      process.exit(1);
    }
    srv = await serve(dist);
    base = `http://127.0.0.1:${srv.address().port}`;
  }
  const results = {};
  if (ONLY.includes("site")) results.site = await run("site-audit", "site-audit.cjs", { BASE: base, SITE_OUT: path.join(OUT, "site"), ...(FAST ? { SITE_FAST: "1" } : {}) });
  if (ONLY.includes("ride")) results.ride = await run("ride-audit", "ride-audit.cjs", { BASE: base, RIDE_OUT: path.join(OUT, "ride"), ...(FAST ? { RIDE_VIEWPORTS: "phone-393,tablet-land,laptop-1366" } : {}) });
  if (ONLY.includes("rwd")) results.rwd = await run("responsive-audit", "responsive-audit.cjs", { BASE: base, AUDIT_OUT: path.join(OUT, "rwd"), AUDIT_SHOTS: "key" });
  if (srv) srv.close();
  console.log("\n==== audit:ui 汇总 ====");
  for (const [k, ok] of Object.entries(results)) console.log(`${ok ? "✓" : "✗"} ${k}`);
  console.log(`截图与结果：${OUT}`);
  process.exit(Object.values(results).every(Boolean) ? 0 : 1);
})();
