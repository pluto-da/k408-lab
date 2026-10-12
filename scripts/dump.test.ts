import { readFileSync, writeFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { it } from "vitest";
it("dump", () => {
  const SRC = readFileSync("/workspace/fullstack-408/apps/web/public/legacy/js/19-lab-ds1.js", "utf8");
  const CSS = readFileSync("/workspace/fullstack-408/apps/web/public/legacy/css/legacy-07.css", "utf8").replace(/var\(--[a-z0-9-]+, ([^)]+)\)/g, "$1").replace(/var\(--[a-z0-9-]+\)/g, "#3a8475");
  const win: Record<string, unknown> = { LAB: [] };
  const NS = "http://www.w3.org/2000/svg";
  win.X = { svg(tag: string, a: Record<string, unknown>, p?: Element) { const n = document.createElementNS(NS, tag); for (const k in a) n.setAttribute(k, String(a[k])); if (p) p.appendChild(n); return n; },
    el(tag: string, a?: Record<string, unknown>, h?: string) { const n = document.createElement(tag); for (const k in a ?? {}) n.setAttribute(k, String((a ?? {})[k])); if (h != null) n.innerHTML = h; return n; } };
  const ctx: Record<string, unknown> = { window: win, document, X: win.X, Math, JSON, Object, Array, String, Number, parseInt, parseFloat, isNaN, Error };
  runInNewContext(SRC, new Proxy(ctx, { get: (t, k) => (k in t ? t[k as string] : win[k as string]), has: () => true, set: (t, k, v) => { t[k as string] = v; return true; } }));
  const plan: Record<string, number[]> = { infix: [8, 14, 22], cqueue: [6, 10], kmp: [5, 14, 20], huffman: [1, 3, 5], bst: [6, 30, 52], btree: [6, 20, 43], ufset: [5, 17] };
  for (const lab of win.LAB as { id: string; mount: (p: HTMLElement, K: unknown) => { step(): boolean; reset(): void } }[]) {
    const panel = document.createElement("div");
    panel.innerHTML = '<div class="o"></div><div class="s"></div><div class="u"></div>';
    let demo: { step(): boolean; reset(): void } | null = null;
    const K = { opts: panel.querySelector(".o"), stage: panel.querySelector(".s"), out: panel.querySelector(".u"), restart: () => demo?.reset() };
    demo = lab.mount(panel, K);
    let cur = 0;
    for (const fi of plan[lab.id] ?? []) {
      while (cur < fi && demo.step()) cur++;
      const svg = (K.stage as HTMLElement).querySelector("svg")!.cloneNode(true) as SVGElement;
      svg.setAttribute("xmlns", NS);
      const vb = svg.getAttribute("viewBox")!.split(" ");
      svg.setAttribute("width", String(Number(vb[2]) * 1.5)); svg.setAttribute("height", String(Number(vb[3]) * 1.5));
      svg.querySelectorAll("[style]").forEach((n) => n.removeAttribute("style"));
      const st = document.createElementNS(NS, "style"); st.textContent = CSS.replace(/transition[^;]*;/g, "") + " text{font-family:'Noto Sans CJK SC',sans-serif} .x-d1-mono,.x-d1-nt{font-family:monospace}";
      svg.insertBefore(st, svg.firstChild);
      const bg = document.createElementNS(NS, "rect"); bg.setAttribute("width", "100%"); bg.setAttribute("height", "100%"); bg.setAttribute("fill", "#fff"); svg.insertBefore(bg, st.nextSibling);
      writeFileSync(`/workspace/work/ds1shots/${lab.id}-${fi}.svg`, svg.outerHTML);
      writeFileSync(`/workspace/work/ds1shots/${lab.id}-${fi}.txt`, (K.out as HTMLElement).textContent ?? "");
    }
  }
});
