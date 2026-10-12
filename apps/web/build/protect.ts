/**
 * 生产构建的代码保护（只在 vite build 时生效；K408_PROTECT=0 可关闭混淆，用于排查线上问题）：
 *
 * 1. 旧版实验室模块（legacy-src/）不再原样复制：
 *    - 首屏脚本合并为一个包、按需加载的三组各自成包；第三方库单独成包，只压缩不混淆；
 *    - 每个模块包一层 try / catch，与原来“某个模块失败不阻断其他模块”的行为一致；
 *    - 讲解、题目等中文字符串抽出，按 XOR 编码打包成一个二进制文件，运行时由加载器解码；
 *    - esbuild 压缩（去注释、合并空白、局部变量重命名、常量折叠），本站代码再做一层混淆；
 *    - CSS 合并压缩，body.html 去注释压缩；全部文件名改为内容哈希，清单文件名也是哈希，组名不可读。
 * 2. 主程序里价值最高的分块（整机拆解、化身数据）额外混淆；React、three.js 等第三方分块不动。
 * 3. 每个 JS / CSS 文件头保留一行版权声明；混淆后的代码里嵌入版权指纹（清单只写到 K408_FP_OUT 指定的本地文件，不进构建产物）。
 */
import { createHash } from "node:crypto";
import { deflateRawSync } from "node:zlib";
import { existsSync, readFileSync, statSync, writeFileSync, createReadStream } from "node:fs";
import { extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { Plugin } from "vite";
import { transform } from "esbuild";
import ts from "typescript";
import JavaScriptObfuscator from "javascript-obfuscator";

export const BANNER = "/*! © 2026 考研408动画实验室 保留所有权利 */";
const PROTECT = process.env.K408_PROTECT !== "0";
const LEGACY_DIR = fileURLToPath(new URL("../legacy-src", import.meta.url));
/** 额外混淆的主程序分块（按 Rollup 分块名匹配） */
const CORE_CHUNKS = /^(Pc|engine|RideMode)$/;

const hash = (b: string | Buffer, n = 10) => createHash("sha256").update(b).digest("hex").slice(0, n);

/** 组名 → 不可读的键（FNV-1a 32 位），加载器用同一算法换算，见 src/legacy/loadLegacy.ts */
export function groupKey(name: string): string {
  let x = 0x811c9dc5;
  for (let i = 0; i < name.length; i++) {
    x ^= name.charCodeAt(i);
    x = Math.imul(x, 0x01000193) >>> 0;
  }
  return "g" + x.toString(36);
}

/** 版权指纹：按分块类型确定性地生成 4 个 32 位常量；以不可枚举属性挂在 window 上，页面上看不到，代码被再次压缩也不会被当成无用代码删掉 */
const FP: Record<string, string[]> = {};
function fingerprint(kind: string): string {
  const d = createHash("sha256").update("k408-fp|v1|" + kind).digest();
  const nums = [0, 4, 8, 12].map((o) => "0x" + d.readUInt32BE(o).toString(16).padStart(8, "0"));
  const prop = "_$" + d.subarray(16, 19).toString("hex");
  FP[kind] = [prop, ...nums];
  return `;try{Object.defineProperty(window,"${prop}",{value:[${nums.join(",")}]})}catch(_){};`;
}

function obfuscate(code: string, kind: "legacy" | "core", seed: number): string {
  if (!PROTECT) return code;
  return JavaScriptObfuscator.obfuscate(code, {
    compact: true,
    simplify: true,
    target: "browser",
    seed,
    // 局部变量名十六进制化（_0x1a2b3c）；全局接口名（window.LAB、X、PROC 等跨文件调用）不改
    identifierNamesGenerator: "hexadecimal",
    renameGlobals: false,
    // 字符串数组（base64 编码）只用于核心分块。旧版模块体积大（约 1.3 MB）：中文已抽到编码文字表，
    // 不再做字符串数组和控制流扁平化，保证实验室加载不变慢（性能预算，见 Prompt 第五节 2）
    stringArray: kind === "core",
    stringArrayEncoding: ["base64"],
    stringArrayThreshold: 0.75,
    stringArrayRotate: true,
    stringArrayShuffle: true,
    stringArrayIndexShift: true,
    stringArrayWrappersCount: 1,
    stringArrayWrappersType: "variable",
    splitStrings: false,
    // 核心分块：低强度控制流扁平化（5% 的代码块）；旧版模块不做
    controlFlowFlattening: kind === "core",
    controlFlowFlatteningThreshold: 0.05,
    deadCodeInjection: false,
    numbersToExpressions: false,
    transformObjectKeys: false,
    unicodeEscapeSequence: false,
    selfDefending: false,
    debugProtection: false,
    disableConsoleOutput: false,
    ignoreImports: true,
  }).getObfuscatedCode();
}

/* ------------------------------------------------------------------ 旧版模块 */

const CJK = /[\u3000-\u303f\u4e00-\u9fff\uff00-\uffef]/;

/** 把含中文的字符串字面量换成 _$t(i)；对象字面量的键、指令序言不动 */
function extractText(src: string, file: string, table: string[], index: Map<string, number>): string {
  const sf = ts.createSourceFile(file, src, ts.ScriptTarget.ES2020, true, ts.ScriptKind.JS);
  const reps: { s: number; e: number; t: string }[] = [];
  const visit = (n: ts.Node) => {
    if ((ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) && CJK.test(n.text)) {
      const p = n.parent;
      const isKey = (ts.isPropertyAssignment(p) || ts.isPropertyDeclaration(p) || ts.isMethodDeclaration(p)) && p.name === n;
      const directive = ts.isExpressionStatement(p);
      if (!isKey && !directive) {
        let i = index.get(n.text);
        if (i === undefined) {
          i = table.length;
          table.push(n.text);
          index.set(n.text, i);
        }
        reps.push({ s: n.getStart(sf), e: n.getEnd(), t: `_$t(${i})` });
      }
    }
    ts.forEachChild(n, visit);
  };
  visit(sf);
  let out = src;
  for (const r of reps.sort((a, b) => b.s - a.s)) out = out.slice(0, r.s) + r.t + out.slice(r.e);
  return out;
}

function minifyHtml(html: string): string {
  return html
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/>\s*\n\s*</g, "><")
    .replace(/\s*\n\s*/g, " ")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

interface LegacyOut {
  files: Map<string, string | Buffer>;
  /** 清单文件名（内容哈希） */
  manifest: string;
}

async function minJs(code: string): Promise<string> {
  const r = await transform(code, { loader: "js", minify: true, target: "es2017", legalComments: "inline", charset: "utf8" });
  return r.code;
}

export async function buildLegacy(): Promise<LegacyOut> {
  const src = JSON.parse(readFileSync(join(LEGACY_DIR, "manifest.json"), "utf8")) as {
    css: string[];
    scripts: string[];
    lazy: Record<string, { needs?: string[]; scripts: string[]; glb?: string; glbBytes?: number }>;
  };
  const files = new Map<string, string | Buffer>();
  const put = (ext: string, body: string | Buffer) => {
    const name = hash(body) + ext;
    files.set(name, body);
    return name;
  };
  const read = (p: string) => readFileSync(join(LEGACY_DIR, p), "utf8");
  const table: string[] = [];
  const index = new Map<string, number>();
  const wrap = (p: string) => `try{\n${read(p)}\n}catch(e){console.error(e)}\n`;
  let seed = 408;

  /** 本站代码：抽文字 → 压缩 → 指纹 → 混淆 → 版权行 */
  const own = async (list: string[], kind: string) => {
    const joined = list.map((p) => extractText(wrap(p), p, table, index)).join(";\n");
    const min = await minJs(joined);
    return BANNER + "\n" + obfuscate(fingerprint(kind) + min, "legacy", seed++);
  };
  /** 第三方库：只压缩，保留原许可声明 */
  const vendor = async (list: string[]) => BANNER + "\n" + (await minJs(list.map(wrap).join(";\n")));

  // 样式：合并为一个文件
  const css = (await transform(src.css.map(read).join("\n"), { loader: "css", minify: true, legalComments: "none", charset: "utf8" })).code;
  const cssName = put(".css", BANNER + "\n" + css);
  const bodyName = put(".html", minifyHtml(read("body.html")));
  const mainName = put(".js", await own(src.scripts, "legacy-main"));

  const lazy: Record<string, { needs?: string[]; scripts: string[]; glb?: string; glbBytes?: number }> = {};
  for (const [g, def] of Object.entries(src.lazy)) {
    const ven = def.scripts.filter((p) => p.startsWith("vendor/"));
    const mine = def.scripts.filter((p) => !p.startsWith("vendor/"));
    const scripts: string[] = [];
    if (ven.length) scripts.push(put(".js", await vendor(ven)));
    if (mine.length) scripts.push(put(".js", await own(mine, "legacy-" + g)));
    const out: (typeof lazy)[string] = { scripts };
    if (def.needs) out.needs = def.needs.map(groupKey);
    if (def.glb) {
      const b = readFileSync(join(LEGACY_DIR, def.glb));
      out.glb = put(".glb", b);
      out.glbBytes = b.byteLength;
    }
    lazy[groupKey(g)] = out;
  }

  // 文字表：UTF-8 JSON（deflate 压缩）按密钥逐字节异或（不是加密，密钥在前端；目的是让直接搜索、复制数据变麻烦）
  // 先压缩再编码：编码后的数据无法再被服务器压缩，先压缩体积约为原文的四分之一
  const plain = deflateRawSync(Buffer.from(JSON.stringify(table), "utf8"), { level: 9 });
  const key = createHash("sha256").update("k408-text|" + plain.toString("base64")).digest().subarray(0, 16);
  const enc = Buffer.alloc(plain.length);
  for (let i = 0; i < plain.length; i++) enc[i] = plain[i]! ^ key[i % key.length]! ^ ((i * 31) & 0xff);
  const textName = put(".bin", enc);

  const manifest = JSON.stringify({ css: [cssName], body: bodyName, text: { f: textName, k: key.toString("base64") }, scripts: [mainName], lazy });
  return { files, manifest: put(".json", manifest) };
}

/* ------------------------------------------------------------------ 插件 */

export function protect(): Plugin {
  let legacy: LegacyOut | null = null;
  let manifestName = "manifest.json";
  return {
    name: "k408-protect",
    async config(_c, { command }) {
      if (command !== "build") return { define: { __LEGACY_MANIFEST__: JSON.stringify("manifest.json") } };
      legacy = await buildLegacy();
      manifestName = legacy.manifest;
      return {
        define: { __LEGACY_MANIFEST__: JSON.stringify(manifestName) },
        build: {
          rollupOptions: {
            output: {
              // 文件名只保留内容哈希，不暴露模块名
              entryFileNames: "assets/[hash].js",
              chunkFileNames: "assets/[hash].js",
              assetFileNames: "assets/[hash][extname]",
            },
          },
        },
      };
    },
    // 开发服务器：/legacy/ 直接读源码目录（清单与文件名都是可读的原名）
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const u = (req.url ?? "").split("?")[0]!;
        if (!u.startsWith("/legacy/")) return next();
        const f = resolve(LEGACY_DIR, "." + u.slice(7));
        if (!f.startsWith(LEGACY_DIR) || !existsSync(f) || !statSync(f).isFile()) return next();
        const types: Record<string, string> = { ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".html": "text/html", ".glb": "model/gltf-binary" };
        res.setHeader("Content-Type", (types[extname(f)] ?? "application/octet-stream") + "; charset=utf-8");
        createReadStream(f).pipe(res);
      });
    },
    generateBundle(_o, bundle) {
      let seed = 1408;
      for (const item of Object.values(bundle)) {
        if (item.type === "chunk") {
          const core = CORE_CHUNKS.test(item.name);
          let code = item.code;
          if (core) code = obfuscate(fingerprint("core-" + item.name) + code, "core", seed++);
          item.code = BANNER + "\n" + code;
        } else if (item.fileName.endsWith(".css") && typeof item.source === "string") {
          item.source = BANNER + "\n" + item.source;
        }
      }
      if (legacy) {
        for (const [name, body] of legacy.files) this.emitFile({ type: "asset", fileName: `legacy/${name}`, source: body });
        if (process.env.K408_FP_OUT) writeFileSync(process.env.K408_FP_OUT, JSON.stringify({ note: "版权指纹（内部留存，不部署）", fingerprints: FP }, null, 2));
      }
    },
  };
}
