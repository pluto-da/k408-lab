import type { Subject } from "@k408/shared";

/**
 * 实验室规模（首页、SEO 描述共用）。实验、图解、性质都定义在 legacy-src/js 的旧模块里，
 * catalog.test.ts 会从那些文件里重新数一遍，数量变了测试就会提醒同步这里。
 */
export const LAB_COUNT = 39;
export const PROC_COUNT = 36;
export const PROP_COUNT = 56;

/** 每门课的动画实验数（合计 = LAB_COUNT） */
export const LABS_BY_SUBJECT: Record<Subject, number> = { ds: 17, co: 6, os: 6, cn: 10 };

/** 首页「常用实验」：id 对应实验室里的 #lab-<id>，标题与旧模块里的实验名一致 */
export const COMMON_LABS: readonly { id: string; subject: Subject; title: string; d: string }[] = [
  { id: "sort", subject: "ds", title: "排序动画", d: "5 种排序，一趟一趟看" },
  { id: "kmp", subject: "ds", title: "KMP 与 next 数组", d: "next / nextval 逐位求出" },
  { id: "bst", subject: "ds", title: "二叉排序树与 AVL", d: "插入、删除，失衡时怎么旋转" },
  { id: "hash", subject: "ds", title: "散列表", d: "线性探测、拉链法与 ASL" },
  { id: "dijkstra", subject: "ds", title: "Dijkstra 最短路径", d: "每轮选最近顶点、松弛边" },
  { id: "cache", subject: "co", title: "Cache 地址映射", d: "地址怎么切分，命中还是缺失" },
  { id: "ieee754", subject: "co", title: "IEEE 754 浮点数", d: "符号、阶码、尾数逐位拆开" },
  { id: "paging", subject: "os", title: "页面置换", d: "看 LRU、OPT 每一步怎么换页" },
  { id: "prodcons", subject: "os", title: "生产者—消费者（PV）", d: "信号量一步步加减" },
  { id: "tcp", subject: "cn", title: "TCP 拥塞控制", d: "慢启动、拥塞避免、快恢复" },
  { id: "slidewin", subject: "cn", title: "滑动窗口：停等 / GBN / SR", d: "丢包后谁重传、窗口怎么动" },
  { id: "subnet", subject: "cn", title: "子网划分计算器", d: "网络号、广播地址、可用主机数" },
];
