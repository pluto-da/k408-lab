import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";
import { beforeEach, describe, expect, it } from "vitest";

/** 实验室折叠目录（29-toc.js）：纯状态函数在无 DOM 的 node 沙箱里测；DOM 层在 jsdom 里用真实 body.html 的目录结构 + 假标签页测 */
interface Item { kind: string; id: string; course?: string | null; label: string; full?: string }
interface State { open: string[]; auto: string[]; pin?: string[] }
interface TocU {
  TOP: string[];
  KEY: string;
  norm(s: string): string;
  groupsOf(it: Partial<Item>): string[];
  toggle(open: string[], id: string): string[];
  ensureOpenFor(open: string[], active: Partial<Item>, items?: Item[]): string[];
  matchItems(items: Item[], filter: string, labels?: Record<string, string>): { items: Item[]; open: string[]; groups: string[]; active: boolean };
  serialize(open: string[]): string;
  parse(s: string | null, valid?: string[]): string[];
  follow(st: State, need: string[]): State;
  manual(st: State, id: string): State;
  persisted(st: State): string[];
  fromHash(h: string): { kind: string; id: string } | null;
  courseOfColor(c: string): string | null;
  _build(): void;
}
type Win = Window & {
  TOCU?: TocU; LAB?: unknown[]; PROC?: unknown[]; PROP?: unknown[]; X408?: unknown; __LEGACY_LOADER__?: boolean;
  X_TOC?: { state(): { open: string[]; auto: string[]; pin: string[]; filter: string } };
  X_OPEN_CHAPTER?: (c: string, i: number) => boolean;
};

const LEGACY = resolve(__dirname, "../../public/legacy");
const SRC = readFileSync(resolve(LEGACY, "js/29-toc.js"), "utf8");
const BODY = readFileSync(resolve(LEGACY, "body.html"), "utf8");

function loadNode(): TocU {
  const win: Record<string, unknown> = {};
  runInNewContext(SRC, { window: win, console });
  return win.TOCU as TocU;
}

