// 本文件由旧版页面数据整理而来（章节、实验、流程、部件），前后端共用。
export const SUBJECTS = ["ds", "co", "os", "cn"] as const;
export type Subject = (typeof SUBJECTS)[number];

export const SUBJECT_NAMES: Record<Subject, string> = {
  ds: "数据结构",
  co: "计算机组成原理",
  os: "操作系统",
  cn: "计算机网络",
};

export const SUBJECT_SHORT: Record<Subject, string> = {
  ds: "数据结构",
  co: "组成原理",
  os: "操作系统",
  cn: "计算机网络",
};

export const SUBJECT_COLORS: Record<Subject, string> = {
  ds: "#1F7A6D",
  co: "#C2512B",
  os: "#D9A21B",
  cn: "#2D4FA3",
};

export interface ChapterDef { subject: Subject; no: number; title: string }
export interface LabDef { id: string; subject: Subject; title: string }
export interface FlowDef { id: string; subject: Subject; title: string }
export interface PartDef { id: string; subject: Subject; title: string }

export const CHAPTERS: readonly ChapterDef[] = [
  { subject: "ds", no: 1, title: "绪论" },
  { subject: "ds", no: 2, title: "线性表" },
  { subject: "ds", no: 3, title: "栈、队列和数组" },
  { subject: "ds", no: 4, title: "串" },
  { subject: "ds", no: 5, title: "树与二叉树" },
  { subject: "ds", no: 6, title: "图" },
  { subject: "ds", no: 7, title: "查找" },
  { subject: "ds", no: 8, title: "排序" },
  { subject: "co", no: 1, title: "系统概述" },
  { subject: "co", no: 2, title: "数据的表示和运算" },
  { subject: "co", no: 3, title: "存储系统" },
  { subject: "co", no: 4, title: "指令系统" },
  { subject: "co", no: 5, title: "中央处理器" },
  { subject: "co", no: 6, title: "总线" },
  { subject: "co", no: 7, title: "输入/输出系统" },
  { subject: "os", no: 1, title: "计算机系统概述" },
  { subject: "os", no: 2, title: "进程与线程" },
  { subject: "os", no: 3, title: "内存管理" },
  { subject: "os", no: 4, title: "文件管理" },
  { subject: "os", no: 5, title: "输入/输出管理" },
  { subject: "cn", no: 1, title: "体系结构" },
  { subject: "cn", no: 2, title: "物理层" },
  { subject: "cn", no: 3, title: "数据链路层" },
  { subject: "cn", no: 4, title: "网络层" },
  { subject: "cn", no: 5, title: "传输层" },
  { subject: "cn", no: 6, title: "应用层" },
];

export const LABS: readonly LabDef[] = [
  { id: "sort", subject: "ds", title: "排序动画" },
  { id: "tree", subject: "ds", title: "二叉树遍历" },
  { id: "dijkstra", subject: "ds", title: "Dijkstra 最短路径" },
  { id: "cache", subject: "co", title: "Cache 地址映射" },
  { id: "pipeline", subject: "co", title: "指令流水线" },
  { id: "gantt", subject: "os", title: "CPU 调度甘特图" },
  { id: "paging", subject: "os", title: "页面置换" },
  { id: "banker", subject: "os", title: "银行家算法" },
  { id: "tcp", subject: "cn", title: "TCP 拥塞控制" },
  { id: "subnet", subject: "cn", title: "子网划分计算器" },
  { id: "tcpconn", subject: "cn", title: "TCP 三次握手 / 四次挥手" },
];

/** 流程自动演示（window.FLOW.flows 的 id） */
export const FLOWS: readonly FlowDef[] = [
  { id: "life", subject: "co", title: "一条指令的一生" },
  { id: "pagefault", subject: "os", title: "缺页中断" },
  { id: "web", subject: "cn", title: "访问一个网页" },
];

/** 3D 主板上可聚焦的部件（hero focus key）→ 所属科目 */
export const PARTS: readonly PartDef[] = [
  { id: "cpu", subject: "co", title: "CPU" },
  { id: "ram", subject: "co", title: "内存条" },
  { id: "io", subject: "co", title: "I/O + DMA" },
  { id: "board", subject: "co", title: "主板" },
  { id: "disk", subject: "os", title: "硬盘" },
  { id: "os", subject: "os", title: "操作系统" },
  { id: "nic", subject: "cn", title: "网卡" },
  { id: "ds", subject: "ds", title: "数据结构" },
];

export const FLOW_IDS = FLOWS.map((f) => f.id);
export const LAB_IDS = LABS.map((l) => l.id);
export const PART_IDS = PARTS.map((p) => p.id);

export function flowById(id: string): FlowDef | undefined {
  return FLOWS.find((f) => f.id === id);
}
