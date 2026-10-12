const { chromium } = require("/workspace/work/pw/node_modules/playwright-core");
const BASE = "http://localhost:4178";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const browser = await chromium.launch({ executablePath: "/usr/bin/chromium", args: ["--no-sandbox", "--no-proxy-server", "--use-gl=swiftshader", "--enable-unsafe-swiftshader"] });
  const page = await (await browser.newContext({ viewport: { width: 1400, height: 900 }, reducedMotion: "reduce", locale: "zh-CN" })).newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push("pageerror " + e));
  page.on("console", (m) => m.type() === "error" && !/api|401|404|Failed to load resource/i.test(m.text()) && errors.push("console " + m.text()));
  await page.goto(BASE + "/lab");
  await page.waitForFunction(() => window.__LEGACY_BOOTED__ === true, null, { timeout: 90000 });
  await sleep(1500);
  const res = {};
  res.footer = await page.$eval(".x-foot", (n) => n.textContent);
  res.chapters = await page.evaluate(() => Object.fromEntries(["ds", "co", "os", "cn"].map((k) => [k, Array.from(document.querySelectorAll("#" + k + " .x-ch button")).map((b) => b.textContent.replace(/★/g, "").trim())])));
  res.metas = await page.$$eval(".x-sec__meta", (ns) => ns.map((n) => n.textContent));
  // 章节卡上的“打开实验”按钮
  res.chapterLabs = await page.evaluate(() => { const out = {}; for (const [k, i] of [["ds", 4], ["ds", 5], ["ds", 7], ["co", 6]]) { const b = document.querySelectorAll("#" + k + " .x-ch button")[i - 1]; b.click(); const card = b.closest(".x-study").querySelector(".x-card") || document; out[k + "-" + i] = Array.from(b.closest("section").querySelectorAll(".x-card__lab")).map((x) => x.textContent); } return out; });

  async function labRun(id, label, marker) {
    await page.evaluate((id) => { const t = document.getElementById("tab-" + id); t.hidden = false; t.click(); }, id);
    await sleep(150);
    const panel = "#lab-" + id;
    if (label) {
      const ok = await page.evaluate(([panel, label]) => { const b = Array.from(document.querySelectorAll(panel + " .x-lab__opts button")).find((x) => x.textContent.trim() === label); if (!b) return false; b.click(); return true; }, [panel, label]);
      if (!ok) return { id, label, err: "preset not found" };
    }
    await sleep(100);
    const outText = () => page.$eval(panel + " .x-lab__out", (n) => n.textContent);
    const init = await outText();
    let prev = init, steps = 0;
    for (; steps < 400; steps++) {
      await page.click(panel + ' [data-a="step"]');
      const t = await outText();
      if (steps > 0 && t === init) break; // 回到初始 = 上一帧是终点
      prev = t;
    }
    const err = await page.$(panel + " .x-lab__err");
    return { id, label, steps, err: err ? await err.textContent() : null, out: prev, hit: marker ? marker.every((m) => prev.includes(m)) : undefined };
  }
  res.labs = [];
  const L = [
    ["disk", "经典示例（53）"], ["disk", "示例二（140·向小）", ["165"]], ["disk", "经典示例·向小"], ["partition", "默认序列"], ["prodcons", "默认脚本"], ["booth", null],
    ["graphtrav", "示例一·8 顶点无向图", ["1 2 5 3 6 8 7 4"]], ["mst", "示例一·6 顶点（权值和 14）", ["14"]],
    ["topo", "示例 AOV（6 顶点·两个入度为 0）", ["2 5 1 4 3 6"]], ["topo", "示例 AOE（7 事件 9 活动·3 条关键路径）", ["1→2→5→7", "1→3→5→7", "1→3→6→7", "11"]], ["topo", "经典 AOE（9 事件 11 活动）", ["18"]],
    ["floyd", "示例二·4 顶点（多次中转）"], ["hash", null, ["91/13"]], ["huffman", "经典示例·8 字符"], ["kmp", null], ["cqueue", "默认脚本"], ["rip", "示例一"], ["bsearch", "经典示例：查 21"], ["banker", null], ["sort2", "经典示例·希尔"], ["sort2", "经典示例·增量 5,3,1"],
  ];
  for (const [id, label, mk] of L) { try { res.labs.push(await labRun(id, label, mk)); } catch (e) { res.labs.push({ id, label, err: String(e) }); } }
  // MST：切换 Kruskal 再跑
  try {
    await page.evaluate(() => { const b = Array.from(document.querySelectorAll("#lab-mst .x-lab__opts button")).find((x) => x.textContent.includes("Kruskal")); b.click(); });
    res.labs.push(await labRun("mst", "示例一·6 顶点（权值和 14）", ["14"]));
  } catch (e) { res.labs.push({ id: "mst-kruskal", err: String(e) }); }
  // topo：切到队列
  try {
    await page.evaluate(() => { const b = Array.from(document.querySelectorAll("#lab-topo .x-lab__opts button")).find((x) => x.textContent.includes("用队列")); b.click(); });
    res.labs.push(await labRun("topo", "示例 AOV（6 顶点·两个入度为 0）", ["1 2 3 4 5 6"]));
  } catch (e) { res.labs.push({ id: "topo-queue", err: String(e) }); }
  // hash：三种约定按钮
  for (const lb of ["常见约定", "空位计 1 次", "空位不计"]) {
    await page.evaluate((lb) => { const b = Array.from(document.querySelectorAll("#lab-hash .x-lab__opts button")).find((x) => x.textContent.trim() === lb); b.click(); }, lb);
    const r = await labRun("hash", null); r.label = "约定：" + lb; r.out = (r.out.match(/ASL失败[^）]*/g) || []).slice(0, 2).join(" | "); res.labs.push(r);
  }
  // 过程图解：建堆、插入、删除、置换-选择、败者树
  async function procRun(id, modeName, presetLabel) {
    await page.evaluate((id) => window.X_OPEN_PROC(id), id);
    await sleep(200);
    if (modeName) await page.evaluate((m) => { const b = Array.from(document.querySelectorAll(".x-proc__opts button")).find((x) => x.textContent.trim() === m); if (b) b.click(); }, modeName);
    await sleep(100);
    if (presetLabel) { const ok = await page.evaluate((m) => { const b = Array.from(document.querySelectorAll(".x-proc__opts button")).find((x) => x.textContent.trim() === m); if (b) { b.click(); return true; } return false; }, presetLabel); if (!ok) return { id, modeName, presetLabel, err: "preset not found" }; }
    await sleep(150);
    let n = 0;
    while (n < 300 && !(await page.$eval('.x-proc__ctrl [data-a="next"]', (b) => b.disabled))) { await page.click('.x-proc__ctrl [data-a="next"]'); n++; }
    const kv = await page.$eval(".x-proc__kv", (k) => k.textContent);
    const t = await page.$eval(".x-proc__t", (k) => k.textContent);
    return { id, modeName, presetLabel, steps: n, title: t, kv };
  }
  res.procs = [];
  for (const a of [["heapop", "建堆（筛选法）", "示例一（10 个，多层下沉）"], ["heapop", "插入（上浮）", null], ["heapop", "删除堆顶（下沉）", null], ["extsort", "置换—选择排序（WA = 3）", null], ["extsort", "败者树（k = 5）", null], ["rbtree", null, null], ["linklist", null, null], ["forest", "遍历对应关系", null]]) {
    try { res.procs.push(await procRun(...a)); } catch (e) { res.procs.push({ a, err: String(e) }); }
  }
  // 性质：打开改动过的条目
  res.props = [];
  for (const id of ["ds-bsearch", "ds-degree", "ds-btree", "ds-rbtree", "ds-complete", "ds-forest", "co-hamming", "co-cache-ta", "co-opcode", "os-semaphore", "os-belady", "os-bitmap", "cn-cwnd"]) {
    const ok = await page.evaluate((id) => !!(window.X_PROP && window.X_PROP.open(id, false)), id);
    await sleep(120);
    const meta = await page.evaluate(() => { const c = document.querySelector(".x-prop__meta"); return c ? c.textContent : null; });
    res.props.push({ id, ok, meta });
  }
  // co-opcode 的“经典示例”按钮
  res.opcodeBtn = await page.evaluate(() => { window.X_PROP.open("co-opcode", false); const b = Array.from(document.querySelectorAll(".x-prop button")).find((x) => x.textContent.startsWith("经典示例")); if (!b) return "missing"; b.click(); return b.textContent; });
  res.html = await page.content();
  res.errors = errors;
  require("fs").writeFileSync("/workspace/work/srcfix/pw-result.json", JSON.stringify({ ...res, html: undefined }, null, 1));
  require("fs").writeFileSync("/workspace/work/srcfix/page.html", res.html);
  await page.screenshot({ path: "/workspace/work/srcfix/last.png" });
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
