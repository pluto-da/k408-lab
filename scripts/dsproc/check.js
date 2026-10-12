const fs=require('fs'),vm=require('vm'),path=require('path');
const dir='/workspace/fullstack-408/apps/web/public/legacy/js';
const win={__LEGACY_LOADER__:true,addEventListener:()=>{}};win.X={reduced:true};
const ctx=vm.createContext(Object.assign({window:win,document:{readyState:'complete'},setTimeout,X:win.X},{}));
for(const f of ['11-proc-core.js','22-proc-ds.js']){vm.runInContext(fs.readFileSync(path.join(dir,f),'utf8').replace(/window\.PROC/g,'window.PROC'),ctx);}
const PROC=win.PROC||ctx.window.PROC;
function anchor(n,side,off){off=off||0;switch(side){case'l':return[n.x,n.y+n.h/2+off];case'r':return[n.x+n.w,n.y+n.h/2+off];case't':return[n.x+n.w/2+off,n.y];default:return[n.x+n.w/2+off,n.y+n.h];}}
function route(e,N){var A=N[e.a],B=N[e.b];var as=e.as||'r',bs=e.bs||'l';var p0=anchor(A,as,e.ao),p1=anchor(B,bs,e.bo),pts=[p0];if(e.pts)pts=pts.concat(e.pts);else{var hA=as==='l'||as==='r',hB=bs==='l'||bs==='r';if(hA&&hB){if(p0[1]!==p1[1]){var mx=e.mx!=null?e.mx:(p0[0]+p1[0])/2;pts.push([mx,p0[1]],[mx,p1[1]]);}}else if(!hA&&!hB){if(p0[0]!==p1[0]){var my=e.my!=null?e.my:(p0[1]+p1[1])/2;pts.push([p0[0],my],[p1[0],my]);}}else if(hA)pts.push([p1[0],p0[1]]);else pts.push([p0[0],p1[1]]);}pts.push(p1);return pts;}
function labelPos(pts,e){if(e.lp)return e.lp;var best=0,bi=0;for(var i=0;i<pts.length-1;i++){var d=Math.abs(pts[i+1][0]-pts[i][0])+Math.abs(pts[i+1][1]-pts[i][1]);if(d>best){best=d;bi=i;}}return[(pts[bi][0]+pts[bi+1][0])/2,(pts[bi][1]+pts[bi+1][1])/2];}
function tw(s){var w=0;for(var i=0;i<s.length;i++)w+=s.charCodeAt(i)>255?12.5:6.9;return w;}
const ov=(a,b,m=0)=>a.x<b.x+b.w+m&&b.x<a.x+a.w+m&&a.y<b.y+b.h+m&&b.y<a.y+a.h+m;
function segHits(p,q,n){ // segment strictly inside rect interior
  const x1=Math.min(p[0],q[0]),x2=Math.max(p[0],q[0]),y1=Math.min(p[1],q[1]),y2=Math.max(p[1],q[1]);
  return x1<n.x+n.w-1&&x2>n.x+1&&y1<n.y+n.h-1&&y2>n.y+1;}
let issues=0;
for(const p of PROC){for(const m of p.modes){const s=m.make({});const N={};s.nodes.forEach(n=>N[n.id]=n);
 const tag=p.id+'/'+m.name; const real=s.nodes.filter(n=>n.k!=='zone');
 const say=x=>{issues++;console.log(tag+': '+x)};
 if(s.w<860||s.w>980||s.h<380||s.h>640)say('viewBox '+s.w+'x'+s.h);
 for(const n of s.nodes){ if(n.x<0||n.y<0||n.x+n.w>s.w||n.y+n.h>s.h)say('out of bounds '+n.id);
   if(n.k==='table'){const r=(n.rows||[]).length;}
 }
 for(let i=0;i<real.length;i++)for(let j=i+1;j<real.length;j++)if(ov(real[i],real[j]))say('overlap '+real[i].id+' '+real[j].id);
 // table rows fit across all steps
 const st={};s.steps.forEach(x=>{for(const id in x.set||{}){st[id]=Object.assign(st[id]||{},x.set[id]);const n=N[id];if(n.k==='table'){const rows=st[id].rows||n.rows||[];if(26+rows.length*(n.rh||19)>n.h+2)say('table overflow '+id+' rows '+rows.length);
   rows.forEach(r=>{ if(r.length>1){const cols=n.cols||[0.42];const x2=n.w*cols[0]+4; const wcell=tw(r[1])*1.1; if(x2+wcell>n.w-4)say('cell wide '+id+' '+r[1]+' '+Math.round(x2+wcell)+'>'+n.w); if(10+tw(r[0])*1.1>n.w*cols[0]+2)say('key wide '+id+' '+r[0]);}});}}});
 s.nodes.filter(n=>n.k==='table').forEach(n=>{const rows=n.rows||[];if(26+rows.length*(n.rh||19)>n.h+2)say('table overflow init '+n.id)});
 const labels=[];
 for(const e of s.edges){const pts=route(e,N);
   for(let i=0;i<pts.length-1;i++){const a=pts[i],b=pts[i+1];if(a[0]!==b[0]&&a[1]!==b[1])say('diag '+e.id);
     for(const n of real){if(n.id===e.a||n.id===e.b)continue;if(segHits(a,b,n))say('edge '+e.id+' crosses '+n.id);}}
   // endpoints segments shouldn't pass through own nodes interior
   if(e.t){const lp=labelPos(pts,e),w=tw(e.t)+10;const L={x:lp[0]-w/2,y:lp[1]-9,w:w,h:18,id:e.id};labels.push(L);
     for(const n of real)if(ov(L,n))say('label '+e.id+' over node '+n.id);}
 }
 for(let i=0;i<labels.length;i++)for(let j=i+1;j<labels.length;j++)if(ov(labels[i],labels[j]))say('labels overlap '+labels[i].id+' '+labels[j].id);
 // edge crossing among edges
 const segs=[];s.edges.forEach(e=>{const pts=route(e,N);for(let i=0;i<pts.length-1;i++)segs.push([e.id,pts[i],pts[i+1]])});
 for(let i=0;i<segs.length;i++)for(let j=i+1;j<segs.length;j++){const [e1,a,b]=segs[i],[e2,c,d]=segs[j];if(e1===e2)continue;
   const h1=a[1]===b[1],h2=c[1]===d[1];if(h1===h2)continue;const H=h1?[a,b]:[c,d],V=h1?[c,d]:[a,b];
   const y=H[0][1],x=V[0][0];const hx1=Math.min(H[0][0],H[1][0]),hx2=Math.max(H[0][0],H[1][0]),vy1=Math.min(V[0][1],V[1][1]),vy2=Math.max(V[0][1],V[1][1]);
   if(x>hx1+0.5&&x<hx2-0.5&&y>vy1+0.5&&y<vy2-0.5)say('cross '+e1+' x '+e2+' at '+x+','+y);}
 console.log(tag,'steps',s.steps.length);
}}
console.log('issues',issues);
for(const p of PROC){for(const m of p.modes){const s=m.make({});for(const n of s.nodes){if(['box','reg','term'].includes(n.k||'box')){const lines=String(n.t).split('\n');const px=n.sm?13:14;lines.forEach(l=>{let w=0;for(const ch of l)w+=ch.charCodeAt(0)>255?px:px*0.58;if(w>n.w-10)console.log('TEXT',p.id,n.id,l,Math.round(w),n.w)});const lh=n.sm?17:19;if(lines.length*lh>n.h-6)console.log('TEXTH',p.id,n.id,lines.length,n.h);}}}}
