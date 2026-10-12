const { JSDOM, VirtualConsole } = require('/workspace/fullstack-408/apps/web/node_modules/jsdom');
const fs = require('fs'); const path = require('path');
const L = '/workspace/fullstack-408/apps/web/public/legacy/';
const man = JSON.parse(fs.readFileSync(L + 'manifest.json', 'utf8'));
const errs = [];
const vc = new VirtualConsole(); vc.on('jsdomError', e => errs.push('jsdom: ' + (e.message||e).toString().slice(0,200))); vc.on('error', (...a) => errs.push('console: ' + a.map(String).join(' ').slice(0,200)));
const dom = new JSDOM('<!doctype html><html><body><div id="root">' + fs.readFileSync(L + 'body.html', 'utf8') + '</div></body></html>', { url: 'http://localhost/lab#prop-' + (process.argv[2]||'x'), runScripts: 'outside-only', pretendToBeVisual: true, virtualConsole: vc });
const w = dom.window;
w.matchMedia = w.matchMedia || (() => ({ matches: false, addListener(){}, removeListener(){}, addEventListener(){}, removeEventListener(){} }));
w.__LEGACY_LOADER__ = true;
w.IntersectionObserver = class { observe(){} disconnect(){} };
w.HTMLCanvasElement.prototype.getContext = () => null;
for (const s of man.scripts) {
  const f = L + s; if (!fs.existsSync(f)) { errs.push('missing ' + s); continue; }
  try { w.eval(fs.readFileSync(f, 'utf8')); } catch (e) { errs.push(s + ': ' + e.message); }
}
w.dispatchEvent(new w.Event('legacy:ready'));
setTimeout(() => {
  const d = w.document, P = w.PROP || [];
  const out = { n: P.length, bySub: P.reduce((a, p) => (a[p.sub] = (a[p.sub]||0)+1, a), {}), cur: w.X_PROP && w.X_PROP.current(), items: d.querySelectorAll('#x-prop .x-prop__item').length, toc: d.querySelectorAll('#x-toc-props a').length };
  const labIds = (w.LAB||[]).map(x => x.id), procIds = (w.PROC||[]).map(x => x.id);
  out.validate = w.PROPU.validate(P, { labIds, procIds });
  // open each prop and catch demo errors
  out.demoErr = [];
  for (const p of P) { w.X_PROP.open(p.id); const e = d.querySelector('#x-prop .x-prop__err'); if (e) out.demoErr.push(p.id + ': ' + e.textContent); }
  // global search
  const q = d.getElementById('x-q'); q.value = 'n₀'; q.dispatchEvent(new w.Event('input'));
  setTimeout(() => { out.sum = d.getElementById('x-q-sum').textContent; out.propHidden = d.getElementById('prop').hidden; console.log(JSON.stringify(out, null, 1)); console.log('errs', JSON.stringify(errs, null, 1)); process.exit(0); }, 300);
}, 300);