describe("TOCU 纯函数（node，无 DOM）", () => {
  const U = loadNode();
  const items: Item[] = [
    { kind: "lab", id: "kmp", course: "ds", label: "KMP 与 next 数组" },
    { kind: "lab", id: "tcp", course: "cn", label: "TCP 拥塞控制" },
    { kind: "proc", id: "dns", course: "cn", label: "DNS 解析" },
    { kind: "prop", id: "ds-leaf", course: "ds", label: "二叉树叶子结点数：n₀ = n₂ + 1" },
    { kind: "prop", id: "cn-tcp", course: "cn", label: "TCP 三次握手的序号" },
    { kind: "ch", id: "os:2", course: "os", label: "内存管理" },
  ];

  it("toggle 展开与收起，不产生重复", () => {
    expect(U.toggle([], "lab")).toEqual(["lab"]);
    expect(U.toggle(["lab", "prop"], "lab")).toEqual(["prop"]);
    expect(U.toggle(["lab", "lab"], "prop")).toEqual(["lab", "prop"]);
  });
  it("ensureOpenFor 对实验、图解、性质、章节都展开正确的组", () => {
    expect(U.ensureOpenFor([], { kind: "lab", id: "kmp", course: "ds" })).toEqual(["lab", "lab:ds"]);
    expect(U.ensureOpenFor(["prop"], { kind: "proc", id: "dns" }, items)).toEqual(["prop", "proc", "proc:cn"]);
    expect(U.ensureOpenFor([], { kind: "prop", id: "cn-tcp" }, items)).toEqual(["prop", "prop:cn"]);
    expect(U.ensureOpenFor(["lab"], { kind: "ch", id: "os:2" })).toEqual(["lab", "os"]);
    expect(U.ensureOpenFor(["lab"], null as unknown as Item)).toEqual(["lab"]);
  });
  it("matchItems：中英文、大小写、下标字符、空白不敏感", () => {
    const tcp = U.matchItems(items, "tcp");
    expect(tcp.items.map((x) => x.id)).toEqual(["tcp", "cn-tcp"]);
    expect(tcp.open).toEqual(["lab", "lab:cn", "prop", "prop:cn"]);
    expect(tcp.groups).toEqual(["lab", "prop"]);
    expect(U.matchItems(items, "n0=n2+1").items.map((x) => x.id)).toEqual(["ds-leaf"]);
    expect(U.matchItems(items, "N₀").items.map((x) => x.id)).toEqual(["ds-leaf"]);
    expect(U.matchItems(items, "内存").items.map((x) => x.id)).toEqual(["os:2"]);
    expect(U.matchItems(items, "ＴＣＰ").items).toHaveLength(2);
    expect(U.matchItems(items, "主板", { board: "3D 主板" }).groups).toEqual(["board"]);
    expect(U.matchItems(items, "  ").active).toBe(false);
    expect(U.matchItems(items, "不存在的词").items).toEqual([]);
  });
  it("serialize / parse 往返，损坏数据返回空集合，过滤已不存在的组", () => {
    const s = U.serialize(["lab", "lab:ds", "lab"]);
    expect(U.parse(s)).toEqual(["lab", "lab:ds"]);
    expect(U.parse("{oops")).toEqual([]);
    expect(U.parse(null)).toEqual([]);
    expect(U.parse('{"a":1}')).toEqual([]);
    expect(U.parse('["lab", 3, null, "gone"]', ["lab", "prop"])).toEqual(["lab"]);
  });
  it("follow：进入新区块时展开所需组，收回之前自动展开的组，保留用户手动展开的组", () => {
    let st: State = { open: ["proc"], auto: [] };
    st = U.follow(st, ["lab", "lab:ds"]);
    expect(st).toEqual({ open: ["proc", "lab", "lab:ds"], auto: ["lab", "lab:ds"], pin: [] });
    st = U.follow(st, ["prop", "prop:cn"]);
    expect(st.open).toEqual(["proc", "prop", "prop:cn"]);
    /* 手动收起一个自动展开的组后，它不再算自动 */
    st = U.manual(st, "prop:cn");
    expect(st.open).toEqual(["proc", "prop"]);
    expect(U.persisted(st)).toEqual(["proc"]);
    st = U.manual(st, "prop");
    st = U.manual(st, "prop");
    expect(U.persisted(st)).toEqual(["proc", "prop"]);
    /* 锚点展开（pin）：follow 不收回，也不持久化；手动切换后才算用户的 */
    let pt: State = { open: ["lab", "lab:ds"], auto: [], pin: ["lab", "lab:ds"] };
    pt = U.follow(pt, ["board"]);
    expect(pt.open).toEqual(["lab", "lab:ds", "board"]);
    expect(U.persisted(pt)).toEqual([]);
    pt = U.manual(U.manual(pt, "lab"), "lab");
    expect(U.persisted(pt)).toEqual(["lab"]);
  });
  it("fromHash 与 courseOfColor", () => {
    expect(U.fromHash("#prop-ds-leaf")).toEqual({ kind: "prop", id: "ds-leaf" });
    expect(U.fromHash("#lab-kmp")).toEqual({ kind: "lab", id: "kmp" });
    expect(U.fromHash("#proc-dns")).toEqual({ kind: "proc", id: "dns" });
    expect(U.fromHash("#lab")).toBeNull();
    expect(U.courseOfColor("var(--x-cn)")).toBe("cn");
    expect(U.courseOfColor("#888")).toBeNull();
  });
});

/* ---------- jsdom：真实目录结构 + 假标签页 ---------- */
const TOC_HTML = /<nav class="x-toc"[\s\S]*?<\/nav>/.exec(BODY)![0];
const SUBS = ["ds", "co", "os", "cn"];
const COUNTS = { lab: [3, 2, 2, 1], proc: [1, 2, 0, 3], prop: [2, 2, 2, 2] };

