/**
 * 实验室旧模块（章节考点、39 个实验、36 个过程图解、56 条性质、立体结构图、流程演示、跨科连线）以“遗留模块”方式挂载：
 * 源码在 legacy-src/（body.html + 脚本 + 样式）。生产构建由 build/protect.ts 合并、压缩、混淆，文件名与清单名都是内容哈希，
 * 中文文字抽成一个编码后的文字表；开发环境直接读源码目录。脚本并行下载、按顺序执行（async=false）。
 * 首屏只加载章节与实验脚本；立体结构图（3D 库 + 主板模型）与跨科连线立体图分组按需加载，
 * 由旧模块通过 window.__LEGACY_LOAD__(组名) 触发（见 legacy-src/js/09-tool.js）。
 * 脚本只能执行一次，所以离开 /lab 时整页刷新（见 pages/Lab.tsx）。
 */
interface LazyGroup {
  /** 先加载的组 */
  needs?: string[];
  scripts: string[];
  /** 加载这一组前要下载的主板模型 */
  glb?: string;
  /** 模型文件字节数，用于显示下载进度（经 zstd/gzip 传输时拿不到 Content-Length） */
  glbBytes?: number;
}
interface Manifest {
  css: string[];
  scripts: string[];
  /** 页面骨架（构建后为哈希文件名；开发环境缺省为 body.html） */
  body?: string;
  /** 编码后的文字表：f 文件名，k 密钥（base64） */
  text?: { f: string; k: string };
  lazy?: Record<string, LazyGroup>;
}

/** 组名 → 清单里的键；与 build/protect.ts 的 groupKey 同一算法（开发环境清单直接用原名） */
function groupKey(name: string): string {
  let x = 0x811c9dc5;
  for (let i = 0; i < name.length; i++) {
    x ^= name.charCodeAt(i);
    x = Math.imul(x, 0x01000193) >>> 0;
  }
  return "g" + x.toString(36);
}

/** deflate 解压：浏览器自带 DecompressionStream 时用它，旧浏览器按需加载一个小解压库 */
async function inflate(b: Uint8Array): Promise<Uint8Array> {
  if (typeof DecompressionStream === "function") {
    const s = new Blob([b]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
    return new Uint8Array(await new Response(s).arrayBuffer());
  }
  const { inflateSync } = await import("fflate");
  return inflateSync(b);
}

/** 下载文字表并解码，供旧模块通过 _$t(i) 取用 */
async function loadText(t: { f: string; k: string }): Promise<void> {
  const r = await fetchOk(v(t.f));
  const enc = new Uint8Array(await r.arrayBuffer());
  const key = Uint8Array.from(atob(t.k), (c) => c.charCodeAt(0));
  const out = new Uint8Array(enc.length);
  for (let i = 0; i < enc.length; i++) out[i] = enc[i]! ^ key[i % key.length]! ^ ((i * 31) & 0xff);
  const table = JSON.parse(new TextDecoder().decode(await inflate(out))) as string[];
  Object.defineProperty(window, "_$t", { value: (i: number) => table[i], configurable: false, enumerable: false, writable: false });
}

const BASE = "/legacy/";
const v = (p: string) => `${BASE}${p}?v=${__BUILD_ID__}`;

let bootedInto: HTMLElement | null = null;

export function legacyBootedInto(): HTMLElement | null {
  return bootedInto;
}

function loadCss(href: string): Promise<void> {
  return new Promise((resolve) => {
    const id = "legacy-css-" + href.replace(/[^a-z0-9]/gi, "-");
    if (document.getElementById(id)) return resolve();
    const l = document.createElement("link");
    l.rel = "stylesheet";
    l.href = v(href);
    l.id = id;
    l.dataset.legacy = "1";
    l.onload = () => resolve();
    l.onerror = () => resolve();
    document.head.appendChild(l);
  });
}

export function removeLegacyCss(): void {
  document.querySelectorAll('link[data-legacy="1"]').forEach((l) => l.remove());
}

/** 预先并行下载脚本（不执行），与模型下载同时进行，弱网下省掉十几次串行往返 */
function preloadScript(src: string): void {
  const l = document.createElement("link");
  l.rel = "preload";
  l.as = "script";
  l.href = v(src);
  l.dataset.legacy = "1";
  document.head.appendChild(l);
}

/** 一次性插入全部脚本：async=false 保证按插入顺序执行，同时允许并行下载 */
function runScripts(srcs: string[], onEach: (done: number) => void): Promise<void> {
  let done = 0;
  return Promise.all(
    srcs.map(
      (src) =>
        new Promise<void>((resolve) => {
          const s = document.createElement("script");
          s.src = v(src);
          s.async = false;
          s.dataset.legacy = "1";
          const finish = () => {
            onEach(++done);
            resolve();
          };
          s.onload = finish;
          s.onerror = () => {
            console.error("模块加载失败", src);
            finish(); // 与原页面一致：某个模块失败不阻断其他模块
          };
          document.body.appendChild(s);
        }),
    ),
  ).then(() => undefined);
}

/** 下载模型并按字节数回报进度；失败时返回 null，旧脚本会自行降级为示意图 */
async function fetchGlb(url: string, expected: number | undefined, onProgress: (f: number) => void): Promise<ArrayBuffer | null> {
  try {
    const r = await fetch(url);
    if (!r.ok) return null;
    if (!r.body || !expected) return await r.arrayBuffer();
    const reader = r.body.getReader();
    const chunks: Uint8Array[] = [];
    let got = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      got += value.byteLength;
      onProgress(Math.min(1, got / expected));
    }
    const out = new Uint8Array(got);
    let off = 0;
    for (const c of chunks) {
      out.set(c, off);
      off += c.byteLength;
    }
    return out.buffer;
  } catch {
    return null;
  }
}

