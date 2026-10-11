import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/** 性质与公式引擎（23-prop-core.js）：校验函数在无 DOM 的 node 沙箱里跑；界面在 jsdom 里挂载 3 条假性质测试 */
interface Ex { q: string; opts: string[]; a: number; why: string; src: string }
interface Prop {
  id: string; sub: string; ch: string; name: string; def: string; stmt: string[]; cond: string;
  proof: string[]; traps: string[]; ex: Ex; links?: { lab?: string[]; proc?: string[] };
  demo: (box: HTMLElement) => { destroy?: () => void } | void;
}
interface Api {
  open(id: string, scroll?: boolean): boolean;
  current(): string | null;
  setSub(s: string): number;
  setChapter(c: string): number;
  search(t: string): number;
  setGlobal(t: string): number;
  count(): number;
  destroy(): void;
}
interface PropU {
  validate(list: unknown[], opt?: { labIds?: string[]; procIds?: string[] }): string[];
  md(s: string): string;
  esc(s: string): string;
  norm(s: string): string;
  matches(p: Partial<Prop>, term: string): boolean;
  ordered(list: Prop[]): Prop[];
  chapters(list: Prop[], sub?: string): string[];
  mount(root: HTMLElement, list: Prop[]): Api;
  build(): void;
}
type Win = Window & { PROC?: unknown; PROP?: Prop[]; PROPU?: PropU; X_PROP?: Api; X_OPEN_PROP?: (id: string) => boolean; X_OPEN_LAB?: (id: string) => void; X_OPEN_PROC?: (id: string) => boolean; __LEGACY_LOADER__?: boolean };

const SRC = readFileSync(resolve(__dirname, "../../public/legacy/js/23-prop-core.js"), "utf8");

/** 无 DOM：只给一个空 window */
function loadNode(): PropU {
  const win: Record<string, unknown> = {};
  runInNewContext(SRC, { window: win, console });
  return win.PROPU as PropU;
}
/** jsdom：在全局 window 上执行，每次换一份新的注册表 */
function loadDom(): PropU {
  const w = window as Win;
  w.PROP = [];
  w.PROPU = {} as PropU;
  w.__LEGACY_LOADER__ = true;
  new Function(SRC)();
  return w.PROPU;
}

const life: string[] = [];
function fake(id: string, sub: string, ch: string, extra: Partial<Prop> = {}): Prop {
  return {
    id, sub, ch, name: "性质 " + id, def: "度：结点拥有的子树个数 <i>x</i>",
    stmt: ["n₀ = n₂ + 1", "**关键** 结论 " + id], cond: "任意非空二叉树",
    proof: ["第一步 " + id, "第二步 " + id, "第三步 " + id, "第四步 " + id],
    traps: ["易错一", "易错二"],
    ex: { q: "题干 " + id, opts: ["甲", "乙", "丙", "丁"], a: 2, why: "因为 " + id, src: "2011 年真题" },
    links: { lab: ["bst"], proc: ["rbtree"] },
    demo(box) {
      life.push("mount:" + id);
      box.innerHTML = '<p class="demo-' + id + '">demo ' + id + "</p>";
      return { destroy() { life.push("destroy:" + id); } };
    },
    ...extra,
  };
}

