const fs=require('fs');const src=fs.readFileSync('check.js','utf8').split('let issues=0;')[0];
eval(src+`
const out=[];for(const p of PROC){for(const m of p.modes){const s=m.make({});const N={};s.nodes.forEach(n=>N[n.id]=n);
out.push({tag:p.id+'/'+m.name,w:s.w,h:s.h,nodes:s.nodes,edges:s.edges.map(e=>{const pts=route(e,N);return {pts,t:e.t||null,lp:e.t?labelPos(pts,e):null,lw:e.t?tw(e.t)+10:0}})});}}
fs.writeFileSync('specs.json',JSON.stringify(out));`);
