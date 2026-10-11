/** 每个路由的标题与描述：SPA 切换路由时同步到 <title> 与 meta，便于分享、收藏与搜索收录 */
export const SITE_NAME = "考研408动画实验室";

const DEFAULT_DESC = "考研 408 计算机学科专业基础可视化学习站：能拆开看的整机、25 个动画实验与 28 个过程图解，数据结构、组成原理、操作系统、计算机网络四门课考点串联。";

interface RouteMeta {
  title: string;
  description?: string;
  /** 不希望被搜索引擎收录的页面（账号相关、404） */
  noindex?: boolean;
}

const ROUTES: Record<string, RouteMeta> = {
  "/": { title: `${SITE_NAME} · 把计算机拆开给你看`, description: DEFAULT_DESC },
  "/lab": {
    title: `实验室 · ${SITE_NAME}`,
    description: "408 四门课章节考点卡、排序/二叉树/Dijkstra/页面置换/TCP 拥塞控制/滑动窗口/浮点数/磁盘调度等 25 个可单步的动画实验、指令周期/TLB+Cache/二级页表/访问网页全过程等 28 个过程图解与跨科知识连线。",
  },
  "/pc": {
    title: `整机拆解 · ${SITE_NAME}`,
    description: "一台写实的整机：逐个拆开 CPU、内存、显卡、硬盘、电源和网卡，对照 408 考点，再跟着一次数据的旅程走一遍。",
  },
  "/login": { title: `登录 · ${SITE_NAME}`, noindex: true },
  "/register": { title: `注册 · ${SITE_NAME}`, noindex: true },
  "/profile": { title: `个人资料 · ${SITE_NAME}`, noindex: true },
  "/terms": { title: `用户协议 · ${SITE_NAME}`, description: `${SITE_NAME}用户协议：服务内容、账号、使用规范、学习内容说明与免责声明。` },
  "/privacy": {
    title: `隐私政策 · ${SITE_NAME}`,
    description: `${SITE_NAME}隐私政策：只收集用户名或邮箱、昵称与加密后的密码，不使用第三方统计、广告或追踪。`,
  },
};

export function routeMeta(pathname: string): RouteMeta & { description: string } {
  const p = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  const m = ROUTES[p] ?? { title: `页面不存在 · ${SITE_NAME}`, noindex: true };
  return { ...m, description: m.description ?? DEFAULT_DESC };
}

function setMeta(name: string, content: string | null, attr: "name" | "property" = "name") {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${name}"]`);
  if (content === null) {
    el?.remove();
    return;
  }
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, name);
    document.head.appendChild(el);
  }
  el.content = content;
}

export function applyRouteMeta(pathname: string): void {
  const m = routeMeta(pathname);
  document.title = m.title;
  setMeta("description", m.description);
  setMeta("og:title", m.title, "property");
  setMeta("og:description", m.description, "property");
  setMeta("robots", m.noindex ? "noindex" : null);
}
