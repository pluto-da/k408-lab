import { chromium } from '/workspace/work/pw/node_modules/playwright-core/index.mjs';
const b = await chromium.launch({ executablePath: '/usr/bin/chromium', args: ['--use-angle=swiftshader','--no-sandbox','--enable-unsafe-swiftshader','--no-proxy-server'] });
const ctx = await b.newContext({ viewport:{width:390,height:844}, isMobile:true, hasTouch:true });
const p = await ctx.newPage();
await p.goto('http://localhost:4173/pc?debug&dpr=1');
await p.waitForFunction(()=>window.__pc && window.__pc.state==='overview',null,{timeout:60000});
for (const id of ['cpu','gpu','ram','ssd','hdd','nic','psu','board']) {
  await p.evaluate((id)=>window.__pc.select(id),id);
  await p.waitForFunction(()=>window.__pc.state==='open',null,{timeout:60000}); await p.waitForTimeout(2200);
  const r = await p.evaluate(()=>{const e=window.__pc; const id=e.selected; const it=e.parts.get(id).interior; const V=e.controls.target.constructor;
    const B=(new e.raycaster.ray.origin.constructor).constructor; 
    const out={};
    for (const k of [0,1]) { e.applyDisassembly(k); it.group.updateMatrixWorld(true);
      let lo=[1e9,1e9,1e9],hi=[-1e9,-1e9,-1e9];
      it.group.traverse(o=>{ if(o.isMesh&&o.geometry){ o.geometry.computeBoundingBox(); const bb=o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld); lo=lo.map((v,i)=>Math.min(v,bb.min.getComponent(i))); hi=hi.map((v,i)=>Math.max(v,bb.max.getComponent(i)));}});
      const c=lo.map((v,i)=>(v+hi[i])/2); const t=e.controls.target; const rad=Math.hypot(...hi.map((v,i)=>v-lo[i]))/2;
      out['k'+k]='c-t '+[c[0]-t.x,c[1]-t.y,c[2]-t.z].map(v=>v.toFixed(3))+' r '+rad.toFixed(3);
    }
    e.applyDisassembly(0);
    return id+' layers '+it.layers.length+' dist '+e.camera.position.distanceTo(e.controls.target).toFixed(3)+' | '+out.k0+' | '+out.k1;});
  console.log(r);
  await p.evaluate(()=>window.__pc.back()); await p.waitForFunction(()=>window.__pc.state==='overview',null,{timeout:30000}); await p.waitForTimeout(500);
}
await b.close();