function page() {
  const w = window as Win;
  w.LAB = []; w.PROC = []; w.PROP = [];
  let labTabs = "", procTabs = "", propItems = "";
  SUBS.forEach((s, si) => {
    for (let i = 0; i < COUNTS.lab[si]!; i++) {
      const id = `${s}l${i}`;
      w.LAB!.push({ id, name: `实验 ${id}`, color: `var(--x-${s})` });
      labTabs += `<button class="x-lab__tab" id="tab-${id}" aria-selected="${s === "ds" && i === 0}">实验 ${id}${s === "cn" ? " TCP" : ""}</button>`;
    }
    for (let i = 0; i < COUNTS.proc[si]!; i++) {
      const id = `${s}p${i}`;
      w.PROC!.push({ id, name: `图解 ${id}`, sub: s });
      procTabs += `<button class="x-proc__tab" id="ptab-${id}">图解 ${id}</button>`;
    }
    for (let i = 0; i < COUNTS.prop[si]!; i++) {
      const id = `${s}-q${i}`;
      w.PROP!.push({ id, name: s === "ds" && i === 1 ? "叶子结点数 n₀ = n₂ + 1" : `性质 ${id}`, sub: s });
      propItems += `<button class="x-prop__item" data-id="${id}"><span class="x-prop__in">${s === "ds" && i === 1 ? "叶子结点数 n₀ = n₂ + 1" : "性质 " + id}</span></button>`;
    }
  });
  w.X408 = Object.fromEntries(SUBS.map((s, i) => [s, { chapters: Array.from({ length: 3 + i }, (_, k) => ({ no: k + 1, title: `${s} 第${k + 1}章` })) }]));
  const chapters = SUBS.map((s, i) => `<section id="${s}"><div class="x-study" data-subject="${s}"><ul class="x-ch">${Array.from({ length: 3 + i }, (_, k) => `<li><button aria-pressed="${k === 0}">${k}</button></li>`).join("")}</ul></div></section>`).join("");
  document.body.innerHTML = `<div class="x-tool" id="x-tool"></div>${TOC_HTML}<header id="overview"></header>${chapters}
    <section id="lab"><div id="x-lab">${labTabs}</div></section><section id="proc"><div id="x-proc">${procTabs}</div></section>
    <section id="prop"><div id="x-prop">${propItems}</div></section><section id="board"></section><section id="links"></section>`;
  w.__LEGACY_LOADER__ = true;
  new Function(SRC)();
  w.TOCU!._build();
  return w;
}
const $ = (s: string) => document.querySelector(s) as HTMLElement;
const $$ = (s: string) => Array.from(document.querySelectorAll(s)) as HTMLElement[];
const fire = (detail: Record<string, unknown>) => document.dispatchEvent(new CustomEvent("x:active", { detail }));

