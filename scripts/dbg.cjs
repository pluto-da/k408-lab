const { chromium } = require('/tmp/pw/node_modules/playwright-core');
(async () => {
  const b = await chromium.launch({ executablePath: '/usr/bin/chromium', args: ['--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox'] });
  const p = await (await b.newContext({ viewport: { width: 1366, height: 860 } })).newPage();
  const logs=[]; p.on('console', m => logs.push(m.type()+' '+m.text().slice(0,160)));
  await p.goto('http://localhost:4173/lab');
  await p.waitForFunction(() => window.HERO && window.HERO.ready, null, { timeout: 90000 });
  await p.waitForTimeout(1500);
  const r = await p.evaluate(() => {
    const out = [];
    const c = document.querySelector('canvas'); const gl = c && (c.getContext('webgl2') || c.getContext('webgl'));
    out.push('lost ' + (gl && gl.isContextLost()));
    window.HERO.root.traverse(o => { if (o.isMesh && o.material && o.material.userData && o.material.userData.glb) { const g=o.geometry; out.push(o.name+' '+Object.entries(g.attributes).map(([k,a])=>k+':'+a.array.constructor.name+(a.normalized?'N':'')+a.itemSize).join(',')+' idx '+(g.index&&g.index.array.constructor.name)+' scale '+o.scale.toArray().map(x=>x.toFixed(3))); } });
    return out;
  });
  console.log(r.join('\n')); console.log(logs.filter(l=>!l.includes('500')).slice(0,5).join('\n'));
  await b.close();
})();
