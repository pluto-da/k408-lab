const fs=require('fs');const vm=require('vm');
const win={LAB:[]};const ctx={window:win,Math,JSON,Object,Array,String,Number,parseInt,parseFloat,isNaN,Error};
vm.runInNewContext(fs.readFileSync('public/legacy/js/19-lab-ds1.js','utf8'),new Proxy(ctx,{get:(t,k)=>k in t?t[k]:win[k],has:()=>true,set:(t,k,v)=>{t[k]=v;win[k]=v;return true}}));
const U=win.LABU;
let r=U.dsInfix('a+b*(c-d)-e/f');console.log(r.postfix,r.maxDepth,r.maxOps);
r=U.dsInfix('3+4*(2-1)-6/3');console.log(r.postfix,r.value);
r=U.dsInfix('a+b-a*((c+d)/e-f)+g');console.log(r.postfix,r.maxDepth,r.maxOps);
console.log(U.dsInfix('(a+b').err, U.dsInfix('a+b)').err, U.dsInfix('-a').err, U.dsInfix('ab').err);
console.log(U.dsKmpNext('abaabc').next.join(' '),U.dsKmpNextval('abaabc').join(' '));
console.log(U.dsKmpMatch('abaabaabcabaabc','abaabc',U.dsKmpNext('abaabc').next).cmp, U.dsNaiveMatch('abaabaabcabaabc','abaabc').cmp);
console.log(U.dsKmpNext('ababaaababaa').next.join(' '), U.dsKmpNextval('aabaab').join(' '));
r=U.dsHuffman('7 5 2 4');console.log(r.wpl,r.total);
r=U.dsHuffman('3 4 5 6 8 10');console.log(r.wpl,r.sumW, r.wpl/r.sumW);
r=U.dsHuffman('a:5 b:29 c:7 d:8 e:14 f:23 g:3 h:11');console.log(r.wpl);
r=U.dsAvlInsert(U.dsAvlInsert(U.dsAvlInsert(null,3).root,2).root,1);console.log(r.rot,r.root.k);
for (const seq of ['20 10 5 30 40 25 23 8 9','3 2 1 4 5 6 7 16 15 14']) { const f=U.dsBstFrames(seq.split(' ').map(Number),{avl:true}); console.log(seq,f.rots, f.frames.length); }
let f=U.dsBstFrames([50,30,70,20,40,60,80,35,45,65],{dels:[20,60,30,50]}); console.log(f.frames.length, U.dsInorder(f.root).join(' '), f.asl.expr);
f.frames.filter(x=>x.ph==='del'||x.ph==='deld').forEach(x=>console.log(' ',x.d));
for (const [m,ks,ds] of [[3,'53 75 139 49 145 36 101 20 66 88','36 145 53 88'],[4,'5 6 9 13 8 2 12 15',''],[3,'10 20 30 40 50 60 70 80 90','40 10 90'],[5,'1 2 3 4 5 6 7 8 9 10 11 12 13','4 3 13 8']]) {
  const b=U.dsBtree(m,ks.split(' ').map(Number),ds?ds.split(' ').map(Number):[]); console.log(m, b.root.keys, b.check, b.frames.length, [...new Set(b.frames.map(x=>x.ph).filter(Boolean))].join(','));
}
let u=U.dsUfRun(8,U.dsUfParse('U 1 0, U 2 1, U 3 2, U 4 3, U 5 6, U 7 5, U 4 7, F 0, F 6, F 0',8).ops,'plain',false);console.log(u.height,u.visits);
u=U.dsUfRun(8,U.dsUfParse('Union(1,0) Find(3) 合并 2 3',8).ops,'rank',true);console.log(u.height,u.visits, U.dsUfParse('U 1 9',8).err);
let c=U.dsCqRun(6,'sac',U.CQ_DEF);console.log(c.frames.map(x=>x.ok).join(','), c.s.front,c.s.rear,U.dsCqLen(c.s,'sac')); c.frames.slice(-3).forEach(x=>console.log(x.d));
console.log(win.LAB.map(l=>l.id));