describe("目录 DOM（jsdom）", () => {
  beforeEach(() => {
    localStorage.clear();
    history.replaceState(null, "", "/lab");
  });

  it("顶层 10 组，保留原 href 与 id；三个大组按课程二级分组，数量之和等于总数，空课程不渲染", () => {
    page();
    const tops = $$(".x-toc > ol > li > a");
    expect(tops.map((a) => a.getAttribute("href"))).toEqual(["#overview", "#ds", "#co", "#os", "#cn", "#lab", "#proc", "#prop", "#board", "#links"]);
    expect($("#x-toc-labs") && $("#x-toc-procs") && $("#x-toc-props")).toBeTruthy();
    for (const k of ["lab", "proc", "prop"] as const) {
      const total = COUNTS[k].reduce((a, b) => a + b, 0);
      const subs = $$(`.x-toc__g[data-g="${k}"] .x-toc__sg`);
      expect(subs).toHaveLength(COUNTS[k].filter(Boolean).length);
      expect(subs.reduce((n, s) => n + s.querySelectorAll(".x-toc__items > li").length, 0)).toBe(total);
      expect($(`.x-toc__g[data-g="${k}"] > .x-toc__tg .x-vh`).textContent).toBe(`${total} 项`);
    }
    expect($$(`.x-toc__g[data-g="co"] .x-toc__sub > li`)).toHaveLength(4);
    expect($$(".x-toc__g--leaf").map((li) => li.dataset.g)).toEqual(["overview", "board", "links"]);
  });

  it("展开按钮切换 aria-expanded / hidden / inert，并写入 localStorage；收起后子列表不可聚焦", () => {
    page();
    const tg = $('.x-toc__g[data-g="lab"] > .x-toc__tg');
    const w = document.getElementById(tg.getAttribute("aria-controls")!)!;
    expect(tg.getAttribute("aria-expanded")).toBe("false");
    expect(w.hidden).toBe(true);
    tg.click();
    expect(tg.getAttribute("aria-expanded")).toBe("true");
    expect(w.hidden).toBe(false);
    expect(w.hasAttribute("inert")).toBe(false);
    expect(tg.querySelector(".x-toc__say")!.textContent).toBe("收起动画实验");
    expect(JSON.parse(localStorage.getItem("x408.toc.open")!)).toEqual(["lab"]);
    const sh = $('.x-toc__sg[data-g="lab:ds"] > .x-toc__sh');
    sh.click();
    expect(sh.getAttribute("aria-expanded")).toBe("true");
    tg.click();
    expect(w.hasAttribute("inert")).toBe(true);
    expect(w.hidden).toBe(true); /* jsdom 里目录不可见，不做动画，立即隐藏 */
    expect(JSON.parse(localStorage.getItem("x408.toc.open")!)).toEqual(["lab:ds"]);
  });

  it("刷新后恢复展开状态，忽略已不存在的组 id；localStorage 损坏时不报错", () => {
    localStorage.setItem("x408.toc.open", JSON.stringify(["prop", "prop:cn", "lab:gone"]));
    page();
    expect($('.x-toc__g[data-g="prop"] > .x-toc__tg').getAttribute("aria-expanded")).toBe("true");
    expect($('.x-toc__sg[data-g="prop:cn"] > .x-toc__sh').getAttribute("aria-expanded")).toBe("true");
    expect((window as Win).X_TOC!.state().open).toEqual(["prop", "prop:cn"]);
    localStorage.setItem("x408.toc.open", "{broken");
    expect(() => page()).not.toThrow();
    expect((window as Win).X_TOC!.state().open).toEqual([]);
  });

  it("锚点 #prop-<id> 进入：展开性质组与对应课程二级组，条目高亮", () => {
    history.replaceState(null, "", "/lab#prop-cn-q1");
    page();
    expect($('.x-toc__g[data-g="prop"] > .x-toc__tg').getAttribute("aria-expanded")).toBe("true");
    expect($('.x-toc__sg[data-g="prop:cn"] > .x-toc__sh').getAttribute("aria-expanded")).toBe("true");
    expect($('.x-toc__sg[data-g="prop:ds"] > .x-toc__sh').getAttribute("aria-expanded")).toBe("false");
    expect($('a[data-prop="cn-q1"]').getAttribute("aria-current")).toBe("true");
    expect($('a[data-prop="cn-q1"]').getAttribute("href")).toBe("#prop-cn-q1");
    /* 锚点展开不写入 localStorage，离开区块也不收回 */
    expect(localStorage.getItem("x408.toc.open")).toBeNull();
    document.dispatchEvent(new CustomEvent("x:section", { detail: { id: "board" } }));
    expect($('.x-toc__sg[data-g="prop:cn"] > .x-toc__sh').getAttribute("aria-expanded")).toBe("true");
    $('.x-toc__g[data-g="lab"] > .x-toc__tg').click();
    expect(JSON.parse(localStorage.getItem("x408.toc.open")!)).toEqual(["lab"]);
  });

  it("x:active 联动：用户切换条目时高亮并展开所在组；初始默认选中只高亮不展开", () => {
    page();
    expect($('a[data-lab="dsl0"]').getAttribute("aria-current")).toBe("true");
    fire({ kind: "lab", id: "osl1", user: false });
    expect($('a[data-lab="osl1"]').getAttribute("aria-current")).toBe("true");
    expect($('a[data-lab="dsl0"]').hasAttribute("aria-current")).toBe(false);
    expect($('.x-toc__g[data-g="lab"] > .x-toc__tg').getAttribute("aria-expanded")).toBe("false");
    fire({ kind: "proc", id: "cnp2", user: true });
    expect($('a[data-proc="cnp2"]').getAttribute("aria-current")).toBe("true");
    expect($('.x-toc__sg[data-g="proc:cn"] > .x-toc__sh').getAttribute("aria-expanded")).toBe("true");
    fire({ kind: "ch", id: "os:2", user: true });
    expect($('a[data-ch="os:2"]').getAttribute("aria-current")).toBe("true");
    expect($('a[data-ch="ds:0"]').getAttribute("aria-current")).toBe("true"); /* 每门课各自的当前章节 */
    expect($('.x-toc__g[data-g="os"] > .x-toc__tg').getAttribute("aria-expanded")).toBe("true");
  });

  it("点页面上的章节按钮派发 x:active；X_OPEN_CHAPTER 切到该章", () => {
    const w = page();
    const btns = $$("#co .x-ch button");
    btns[2]!.click();
    expect($('a[data-ch="co:2"]').getAttribute("aria-current")).toBe("true");
    let clicked = -1;
    $$("#cn .x-ch button")[3]!.addEventListener("click", () => { clicked = 3; });
    expect(w.X_OPEN_CHAPTER!("cn", 3)).toBe(true);
    expect(clicked).toBe(3);
    expect($('a[data-ch="cn:3"]').getAttribute("aria-current")).toBe("true");
  });

  it("区块侦测 x:section：展开当前区块，离开时收回自动展开的组，保留手动展开的组", () => {
    page();
    $('.x-toc__g[data-g="proc"] > .x-toc__tg').click();
    document.dispatchEvent(new CustomEvent("x:section", { detail: { id: "lab" } }));
    expect((window as Win).X_TOC!.state().open).toEqual(["proc", "lab", "lab:ds"]);
    document.dispatchEvent(new CustomEvent("x:section", { detail: { id: "board" } }));
    expect((window as Win).X_TOC!.state().open).toEqual(["proc"]);
  });

  it("筛选：只显示匹配条目，匹配的组展开，不匹配的组隐藏；无结果提示；清空后恢复", async () => {
    page();
    const q = $(".x-toc__q") as HTMLInputElement;
    const lab = $('.x-toc__g[data-g="lab"]');
    q.value = "tcp";
    q.dispatchEvent(new Event("input"));
    await new Promise((r) => setTimeout(r, 120));
    expect(lab.hidden).toBe(false);
    expect($('.x-toc__g[data-g="proc"]').hidden).toBe(true);
    expect($('.x-toc__g[data-g="overview"]').hidden).toBe(true);
    expect($('.x-toc__sg[data-g="lab:cn"] > .x-toc__sh').getAttribute("aria-expanded")).toBe("true");
    expect($('.x-toc__sg[data-g="lab:ds"]').hidden).toBe(true);
    expect($$('.x-toc__items a[data-lab]').filter((a) => !a.parentElement!.hidden).map((a) => a.dataset.lab)).toEqual(["cnl0"]);
    q.value = "n0=n2";
    q.dispatchEvent(new Event("input"));
    await new Promise((r) => setTimeout(r, 120));
    expect($$('.x-toc__items a[data-prop]').filter((a) => !a.parentElement!.hidden).map((a) => a.dataset.prop)).toEqual(["ds-q1"]);
    q.value = "zzz";
    q.dispatchEvent(new Event("input"));
    await new Promise((r) => setTimeout(r, 120));
    expect($(".x-toc__empty").hidden).toBe(false);
    ($(".x-toc__clr") as HTMLButtonElement).click();
    expect($(".x-toc__empty").hidden).toBe(true);
    expect(lab.hidden).toBe(false);
    expect($('.x-toc__g[data-g="lab"] > .x-toc__tg').getAttribute("aria-expanded")).toBe("false");
    expect($$(".x-toc__items > li").every((li) => !li.hidden)).toBe(true);
  });

  it("全部收起；区块被隐藏时目录组也隐藏", async () => {
    page();
    $('.x-toc__g[data-g="lab"] > .x-toc__tg').click();
    $('.x-toc__g[data-g="ds"] > .x-toc__tg').click();
    ($(".x-toc__all") as HTMLButtonElement).click();
    expect($$(".x-toc__tg").every((b) => b.getAttribute("aria-expanded") === "false")).toBe(true);
    expect(JSON.parse(localStorage.getItem("x408.toc.open")!)).toEqual([]);
    document.getElementById("links")!.hidden = true;
    await new Promise((r) => setTimeout(r, 0));
    expect($('.x-toc__g[data-g="links"]').hidden).toBe(true);
  });

  it("跳到区块菜单：列出 10 个区块，Esc 关闭并还原焦点", () => {
    page();
    const jump = $(".x-toc__jump");
    jump.click();
    const menu = $("#x-toc-menu");
    expect(menu.hidden).toBe(false);
    expect(jump.getAttribute("aria-expanded")).toBe("true");
    expect(menu.querySelectorAll('a[role="menuitem"]')).toHaveLength(10);
    menu.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(menu.hidden).toBe(true);
    expect(document.activeElement).toBe(jump);
  });
});
