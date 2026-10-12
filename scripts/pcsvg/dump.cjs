const { JSDOM } = require("/workspace/fullstack-408/apps/web/node_modules/jsdom");
const fs = require("fs"), vm = require("vm");
const dom = new JSDOM("<!doctype html><body></body>");
const document = dom.window.document;
const win = {};
const ctx = { window: win, document, Math, Error, Object, Array, JSON, Number, String, parseInt, parseFloat, isNaN, isFinite, Float32Array, Uint32Array, setTimeout, clearTimeout, setInterval, clearInterval, Infinity, NaN };
vm.runInNewContext(fs.readFileSync("/workspace/fullstack-408/apps/web/public/legacy/js/25-prop-co.js", "utf8"), new Proxy(ctx, { get: (t, k) => (k in t ? t[k] : win[k]), has: () => true, set: (t, k, v) => { t[k] = v; win[k] = v; return true; } }));
for (const p of win.PROP) {
  const box = document.createElement("div");
  const d = p.demo(box);
  const svg = box.querySelector("svg");
  svg.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  svg.setAttribute("font-family", "Noto Sans SC, sans-serif");
  const vb = svg.getAttribute("viewBox").split(" ");
  svg.setAttribute("width", vb[2]); svg.setAttribute("height", vb[3]);
  fs.writeFileSync(p.id + ".svg", svg.outerHTML);
  fs.writeFileSync(p.id + ".txt", box.querySelector(".x-pc__out").textContent + "\nERR:" + box.querySelector(".x-pc__err").textContent);
  d.destroy();
}
