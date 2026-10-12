import { chromium } from '/workspace/work/pw/node_modules/playwright-core/index.mjs';
const url = process.argv[2] || 'http://localhost:4173/pc?debug&dpr=1';
const b = await chromium.launch({ executablePath: '/usr/bin/chromium', args: ['--use-angle=swiftshader','--no-sandbox','--enable-unsafe-swiftshader','--no-proxy-server'] });
const ctx = await b.newContext({ viewport:{width:390,height:844}, deviceScaleFactor:1, isMobile:true, hasTouch:true, locale:'zh-CN' });
const p = await ctx.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message));
await p.goto(url,{waitUntil:'load',timeout:60000});
await p.waitForFunction(()=>window.__pc && window.__pc.state==='overview',null,{timeout:60000});
await p.evaluate(()=>window.__pc.select('cpu'));
await p.waitForFunction(()=>window.__pc.state==='open',null,{timeout:60000});
await p.waitForTimeout(2500);
const cdp = await ctx.newCDPSession(p);
const info = (tag)=>p.evaluate((tag)=>{const e=window.__pc; const it=e.parts.get('cpu').interior; const THREE_V=e.controls.target.constructor;
  const c=new THREE_V(); it.group.getWorldPosition(c);
  // projected center of interior bbox
  const lo=it.meta.bbox[0], hi=it.meta.bbox[1]; const m=new THREE_V((lo[0]+hi[0])/2,(lo[1]+hi[1])/2,(lo[2]+hi[2])/2).applyQuaternion(it.group.quaternion).add(it.group.position);
  const pr=m.clone().project(e.camera); const t=e.controls.target;
  return tag+' target '+[t.x,t.y,t.z].map(v=>v.toFixed(3))+' partC '+[m.x,m.y,m.z].map(v=>v.toFixed(3))+' screen '+((pr.x+1)*195).toFixed(0)+','+((1-pr.y)*422).toFixed(0)+' dist '+e.camera.position.distanceTo(t).toFixed(3)+' disK '+e.disK.toFixed(2);},tag);
console.log(await info('opened'));
const tp=(x,y,id)=>({x,y,id});
async function two(dx1,dy1,dx2,dy2,steps=12){ let a=[195-60,500],c=[195+60,500];
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[tp(...a,1),tp(...c,2)]});
  for(let i=1;i<=steps;i++){ await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[tp(a[0]+dx1*i/steps,a[1]+dy1*i/steps,1),tp(c[0]+dx2*i/steps,c[1]+dy2*i/steps,2)]}); await p.waitForTimeout(16);} 
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]}); }
async function one(dx,dy,steps=12){ let a=[195,500];
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[tp(...a,1)]});
  for(let i=1;i<=steps;i++){ await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[tp(a[0]+dx*i/steps,a[1]+dy*i/steps,1)]}); await p.waitForTimeout(16);} 
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]}); }
await two(120,0,120,0); console.log(await info('2f-swipe-right immediate')); await p.waitForTimeout(1500); console.log(await info('2f +1.5s'));
await two(-60,0,60,0); console.log(await info('pinch-out')); await p.waitForTimeout(1500); console.log(await info('pinch +1.5s'));
await one(150,0); await p.waitForTimeout(1500); console.log(await info('1f horizontal'));
await one(0,-250); await p.waitForTimeout(1500); console.log(await info('1f up'));
await p.screenshot({path:'/workspace/work/redesign/drift.png'});
console.log('errs',errs); await b.close();
