const { chromium } = require('/workspace/work/pw/node_modules/playwright-core');
const VP = [['iPhone SE',320,568,2,true],['iPhone 15',393,852,3,true],['Pro Max',430,932,3,true],['Galaxy Fold 外屏',344,882,3,true],['Fold 内屏',673,841,2,true],['iPad mini 竖',744,1133,2,true],['iPad 竖',820,1180,2,true],['iPad Pro 横',1366,1024,2,true],['安卓平板横',1280,800,1.5,true],['笔记本',1366,768,1,false],['MacBook',1440,900,2,false],['1080p',1920,1080,1,false],['2K',2560,1440,1,false],['横屏手机',852,393,3,true]];
const R = ['/','/lab','/pc','/login','/register','/terms','/privacy','/nope'];
(async () => {
  const b = await chromium.launch({ executablePath: '/usr/bin/chromium', args: ['--no-sandbox','--no-proxy-server','--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
  const out = [];
  for (const [n,w,h,dpr,touch] of VP) {
    const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, hasTouch: touch, isMobile: touch && w < 900 });
    const p = await ctx.newPage();
    for (const r of R) {
      try {
        await p.goto('http://127.0.0.1:4173' + r, { waitUntil: 'domcontentloaded', timeout: 20000 }); await p.waitForTimeout(r==='/lab'?2500:1200);
        const m = await p.evaluate(() => {
          const W = innerWidth, sw = document.documentElement.scrollWidth;
          const off = []; let small = 0, tiny = 0;
          document.querySelectorAll('body *').forEach(e => {
            const rc = e.getBoundingClientRect(); if (!rc.width) return;
            const cs = getComputedStyle(e);
            if (rc.right > W + 2 && cs.position !== 'fixed' && off.length < 4) { let q=e,clip=false; while(q=q.parentElement){const o=getComputedStyle(q).overflowX; if(o==='auto'||o==='scroll'||o==='hidden'){clip=true;break;}} if(!clip) off.push((e.className&&e.className.baseVal===undefined?e.className:e.tagName).toString().slice(0,40)); }
            if ((e.tagName==='BUTTON'||e.tagName==='A'||e.tagName==='INPUT') && rc.height>0 && (rc.height<32||rc.width<32)) small++;
            if (e.childNodes.length && [...e.childNodes].some(c=>c.nodeType===3&&c.textContent.trim()) && parseFloat(cs.fontSize) < 12) tiny++;
          });
          const main = document.querySelector('main, .x-wrap, #root > div'); 
          return { sw, W, off, small, tiny, mw: main ? Math.round(main.getBoundingClientRect().width) : 0 };
        });
        out.push([n, w+'x'+h, r, m.sw > m.W + 1 ? 'OVERFLOW '+m.sw : 'ok', m.off.join('|'), 'small:'+m.small, 'tiny:'+m.tiny, 'main:'+m.mw].join(' \t'));
        if (['/','/lab','/pc'].includes(r)) await p.screenshot({ path: `/workspace/work/rs/${n.replace(/\s/g,'')}${r.replace(/\//g,'_')}.png` });
      } catch (e) { out.push([n, r, 'ERR', String(e).slice(0,80)].join(' ')); }
    }
    await ctx.close();
  }
  console.log(out.join('\n')); await b.close();
})();
