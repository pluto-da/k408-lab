/**
 * 旧版体验（3D 主板、拆解、流程演示、11 个实验、跨科连线）以“遗留模块”方式挂载：
 * public/legacy/ 下的 body.html + 原样脚本：脚本并行下载、按原页面顺序执行（async=false），脚本本身不改写。
 * 脚本只能执行一次，所以离开 /lab 时整页刷新（见 pages/Lab.tsx）。
 */
interface Manifest {
  css: string[];
  scripts: string[];
  glb?: string;
  /** 模型文件字节数，用于显示下载进度（经 zstd/gzip 传输时拿不到 Content-Length） */
  glbBytes?: number;
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

export async function bootLegacy(container: HTMLElement, onProgress?: (p: number) => void): Promise<void> {
  if (bootedInto) return;
  bootedInto = container;
  window.__LEGACY_LOADER__ = true;
  let manifest: Manifest;
  let html: string;
  let glbP: Promise<ArrayBuffer | null>;
  // 进度：页面骨架 0–0.1，模型下载 0.1–0.6，脚本执行 0.6–1（各段并行，只增不减）
  let best = 0;
  const report = (p: number) => {
    if (p <= best) return;
    best = p;
    onProgress?.(p);
  };
  try {
    manifest = (await fetchOk(v("manifest.json")).then((r) => r.json())) as Manifest;
    // 主板模型（约 1 MB）、脚本、样式与页面骨架同时下载
    glbP = manifest.glb
      ? fetchGlb(v(manifest.glb), manifest.glbBytes, (f) => report(0.1 + 0.5 * f))
      : Promise.resolve(null);
    manifest.scripts.forEach(preloadScript);
    [html] = await Promise.all([fetchOk(v("body.html")).then((r) => r.text()), ...manifest.css.map(loadCss)]);
  } catch (e) {
    // 还没执行任何旧脚本：允许重试
    bootedInto = null;
    throw e;
  }
  container.innerHTML = html;
  report(0.1);
  window.MB_GLB_BUF = await glbP;
  report(0.6);
  const total = manifest.scripts.length;
  await runScripts(manifest.scripts, (done) => report(0.6 + (0.4 * done) / total));
  window.__LEGACY_BOOTED__ = true;
  window.dispatchEvent(new Event("legacy:ready"));
}
