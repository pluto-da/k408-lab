/**
 * 旧版体验（3D 主板、拆解、流程演示/闯关、11 个实验、跨科连线、自测）以“遗留模块”方式挂载：
 * public/legacy/ 下的 body.html + 原样脚本，按原页面顺序串行加载，脚本本身不改写。
 * 脚本只能执行一次，所以离开 /lab 时整页刷新（见 pages/Lab.tsx）。
 */
interface Manifest {
  css: string[];
  scripts: string[];
  glb?: string;
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

function loadScript(src: string): Promise<void> {
  return new Promise((resolve) => {
    const s = document.createElement("script");
    s.src = v(src);
    s.async = false;
    s.dataset.legacy = "1";
    s.onload = () => resolve();
    s.onerror = () => {
      console.error("模块加载失败", src);
      resolve(); // 与原页面一致：某个模块失败不阻断其他模块
    };
    document.body.appendChild(s);
  });
}

export async function bootLegacy(container: HTMLElement, onProgress?: (p: number) => void): Promise<void> {
  if (bootedInto) return;
  bootedInto = container;
  window.__LEGACY_LOADER__ = true;
  const manifest = (await fetch(v("manifest.json")).then((r) => r.json())) as Manifest;
  const glbP = manifest.glb
    ? fetch(v(manifest.glb))
        .then((r) => (r.ok ? r.arrayBuffer() : null))
        .catch(() => null)
    : Promise.resolve(null);
  const [html] = await Promise.all([fetch(v("body.html")).then((r) => r.text()), ...manifest.css.map(loadCss)]);
  container.innerHTML = html;
  onProgress?.(0.2);
  window.MB_GLB_BUF = await glbP;
  onProgress?.(0.5);
  const total = manifest.scripts.length;
  for (const [i, src] of manifest.scripts.entries()) {
    await loadScript(src);
    onProgress?.(0.5 + (0.5 * (i + 1)) / total);
  }
  window.__LEGACY_BOOTED__ = true;
  window.dispatchEvent(new Event("legacy:ready"));
}
