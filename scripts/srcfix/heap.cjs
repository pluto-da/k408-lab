const w=require("./load.cjs")(["22-proc-ds.js"]);const DS=w.PROCU.ds;const P=w.PROC;
const pm=P.find(p=>p.id==="heapop");
function trace(a){ // independent re-implementation for hand-check (sift-down log)
  const A=[null,...a],n=a.length;let cmp=0,log=[];
  for(let i=n>>1;i>=1;i--){let k=i,path=[];while(2*k<=n){let j=2*k;if(j<n){cmp++;if(A[j+1]<A[j])j++;}cmp++;if(A[j]<A[k]){path.push(A[k]+"↔"+A[j]);[A[j],A[k]]=[A[k],A[j]];k=j;}else break;}log.push("i="+i+": "+(path.join(", ")||"不动")+" → "+A.slice(1).join(" "));}
  return {heap:A.slice(1),cmp,log};
}
for (const s of process.argv.slice(2)) { const a=s.split(/\s+/).map(Number); const b=DS.buildHeap(a), t=trace(a);
 console.log(s,"=>",b.heap.join(" "),"cmp",b.cmp, JSON.stringify(t.heap)===JSON.stringify(b.heap)); t.log.forEach(l=>console.log("   ",l));
 // insert 13 and delete top via the spec steps
 const ins=pm.modes[1].make({heap:s,hkey:"13"}), del=pm.modes[2].make({heap:s});
 const last=(sp)=>{const st=sp.steps;for(let i=st.length-1;i>=0;i--){const x=st[i].set&&st[i].set.ARR;if(x&&x.segs)return x.segs.map(g=>g.v).filter(v=>v&&v.trim()).join(" ");}};
 const kv=(sp)=>{for(let i=sp.steps.length-1;i>=0;i--) if(sp.steps[i].kv) return JSON.stringify(sp.steps[i].kv)};
 console.log("  build kv",kv(pm.modes[0].make({heap:s})));
 console.log("  ins13",last(ins),kv(ins)); console.log("  del",last(del),kv(del));
}
console.log("RS old",JSON.stringify(DS.replSel([17,21,5,44,10,12,56,32,29],3).runs));
for (const s of ["32 18 45 9 27 51 14 38 6 22","36 15 48 21 9 40 27 12 33 6 45","24 31 8 47 19 52 13 40 6 28"]) console.log("RS",s,JSON.stringify(DS.replSel(s.split(" ").map(Number),3).runs));
