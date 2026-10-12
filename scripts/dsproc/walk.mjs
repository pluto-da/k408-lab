import { chromium } from '/workspace/work/pw/node_modules/playwright-core/index.mjs';
const b = await chromium.launch({ executablePath: '/usr/bin/chromium', args: ['--no-sandbox'] });
const p = await (await b.newContext({ viewport:{width:1300,height:900} })).newPage();
const errs=[]; p.on('pageerror',e=>errs.push(e.message)); p.on('console',m=>{ if(m.type()==='error') errs.push(m.text()); });
await p.goto('file:///workspace/work/dsproc/h.html'); await p.waitForTimeout(300);
const r = await p.evaluate(async () => {
  const out=[];
  for (const d of window.PROC.slice()) {
    window.X_OPEN_PROC(d.id);
    const mb=[...document.querySelectorAll('.x-proc__modes button')];
    for (let m=0;m<Math.max(1,mb.length);m++){
      if(mb[m]) mb[m].click();
      const steps=document.querySelectorAll('.x-proc__steps li button');
      for(const s of steps) s.click();
      for(let i=steps.length-1;i>=0;i--) steps[i].click();
      const err=document.querySelector('.x-proc__err');
      out.push(d.id+'/'+m+':'+steps.length+(err?' ERR '+err.textContent:''));
    }
  }
  return out;
});
console.log(r.join(' | ')); console.log('errs', errs);
await b.close();
