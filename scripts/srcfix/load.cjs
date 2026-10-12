const fs=require('fs'),vm=require('vm');
const D='/workspace/fullstack-408/apps/web/public/legacy/js/';
module.exports=function(files){
  const win={LAB:[],PROC:[],PROP:[]};
  const X={reduced:true,svg(){return {}},el(){return {}}};
  win.X=X;
  const ctx=new Proxy({window:win,X,console,Error,Object,Array,JSON,Math,Number,String,parseInt,parseFloat,isNaN,isFinite,RegExp,Date,Infinity,NaN,undefined},{
    get:(t,k)=>k in t?t[k]:win[k], has:()=>true, set:(t,k,v)=>{t[k]=v;win[k]=v;return true}});
  vm.createContext(ctx);
  for(const f of files) vm.runInContext(fs.readFileSync(D+f,'utf8'),ctx);
  return win;
}
