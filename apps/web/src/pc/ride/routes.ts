// 「化身数据」的路线清单。第一批开放路线一，其余路线随后开放。
export interface RouteInfo {
  id: string;
  title: string;
  brief: string;
  ready: boolean;
}

export const ROUTES: RouteInfo[] = [
  { id: "access", title: "一次访存", brief: "虚拟地址 → TLB → 页表 → Cache → 寄存器", ready: true },
  { id: "packet", title: "网卡收到一个网页数据包", brief: "帧校验 → DMA → 中断 → 协议栈逐层拆封", ready: false },
  { id: "pipeline", title: "一条指令的流水线之旅", brief: "取指、译码、执行、访存、写回与冒险", ready: false },
  { id: "keyboard", title: "按下键盘，字母出现在屏幕上", brief: "扫描码 → 中断 → 系统调用 → 显存", ready: false },
  { id: "file", title: "从硬盘读一个文件", brief: "索引结点 → 磁盘请求 → DMA → 用户缓冲区", ready: false },
  { id: "boot", title: "开机：电源到第一条指令", brief: "供电 → 复位 → 固件自检 → 引导 → 内核", ready: false },
];
