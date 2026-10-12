import { chromium } from '/workspace/work/pw/node_modules/playwright-core/index.mjs';
const url = process.argv[2] || 'http://localhost:4173/pc?debug&dpr=1';
const ids = (process.argv[3]||'cpu').split(',');
const b = await chromium.launch({ executablePath: '/usr/bin/chromium', args: ['--use-angle=swiftshader','--no-sandbox','--enable-unsafe-swiftshader','--no-proxy-server'] });
const ctx = await b.newContext({ viewport:{width:390,height:844}, isMobile:true, hasTouch:true, locale:'zh-CN' });
const p = await ctx.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message));
await p.goto(url,{waitUntil:'load',timeout:60000});
await p.waitForFunction(()=>window.__pc && window.__pc.state==='overview',null,{timeout:60000});
const cdp = await ctx.newCDPSession(p);
const box = await p.evaluate(()=>{const r=window.__pc.renderer.domElement.getBoundingClientRect();return {x:r.left,y:r.top,w:r.width,h:r.height};});
const cx=box.x+box.w/2, cy=box.y+box.h/2;
const info=()=>p.evaluate(()=>{const e=window.__pc; const it=e.parts.get(e.selected).interior; it.group.updateMatrixWorld(true);
  const B=e.pivotBox.clone().setFromObject(it.group); const m=B.getCenter(e.controls.target.clone()); const pr=m.clone().project(e.camera);
  const r=e.renderer.domElement; const off=e.camera.position.clone().sub(e.controls.target);
  return {sx:(pr.x+1)/2*r.clientWidth, sy:(1-pr.y)/2*r.clientHeight, W:r.clientWidth,H:r.clientHeight, dist:off.length(), th:Math.atan2(off.x,off.z)*180/Math.PI, ph:Math.acos(off.y/off.length())*180/Math.PI, k:e.disK, cam:e.camera.position.toArray()};});
const fmt=(t,i)=>`${t.padEnd(16)} off ${((Math.hypot(i.sx-i.W/2,i.sy-i.H/2))/Math.min(i.W,i.H)*100).toFixed(1)}% dist ${i.dist.toFixed(3)} th ${i.th.toFixed(0)} ph ${i.ph.toFixed(0)} k ${i.k.toFixed(2)}`;
const tp=(x,y,id)=>({x,y,id});
async function g(pts0, d, steps=14){ await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:pts0.map((q,i)=>tp(q[0],q[1],i+1))});
  for(let s=1;s<=steps;s++){ await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:pts0.map((q,i)=>tp(q[0]+d[i][0]*s/steps,q[1]+d[i][1]*s/steps,i+1))}); await p.waitForTimeout(16);} 
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]}); }
const still=async(t)=>{const a=await info(); await p.waitForTimeout(1500); const c=await info(); const dd=Math.hypot(...a.cam.map((v,i)=>v-c.cam[i])); console.log(fmt(t,c)+` drift ${dd.toFixed(5)}`);};
for (const id of ids){
  await p.evaluate((id)=>window.__pc.select(id),id);
  await p.waitForFunction(()=>window.__pc.state==='open',null,{timeout:60000}); await p.waitForTimeout(2500);
  console.log('== '+id); console.log(fmt('opened',await info()));
  await g([[cx-60,cy],[cx+60,cy]],[[120,0],[120,0]]); await still('2f rotate');
  await g([[cx-40,cy],[cx+40,cy]],[[-60,0],[60,0]]); await still('pinch in');
  await g([[cx,cy]],[[150,0]]); await still('1f horizontal');
  await g([[cx,cy]],[[120,-90]]); await still('1f diag');
  await g([[cx,cy+150]],[[0,-260]]); await still('1f up');
  if(process.env.SHOT) await p.screenshot({path:`/workspace/work/redesign/orbit-${id}.png`});
  await g([[cx,cy-150]],[[0,300]]); await still('1f down');
  await p.evaluate(()=>window.__pc.back()); await p.waitForFunction(()=>window.__pc.state==='overview',null,{timeout:30000});
  const o=await p.evaluate(()=>[window.__pc.controls.enableDamping, window.__pc.controls.maxPolarAngle.toFixed(2)]); console.log('back overview damping/maxPolar',o);
}
console.log('errs',errs); await b.close();
