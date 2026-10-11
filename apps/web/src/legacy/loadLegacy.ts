/**
 * 实验室旧模块（章节考点、39 个实验、36 个过程图解、56 条性质、立体结构图、流程演示、跨科连线）以“遗留模块”方式挂载：
 * public/legacy/ 下的 body.html + 原样脚本：脚本并行下载、按原页面顺序执行（async=false）。
 * 首屏只加载章节与实验脚本；立体结构图（3D 库 + 主板模型）与跨科连线立体图分组按需加载，
 * 由旧模块通过 window.__LEGACY_LOAD__(组名) 触发（见 public/legacy/js/09-tool.js）。
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
  lazy?: Record<string, LazyGroup>;
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
function loadGroup(manifest: Manifest, name: string, onProgress?: (f: number) => void): Promise<void> {
  const hit = lazyDone.get(name);
  if (hit) return hit;
  const g = manifest.lazy?.[name];
  if (!g) return Promise.reject(new Error(`未知的模块组：${name}`));
  const p = (async () => {
    // 依赖组与本组的模型、脚本同时下载，执行仍按顺序
    g.scripts.forEach(preloadScript);
    const glbP = g.glb ? fetchGlb(v(g.glb), g.glbBytes, (f) => onProgress?.(0.85 * f)) : Promise.resolve(null);
    for (const dep of g.needs ?? []) await loadGroup(manifest, dep);
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
    manifest = (await fetchOk(v("manifest.json")).then((r) => r.json())) as Manifest;
    manifest.scripts.forEach(preloadScript);
    [html] = await Promise.all([fetchOk(v("body.html")).then((r) => r.text()), ...manifest.css.map(loadCss)]);
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