async function fetchOk(url: string): Promise<Response> {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`加载失败（${r.status}）：${url}`);
  return r;
}

const lazyDone = new Map<string, Promise<void>>();

/** 按需加载一组脚本（含依赖组与模型）；同一组只加载一次 */
function loadGroup(manifest: Manifest, name: string, onProgress?: (f: number) => void, isKey = false): Promise<void> {
  const hit = lazyDone.get(name);
  if (hit) return hit;
  const g = isKey ? manifest.lazy?.[name] : (manifest.lazy?.[groupKey(name)] ?? manifest.lazy?.[name]);
  if (!g) return Promise.reject(new Error(`未知的模块组：${name}`));
  const p = (async () => {
    // 依赖组与本组的模型、脚本同时下载，执行仍按顺序
    g.scripts.forEach(preloadScript);
    const glbP = g.glb ? fetchGlb(v(g.glb), g.glbBytes, (f) => onProgress?.(0.85 * f)) : Promise.resolve(null);
    for (const dep of g.needs ?? []) await loadGroup(manifest, dep, undefined, true);
    if (g.glb) window.MB_GLB_BUF = await glbP;
    onProgress?.(0.85);
    const total = g.scripts.length;
    await runScripts(g.scripts, (done) => onProgress?.(0.85 + (0.15 * done) / total));
    onProgress?.(1);
  })();
  lazyDone.set(name, p);
  p.catch(() => lazyDone.delete(name));
  return p;
}

export async function bootLegacy(container: HTMLElement, onProgress?: (p: number) => void): Promise<void> {
  if (bootedInto) return;
  bootedInto = container;
  window.__LEGACY_LOADER__ = true;
  let manifest: Manifest;
  let html: string;
  // 进度：页面骨架 0–0.3，脚本执行 0.3–1（只增不减）
  let best = 0;
  const report = (p: number) => {
    if (p <= best) return;
    best = p;
    onProgress?.(p);
  };
  try {
    manifest = (await fetchOk(v(__LEGACY_MANIFEST__)).then((r) => r.json())) as Manifest;
    manifest.scripts.forEach(preloadScript);
    [html] = await Promise.all([fetchOk(v(manifest.body ?? "body.html")).then((r) => r.text()), manifest.text ? loadText(manifest.text) : Promise.resolve(), ...manifest.css.map(loadCss)]);
  } catch (e) {
    // 还没执行任何旧脚本：允许重试
    bootedInto = null;
    throw e;
  }
  window.__LEGACY_LOAD__ = (name, onP) => loadGroup(manifest, name, onP);
  container.innerHTML = html;
  report(0.3);
  const total = manifest.scripts.length;
  await runScripts(manifest.scripts, (done) => report(0.3 + (0.7 * done) / total));
  window.__LEGACY_BOOTED__ = true;
  window.dispatchEvent(new Event("legacy:ready"));
}
