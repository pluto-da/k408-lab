const fs=require('fs'),vm=require('vm');
const dir='/workspace/fullstack-408/apps/web/public/legacy/js/';
const win={__LEGACY_LOADER__:true,addEventListener:()=>{}};win.X={reduced:true};
const ctx=vm.createContext({window:win,document:{readyState:'complete'},setTimeout,X:win.X});
for(const f of ['11-proc-core.js','22-proc-ds.js'])vm.runInContext(fs.readFileSync(dir+f,'utf8'),ctx);
const [id,mi]=process.argv.slice(2);const p=win.PROC.find(x=>x.id===id);const s=p.modes[+mi].make({});
s.steps.forEach((st,i)=>console.log(i+1,'|',st.t,'|',st.d,'|',JSON.stringify(st.kv||{}),st.tip?'| TIP '+st.tip:''));
