const { chromium } = require("/workspace/work/pw/node_modules/playwright-core");
(async () => {
  const b = await chromium.launch({ executablePath: "/usr/bin/chromium", args: ["--no-sandbox","--no-proxy-server"] });
  const ctx = await b.newContext({ viewport: { width: 360, height: 660 }, hasTouch: true, isMobile: true });
  const p = await ctx.newPage();
  await p.goto("http://127.0.0.1:4192/lab");
  await p.waitForFunction(() => window.X_LAB_ACT && window.X_OPEN_LAB, null, { timeout: 60000 });
  await p.evaluate(() => window.X_OPEN_LAB("gantt"));
  await new Promise(r=>setTimeout(r,500));
  const o = await p.evaluate(() => {
    const pan=[...document.querySelectorAll(".x-lab__panel")].find(x=>!x.hidden);
    const st=pan.querySelector(".x-lab__stage"), c=pan.querySelector(".x-lab__ctrl");
    st.scrollIntoView();
    const r=st.getBoundingClientRect(), rc=c.getBoundingClientRect();
    return {id:pan.id, st:[r.top,r.bottom,r.height], ctrl:[rc.top,rc.bottom,rc.width, getComputedStyle(c).position], H:innerHeight, kids:[...st.children].map(e=>e.className+":"+Math.round(e.getBoundingClientRect().height)), parent: st.parentElement.className};
  });
  console.log(JSON.stringify(o));
  await p.screenshot({path:"/workspace/work/v20/dbg-gantt.png"});
  await b.close();
})();