describe("PROPU.validate（node，无 DOM）", () => {
  const U = loadNode();
  it("合法内容没有错误", () => {
    expect(U.validate([fake("a", "ds", "树"), fake("b", "cn", "物理层")], { labIds: ["bst"], procIds: ["rbtree"] })).toEqual([]);
  });
  it("逐项报出缺字段、步数、选项、答案下标、未知链接、重复 id", () => {
    const bad = [
      fake("a", "ds", "树", { proof: ["1", "2"], traps: ["只有一条"] }),
      fake("a", "xx", "", { ex: { q: "q", opts: ["1", "2", "3"], a: 4, why: "", src: "某书" } }),
      fake("c", "os", "内存", { links: { lab: ["nope"], proc: ["rbtree", "ghost"] } }),
      { ...fake("d", "co", "数据"), name: "", demo: undefined },
    ];
    const errs = U.validate(bad, { labIds: ["bst"], procIds: ["rbtree"] });
    const has = (s: string) => expect(errs.some((e) => e.includes(s)), s + "\n" + errs.join("\n")).toBe(true);
    has("a: proof 少于 3 步");
    has("a: traps 少于 2 条");
    has("a: id 重复");
    has("a: sub 必须是 ds/co/os/cn");
    has("a: 缺少 ch");
    has("a: ex.opts 必须正好 4 项");
    has("a: ex.a 必须是 0–3 的整数");
    has("a: ex.why 为空");
    has("a: ex.src 应为");
    has("c: links.lab 引用了不存在的 id：nope");
    has("c: links.proc 引用了不存在的 id：ghost");
    has("d: 缺少 name");
    has("d: 缺少 demo 函数");
    expect(errs.filter((e) => e.startsWith("c:"))).toHaveLength(2);
  });
  it("不给 id 列表时不检查链接；links 可省略", () => {
    expect(U.validate([fake("a", "ds", "树", { links: { lab: ["whatever"] } })])).toEqual([]);
    const p: Partial<Prop> = fake("b", "ds", "树");
    delete p.links;
    expect(U.validate([p])).toEqual([]);
  });
  it("文本转义，只保留 **加粗**；搜索对上下标与空格不敏感", () => {
    expect(U.md("<script>a</script> **x** & y")).toBe("&lt;script&gt;a&lt;/script&gt; <b>x</b> &amp; y");
    expect(U.norm("n₀ = n₂ + 1")).toBe("n0=n2+1");
    expect(U.matches(fake("a", "ds", "树"), "n0=n2+1")).toBe(true);
    expect(U.matches(fake("a", "ds", "树"), "香农")).toBe(false);
    expect(U.chapters([fake("a", "ds", "树"), fake("b", "ds", "图"), fake("c", "co", "数据"), fake("d", "ds", "树")], "ds")).toEqual(["树", "图"]);
  });
});

