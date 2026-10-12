const w=require("./load.cjs")(["20-lab-ds2.js"]);const U=w.LABU;
const nm=(g,a)=>a.map(i=>g.V[i]).join(" ");
let g=U.dsParseEdges("1-8","1-2, 1-3, 1-4, 2-5, 3-5, 3-6, 4-7, 5-8, 6-8, 7-8",{});
console.log("err",g.err);
for (const s of [0,2]) console.log("DFS",s+1,nm(g,U.dsDfs(g,s).order),"| BFS",nm(g,U.dsBfs(g,s).order));
console.log("dfs tree",U.dsDfs(g,0).tree.map(([p,c])=>g.V[p]+g.V[c]).join(" "));
console.log("bfs tree",U.dsBfs(g,0).tree.map(([p,c])=>g.V[p]+g.V[c]).join(" "));
g=U.dsParseEdges("1-6","1-2:4, 1-3:2, 2-3:3, 2-4:5, 3-4:6, 3-5:4, 4-5:3, 4-6:2, 5-6:5",{weighted:true});
let p=U.dsPrim(g,0),k=U.dsKruskal(g);const es=m=>m.edges.map(([a,b])=>g.V[a]+g.V[b]).join(" ");
console.log("MST",p.total,k.total,"prim",es(p),"kru",es(k));
g=U.dsParseEdges("1-6","1->3, 1->4, 2->4, 2->5, 3->6, 4->6, 5->6",{directed:true});
for(const q of [false,true]){const t=U.dsTopo(g,q);console.log("topo",q?"queue":"stack",nm(g,t.order),t.cycle);}
g=U.dsParseEdges("1-7","1->2:3, 1->3:4, 1->4:2, 2->5:4, 3->5:3, 3->6:5, 4->6:4, 5->7:4, 6->7:2",{directed:true,weighted:true});
let c=U.dsCritical(g);console.log("AOE",c.err,c.ve,c.vl,c.crit.map(x=>"a"+(x+1)),c.len,c.paths.map(p=>p.map(i=>g.V[i]).join("")));
console.log(c.acts.map(a=>"a"+(a.k+1)+" e"+a.e+" l"+a.l+" d"+a.d).join(", "));
g=U.dsParseEdges("0-3","0->1:2, 0->2:9, 1->2:3, 1->3:8, 2->0:4, 2->3:1, 3->0:6",{directed:true,weighted:true});
let f=U.dsFloyd(g);console.log("Floyd",JSON.stringify(f.A),JSON.stringify(f.path),f.frames.length);
for(let i=0;i<4;i++)for(let j=0;j<4;j++)if(i!=j)console.log(i,j,U.dsFloydPath(f.A,f.path,i,j).join("→"));
f.frames.forEach(fr=>console.log("k",fr.k,JSON.stringify(fr.ch)));
