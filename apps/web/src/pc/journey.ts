// 「一次数据的旅程」：跟着一个数据包走完 网卡 → 内存 → CPU → 显卡 / 硬盘。
import type { PartId } from "./parts";

export interface JourneyStep {
  title: string;
  caption: string;
  /** 考点关键词，显示在字幕下方 */
  tag: string;
  /** 数据包经过的锚点（[部件, 锚点名]）；只有一个点时在原地闪烁 */
  path: [PartId, string][];
  /** 包的颜色 */
  color: string;
  /** 高亮的连线 id */
  link?: string;
  /** 镜头方向（从目标指向相机），距离倍数 */
  view: [number, number, number];
  zoom: number;
  /** 本段时长（秒） */
  dur: number;
  /** 在路径终点额外显示的小标记（如“命中 / 缺失”） */
  badge?: string;
}

export const JOURNEY: JourneyStep[] = [
  {
    title: "① 网卡收到一帧数据",
    caption: "网线上的以太网帧到达网卡，MAC 层检查目的地址和 FCS 校验，确认无误后取出里面的数据。",
    tag: "计算机网络 · 数据链路层：帧、MAC 地址、CRC 校验",
    path: [["nic", "rj45"], ["nic", "chip"]],
    color: "#4CE38A",
    link: "pcie_nic",
    view: [-0.85, 0.2, 0.75],
    zoom: 0.55,
    dur: 3.2,
  },
  {
    title: "② DMA：网卡直接写内存",
    caption: "网卡作为 DMA 主设备，经 PCIe → 芯片组 → CPU 里的内存控制器，把整块数据直接写进内存；CPU 不必逐字搬运，传完再发一次中断。",
    tag: "组成原理 · I/O 方式：程序查询 / 中断 / DMA",
    path: [["nic", "chip"], ["nic", "pcie"], ["board", "pcie1_2"], ["board", "chipset"], ["board", "cpu"], ["board", "dimm"], ["ram", "chips"]],
    color: "#2FD0B8",
    link: "dmi",
    view: [-1.0, 0.12, 0.2],
    zoom: 1.0,
    dur: 5.0,
  },
  {
    title: "③ 中断：CPU 放下手头的事",
    caption: "DMA 传送结束，网卡发出中断请求。CPU 在当前指令执行完后响应：关中断、保存断点和现场，转去执行网卡驱动的中断服务程序。",
    tag: "组成原理 · 中断响应与处理过程",
    path: [["board", "cpu"]],
    color: "#FFC24A",
    view: [-1.0, 0.18, 0.35],
    zoom: 0.5,
    dur: 3.4,
  },
  {
    title: "④ 取指与 Cache：第一次缺失",
    caption: "处理数据的指令先在 L1→L2→L3 里找，没找到就是缺失：按「块」从内存调入 Cache。下一次访问同一块的相邻地址，就会直接命中。",
    tag: "组成原理 · Cache 映射、命中率、局部性原理",
    path: [["ram", "chips"], ["board", "dimm"], ["board", "cpu"]],
    color: "#B07CFF",
    link: "membus",
    view: [-1.0, 0.15, 0.45],
    zoom: 0.62,
    dur: 3.6,
    badge: "缺失 → 调入整块",
  },
  {
    title: "⑤ 执行与写回",
    caption: "ALU 完成运算，结果先写进 Cache 并打上「脏」标记；采用写回法时，直到这一块被替换才写回内存，减少访存次数。",
    tag: "组成原理 · 指令流水线、写回法 / 全写法",
    path: [["board", "cpu"]],
    color: "#E8843A",
    view: [-1.0, 0.22, 0.2],
    zoom: 0.45,
    dur: 3.4,
    badge: "命中 · 写回 Cache",
  },
  {
    title: "⑥ 显卡把结果画出来",
    caption: "要显示的内容经 PCIe 5.0 x16 交给显卡，GPU 成千上万个核心并行计算每个像素，再从显示接口输出到屏幕。",
    tag: "组成原理 · 总线带宽、I/O 接口",
    path: [["board", "cpu"], ["board", "pcie16"], ["gpu", "pcie"], ["gpu", "die"]],
    color: "#3CA8FF",
    link: "pcie_gpu",
    view: [-1.0, 0.08, 0.5],
    zoom: 0.8,
    dur: 3.8,
  },
  {
    title: "⑦ 写进 SSD，断电也不丢",
    caption: "需要长期保存的数据经 PCIe 4.0 x4 写入 NVMe 固态硬盘。操作系统先写进页缓存，再由文件系统分配块、落盘。",
    tag: "操作系统 · 文件系统、磁盘与 I/O 调度",
    path: [["board", "cpu"], ["board", "m2"], ["ssd", "ssd"]],
    color: "#46D2FF",
    link: "pcie_ssd",
    view: [-1.0, 0.2, 0.3],
    zoom: 0.55,
    dur: 3.6,
  },
];
