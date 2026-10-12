#!/usr/bin/env node
/**
 * 内容来源扫描：在对外发布的源码与构建产物中检索辅导书品牌、教材作者、辅导书栏目名等敏感词。
 * 有命中时输出“文件:行号”并以退出码 1 结束；无命中退出码 0。
 *
 * 用法：
 *   node scripts/check-sources.mjs            扫描源码（apps/web/public、apps/web/src、apps/web/index.html、apps/api/src、packages）
 *   node scripts/check-sources.mjs --dist     额外扫描构建产物 apps/web/dist（存在时）
 *   node scripts/check-sources.mjs <路径...>  只扫描给定路径（例如线上抓取下来的页面目录）
 *
 * 词表以 Unicode 转义书写，这样本脚本自身不会出现敏感词原文。
 */
import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import { inflateRawSync } from "node:zlib";
import { join, relative, resolve, extname, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const u = (s) => s; // 仅为可读性：下方字符串均为 \u 转义

/** [规则名, 正则] */
const RULES = [
  // 辅导书品牌及其论坛、训练营（中文与拼音）
  ["辅导书品牌", new RegExp(u("\u738b\u9053"))],
  ["辅导书品牌拼音", /wang\s*dao|\bwd(?:ky|kaoyan)\b/i],
  ["其他辅导书品牌", new RegExp(u("\u5929\u52e4|\u7adf\u6210|\u7387\u8f89|\u54b8\u9c7c\u5b66\u957f|\u4e5d\u7ae0\u7b97\u6cd5"))],
  // 辅导书栏目与书名用语
  ["辅导书栏目/书名", new RegExp(u("\u590d\u4e60\u5168\u4e66|\u590d\u4e60\u6307\u5bfc|\u56db\u672c\u4e66|\u56db\u672c\u590d\u4e60|\u672c\u8282\u8bd5\u9898\u7cbe\u9009|\u5f52\u7eb3\u603b\u7ed3|\u7b54\u6848\u4e0e\u89e3\u6790|\u601d\u7ef4\u62d3\u5c55|\u672c\u7ae0\u7591\u96be\u70b9|\u672c\u8282\u5c0f\u7ed3"))],
  // 主流教材作者（对外内容不点名）
  ["教材作者", new RegExp(u("\u4e25\u851a\u654f|\u5434\u4f1f\u6c11|\u6c64\u5c0f\u4e39|\u6c64\u5b50\u701b|\u54f2\u51e4\u5c4f|\u6881\u7ea2\u5175|\u8c22\u5e0c\u4ec1|\u5510\u6714\u98de|\u8881\u6625\u98ce|\u674e\u6625\u8446"))],
  // “教材 + 口径 / 写法 / 画法 / 例题 / 序列 / 脚本”这类暗示对照某本书的说法
  ["教材对照类说法", new RegExp(u("\u6559\u6750(?:\u53e3\u5f84|\u5199\u6cd5|\u753b\u6cd5|\u4f8b\u9898|\u4f8b|\u5e8f\u5217|\u811a\u672c|\u7ed9\u51fa\u7684)"))],
];

const SRC_TARGETS = ["apps/web/public", "apps/web/legacy-src", "apps/web/src", "apps/web/index.html", "apps/api/src", "packages"];
const SKIP_DIRS = new Set(["node_modules", ".git", ".turbo", "coverage"]);
const TEXT_EXT = new Set([".js", ".mjs", ".cjs", ".ts", ".tsx", ".jsx", ".html", ".htm", ".css", ".json", ".md", ".txt", ".svg", ".xml", ".webmanifest", ".map", ".yml", ".yaml", ".sql"]);

function* walk(p) {
  if (!existsSync(p)) return;
  const st = statSync(p);
  if (st.isFile()) { yield p; return; }
  for (const name of readdirSync(p)) {
    if (SKIP_DIRS.has(name)) continue;
    yield* walk(join(p, name));
  }
}

const args = process.argv.slice(2);
const withDist = args.includes("--dist");
const explicit = args.filter((a) => !a.startsWith("--"));
const targets = explicit.length ? explicit.map((p) => resolve(p)) : SRC_TARGETS.map((p) => join(ROOT, p));
if (!explicit.length && withDist) targets.push(join(ROOT, "apps/web/dist"));

/*
 * 构建产物里的文字不是明文：
 *  - 旧版模块的文字表（.bin）：按清单里的密钥解码后再扫描；
 *  - 混淆分块的字符串数组（变体 base64，小写字母在前）：逐个解码后附在文件内容后面一起扫描。
 */
const B64_STD = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";
const B64_OBF = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789+/=";
function decodeObfStrings(code) {
  const out = [];
  for (const m of code.matchAll(/'([A-Za-z0-9+/=]{4,})'/g)) {
    const std = [...m[1]].map((c) => B64_STD[B64_OBF.indexOf(c)]).join("");
    const t = Buffer.from(std, "base64").toString("utf8");
    if (/[\u4e00-\u9fff]|[a-z]{3}/i.test(t) && !t.includes("\ufffd")) out.push(t);
  }
  return out;
}
function decodeTextTables(dir) {
  const out = [];
  for (const f of walk(dir)) {
    if (extname(f) !== ".json") continue;
    let m;
    try { m = JSON.parse(readFileSync(f, "utf8")); } catch { continue; }
    if (!m || !m.text || !m.text.f || !m.text.k) continue;
    const bin = join(dirname(f), m.text.f);
    if (!existsSync(bin)) continue;
    const key = Buffer.from(m.text.k, "base64");
    const enc = readFileSync(bin);
    const dec = Buffer.alloc(enc.length);
    for (let i = 0; i < enc.length; i++) dec[i] = enc[i] ^ key[i % key.length] ^ ((i * 31) & 0xff);
    out.push({ f: bin, text: JSON.parse(inflateRawSync(dec).toString("utf8")).join("\n") });
  }
  return out;
}

let hits = 0, files = 0, decoded = 0;
const scanText = (f, text) => {
    const lines = text.split(/\r?\n/);
    lines.forEach((line, i) => {
      for (const [name, re] of RULES) {
        const m = line.match(re);
        if (!m) continue;
        hits++;
        const at = Math.max(0, (m.index ?? 0) - 30);
        console.log(`${relative(ROOT, f)}:${i + 1}  [${name}]  …${line.slice(at, at + 90).trim()}…`);
      }
    });
};
for (const t of targets) {
  if (existsSync(t) && statSync(t).isDirectory()) for (const d of decodeTextTables(t)) { files++; decoded++; scanText(d.f + "（解码）", d.text); }
  for (const f of walk(t)) {
    if (!TEXT_EXT.has(extname(f).toLowerCase())) continue;
    files++;
    if (extname(f) === ".js") { const ds = decodeObfStrings(readFileSync(f, "utf8")); if (ds.length) { decoded++; scanText(f + "（字符串数组解码）", ds.join("\n")); } }
    const lines = readFileSync(f, "utf8").split(/\r?\n/);
    lines.forEach((line, i) => {
      for (const [name, re] of RULES) {
        const m = line.match(re);
        if (!m) continue;
        hits++;
        const at = Math.max(0, (m.index ?? 0) - 30);
        console.log(`${relative(ROOT, f)}:${i + 1}  [${name}]  …${line.slice(at, at + 90).trim()}…`);
      }
    });
  }
}
console.log(`\ncheck-sources：扫描 ${files} 个文件（其中 ${decoded} 个解码后扫描），命中 ${hits} 处。`);
process.exit(hits ? 1 : 0);
