import { JSDOM } from "jsdom";
import { readFileSync, writeFileSync } from "node:fs";
import vm from "node:vm";
const dom = new JSDOM("<!doctype html><body></body>");
const w = dom.window; w.PROP = []; w.PROPU = {};
const ctx = vm.createContext({ window: w, document: w.document, setTimeout, clearTimeout, Math, Number, String, Object, Array, JSON, Error, RegExp, isNaN, parseInt, Infinity, Boolean });
vm.runInContext(readFileSync("public/legacy/js/24-prop-ds.js","utf8"), ctx);
const css = `
.x-pd-edge{stroke:#1a1c20;stroke-width:1.5}.x-pd-edge.is-hl{stroke:#3a8475;stroke-width:3}.x-pd-edge.is-ghost{stroke:#ccc;stroke-dasharray:4 4}.x-pd-edge.is-null{stroke:#5b5f66;stroke-width:1;stroke-dasharray:3 3}
.x-pd-nil{fill:#fff;stroke:#5b5f66}.x-pd-node circle{fill:#fff;stroke:#1a1c20;stroke-width:1.5}.x-pd-node text{font:600 13px monospace;fill:#1a1c20}
.is-d0 circle,.is-leaf circle{fill:#eaf5ef}.is-d1 circle{fill:#fff6e0}.is-d2 circle{fill:#e6f0ee;stroke:#3a8475}.is-on circle,.is-root circle{fill:#3a8475}.is-ghost circle{fill:#fafaf8;stroke:#ccc}
.is-sel circle{fill:#2f5bea}.is-par circle{fill:#fff6e0;stroke:#b07a12;stroke-width:3}.is-kid circle{fill:#edf1fd;stroke:#2f5bea;stroke-width:3}.is-black circle{fill:#1f2328}.is-red circle{fill:#c62f2f}
.is-black text,.is-red text,.is-sel text,.is-root text,.is-on text{fill:#fff}.is-iso circle{fill:#fcf1f0;stroke:#b3261e}.is-dummy circle{fill:#fafaf8;stroke-dasharray:3 3}
.x-pd-bar{fill:#3a8475}.x-pd-bar.is-ghost{fill:#f0f0ec;stroke:#ccc}.x-pd-txt{font:500 13px sans-serif;fill:#1a1c20}.x-pd-leafbox{fill:#eaf5ef;stroke:#3a8475}.x-pd-arrow{fill:#1a1c20}`;
for (const p of w.PROP) {
  const box = w.document.createElement("div"); w.document.body.appendChild(box);
  const d = p.demo(box);
  const svg = box.querySelector("svg"); svg.setAttribute("xmlns","http://www.w3.org/2000/svg");
  const vb = svg.getAttribute("viewBox").split(" "); svg.setAttribute("width", vb[2]); svg.setAttribute("height", vb[3]);
  const st = w.document.createElementNS("http://www.w3.org/2000/svg","style"); st.textContent = css; svg.insertBefore(st, svg.firstChild);
  writeFileSync(`/workspace/work/pd/${p.id}.svg`, svg.outerHTML);
  console.log(p.id, box.querySelector(".x-pd__out").textContent.slice(0,200));
  d.destroy();
}