describe("性质卡片界面（jsdom）", () => {
  let U: PropU, root: HTMLElement, api: Api;
  const list = () => [fake("pa", "ds", "树与二叉树"), fake("pb", "ds", "图"), fake("pc", "co", "数据的表示", { stmt: ["香农 C = W log₂(1 + S/N)"] })];
  const q = <T extends Element = HTMLElement>(s: string) => root.querySelector(s) as T;
  const visibleIds = () => Array.from(root.querySelectorAll<HTMLElement>(".x-prop__item")).filter((b) => !b.hidden).map((b) => b.dataset.id);

  beforeEach(() => {
    life.length = 0;
    document.body.innerHTML = '<section id="prop"><div class="x-prop" id="x-prop"></div></section>';
    U = loadDom();
    root = document.getElementById("x-prop")!;
    api = U.mount(root, list().reverse()); // 注册顺序打乱也按科目排
  });
  afterEach(() => {
    api.destroy();
    history.replaceState(null, "", "/");
  });

  it("挂载后按科目排序，默认打开第一条，结论醒目、文本已转义", () => {
    expect(visibleIds()).toEqual(["pb", "pa", "pc"]);
    expect(api.current()).toBe("pb");
    const card = q(".x-prop__card");
    expect(card.id).toBe("prop-" + api.current());
    expect(card.querySelectorAll(".x-prop__stmt li")).toHaveLength(2);
    expect(card.querySelector(".x-prop__stmt li b")!.textContent).toBe("关键");
    expect(card.querySelector(".x-prop__def i")).toBeNull();
    expect(card.querySelector(".x-prop__def")!.textContent).toContain("<i>x</i>");
    expect(Array.from(root.querySelectorAll(".x-prop__sub")).map((b) => b.textContent)).toEqual(["全部", "数据结构", "组成原理"]);
  });

  it("科目与章节筛选：当前条被筛掉时自动切到第一条可见的", () => {
    api.open("pa");
    (root.querySelector('.x-prop__sub[data-sub="co"]') as HTMLButtonElement).click();
    expect(visibleIds()).toEqual(["pc"]);
    expect(api.current()).toBe("pc");
    expect(q('.x-prop__sub[data-sub="co"]').getAttribute("aria-pressed")).toBe("true");
    api.setSub("ds");
    const sel = q<HTMLSelectElement>(".x-prop__ch");
    expect(Array.from(sel.options).map((o) => o.value)).toEqual(["", "图", "树与二叉树"]);
    sel.value = "图";
    sel.dispatchEvent(new Event("change"));
    expect(visibleIds()).toEqual(["pb"]);
    expect(api.current()).toBe("pb");
    api.setSub("all");
    expect(visibleIds()).toHaveLength(3);
  });

  it("搜索框按名称 / 章节 / 结论过滤，没有结果时给出提示", () => {
    const inp = q<HTMLInputElement>(".x-prop__q");
    inp.value = "香农";
    inp.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
    expect(visibleIds()).toEqual(["pc"]);
    expect(api.current()).toBe("pc");
    expect(api.search("图")).toBe(1);
    expect(visibleIds()).toEqual(["pb"]);
    expect(api.search("n0 = n2+1")).toBe(2); // pc 的结论里没有这条
    expect(api.search("不存在的词")).toBe(0);
    expect(q(".x-prop__empty").hidden).toBe(false);
    expect(api.search("")).toBe(3);
    expect(q(".x-prop__empty").hidden).toBe(true);
  });

  it("页内搜索（setGlobal）放开科目筛选并与本节搜索叠加", () => {
    api.setSub("ds");
    expect(api.setGlobal("香农")).toBe(1);
    expect(visibleIds()).toEqual(["pc"]);
    expect(api.setGlobal("")).toBe(3);
  });

  it("推导单步：累积显示，当前步高亮，全部展开 / 从头看", () => {
    api.open("pa");
    const steps = () => Array.from(root.querySelectorAll<HTMLElement>(".x-prop__steps li"));
    const shown = () => steps().filter((li) => !li.hidden).length;
    const btn = (a: string) => q<HTMLButtonElement>(`.x-prop__ctrl [data-a="${a}"]`);
    expect(shown()).toBe(1);
    expect(btn("prev").disabled).toBe(true);
    btn("next").click();
    btn("next").click();
    expect(shown()).toBe(3);
    expect(steps()[2]!.classList.contains("is-cur")).toBe(true);
    expect(steps()[1]!.classList.contains("is-cur")).toBe(false);
    expect(q(".x-prop__count").textContent).toBe("3 / 4");
    btn("prev").click();
    expect(shown()).toBe(2);
    btn("all").click();
    expect(shown()).toBe(4);
    expect(btn("next").disabled).toBe(true);
    expect(btn("all").textContent).toBe("从头看");
    btn("all").click();
    expect(shown()).toBe(1);
  });

  it("例题：点错标红并标出正确答案，显示解析与出处；可以再做一次", () => {
    api.open("pa");
    const opts = () => Array.from(root.querySelectorAll<HTMLButtonElement>(".x-prop__opt"));
    expect(opts()).toHaveLength(4);
    expect(q(".x-prop__src").textContent).toBe("2011 年真题");
    expect(q(".x-prop__res").hidden).toBe(true);
    opts()[0]!.click();
    expect(opts()[0]!.classList.contains("is-wrong")).toBe(true);
    expect(opts()[2]!.classList.contains("is-right")).toBe(true);
    expect(opts().every((b) => b.disabled)).toBe(true);
    const res = q(".x-prop__res");
    expect(res.hidden).toBe(false);
    expect(res.classList.contains("is-bad")).toBe(true);
    expect(res.textContent).toContain("正确答案是 C");
    expect(res.textContent).toContain("因为 pa");
    (res.querySelector(".x-prop__redo") as HTMLButtonElement).click();
    expect(opts().some((b) => b.disabled)).toBe(false);
    opts()[2]!.click();
    expect(q(".x-prop__res").classList.contains("is-ok")).toBe(true);
    expect(q(".x-prop__res").textContent).toContain("答对了");
  });

  it("验证动画：打开时挂载，切换时先销毁旧的；抛错时显示中文提示且不影响其余内容", () => {
    life.length = 0;
    api.open("pc");
    expect(root.querySelector(".x-prop__box .demo-pc")).not.toBeNull();
    api.open("pa");
    expect(life).toEqual(["destroy:pb", "mount:pc", "destroy:pc", "mount:pa"]);
    api.open("pa");
    expect(life.filter((x) => x === "mount:pa")).toHaveLength(1); // 重复打开同一条不重建

    api.destroy();
    const err = vi.spyOn(console, "error").mockImplementation(() => undefined);
    api = U.mount(root, [fake("boom", "os", "死锁", { demo() { throw new Error("坏了"); } }), fake("ok", "os", "死锁")]);
    expect(api.current()).toBe("boom");
    const alert = q(".x-prop__box .x-prop__err");
    expect(alert.textContent).toBe("验证动画出错了：坏了");
    expect(alert.getAttribute("role")).toBe("alert");
    expect(root.querySelectorAll(".x-prop__opt")).toHaveLength(4);
    api.open("ok");
    expect(root.querySelector(".x-prop__box .demo-ok")).not.toBeNull();
    err.mockRestore();
  });

  it("相关链接调用实验 / 图解的打开函数并写入 hash", () => {
    const w = window as Win;
    const tab = document.createElement("button");
    tab.id = "tab-bst";
    tab.textContent = "二叉排序树";
    document.body.appendChild(tab);
    w.PROC = [{ id: "rbtree", name: "红黑树插入" }];
    const openLab = vi.fn(), openProc = vi.fn(() => true);
    w.X_OPEN_LAB = openLab;
    w.X_OPEN_PROC = openProc;
    api.destroy();
    api = U.mount(root, list());
    const links = Array.from(root.querySelectorAll<HTMLAnchorElement>(".x-prop__link"));
    expect(links.map((a) => a.textContent)).toEqual(["动画实验：二叉排序树 →", "过程图解：红黑树插入 →"]);
    expect(links[0]!.getAttribute("href")).toBe("#lab-bst");
    links[0]!.click();
    expect(openLab).toHaveBeenCalledWith("bst");
    expect(location.hash).toBe("#lab-bst");
    links[1]!.click();
    expect(openProc).toHaveBeenCalledWith("rbtree");
    expect(location.hash).toBe("#proc-rbtree");
    delete w.X_OPEN_LAB;
    delete w.X_OPEN_PROC;
    delete w.PROC;
  });

  it("点列表写入 #prop-<id>；open 会放宽筛选让目标可见", () => {
    (root.querySelector("#prtab-pb") as HTMLButtonElement).click();
    expect(location.hash).toBe("#prop-pb");
    api.setSub("co");
    api.search("香农");
    expect(api.open("pa")).toBe(true);
    expect(api.current()).toBe("pa");
    expect(visibleIds()).toContain("pa");
    expect(api.open("nope")).toBe(false);
  });
});

describe("hash 直达（build）", () => {
  afterEach(() => {
    (window as Win).X_PROP?.destroy();
    history.replaceState(null, "", "/");
  });
  it("加载时打开 #prop-<id>，之后响应 hashchange", () => {
    document.body.innerHTML = '<section id="prop"><div class="x-prop" id="x-prop"></div></section>';
    const U = loadDom();
    const w = window as Win;
    w.PROP!.push(...[fake("ha", "ds", "树"), fake("hb", "cn", "物理层"), fake("hc", "os", "死锁")]);
    history.replaceState(null, "", "/lab#prop-hc");
    U.build();
    expect(w.X_PROP!.current()).toBe("hc");
    expect(document.getElementById("prop-hc")).not.toBeNull();
    history.replaceState(null, "", "/lab#prop-hb");
    window.dispatchEvent(new HashChangeEvent("hashchange"));
    expect(w.X_PROP!.current()).toBe("hb");
    expect(w.X_OPEN_PROP!("ha")).toBe(true);
    expect(w.X_PROP!.current()).toBe("ha");
    U.build(); // 重复调用不会重建
    expect(document.querySelectorAll(".x-prop__bar")).toHaveLength(1);
  });
});
