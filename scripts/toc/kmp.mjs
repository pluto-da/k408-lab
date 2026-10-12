import { chromium } from '/workspace/work/pw/node_modules/playwright-core/index.mjs';
const b = await chromium.launch({ executablePath: '/usr/bin/chromium', args: ['--no-sandbox','--no-proxy-server'] });
const ctx = await b.newContext({ viewport:{width:1366,height:768} });
const p = await ctx.newPage();
await p.goto(process.argv[2]+'/lab#lab-kmp'); await p.waitForFunction(() => window.__LEGACY_BOOTED__);
for (let i=0;i<5;i++){ console.log(await p.evaluate(()=>({y:scrollY, lab: Math.round(document.getElementById('lab').getBoundingClientRect().top+scrollY), cn: Math.round(document.getElementById('cn').getBoundingClientRect().top+scrollY), H: document.documentElement.scrollHeight, kmp: document.getElementById('tab-kmp')?.getAttribute('aria-selected')}))); await p.waitForTimeout(300); }
await b.close();
