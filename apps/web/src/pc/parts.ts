// 整机拆解：部件、考点、标注与连线定义（坐标单位：米，three.js 轴向，Y 向上）

export type PartId = "case" | "board" | "cpu" | "ram" | "ssd" | "gpu" | "nic" | "hdd" | "psu";

export interface Callout {
  /** 内部模型里的锚点名 */
  anchor: string;
  label: string;
  color?: string;
}

export interface ChapterLink {
  label: string;
  to: string;
}

export interface PartDef {
  id: PartId;
  name: string;
  en: string;
  tag: string;
  /** 一句话说明 */
  brief: string;
  points: string[];
  chapters: ChapterLink[];
  callouts: Callout[];
  /** 拆出时的位移（相对机箱） */
  explode: [number, number, number];
  /** 打开后观察方向（从目标指向相机） */
  view: [number, number, number];
  /** 学习进度里的部件 id（catalog PARTS） */
  progressId?: string;
  /** 打开时是否有独立的内部模型 */
  hasInterior: boolean;
}

const CO3: ChapterLink = { label: "组成原理 · 第 3 章 存储系统", to: "/lab#co" };
const CO5: ChapterLink = { label: "组成原理 · 第 5 章 中央处理器", to: "/lab#co" };
const CO6: ChapterLink = { label: "组成原理 · 第 6 章 总线", to: "/lab#co" };
const CO7: ChapterLink = { label: "组成原理 · 第 7 章 输入/输出系统", to: "/lab#co" };
const OS5: ChapterLink = { label: "操作系统 · 第 5 章 输入/输出管理", to: "/lab#os" };
const CN3: ChapterLink = { label: "计算机网络 · 第 3 章 数据链路层", to: "/lab#cn" };

export const PARTS: PartDef[] = [
  {
    id: "cpu",
    name: "CPU 与散热器",
    en: "Processor",
    tag: "运算器 + 控制器",
    brief: "取指、译码、执行都在这块指甲盖大小的硅片上完成；开盖后可以看到核心、各级 Cache 与内存控制器。",
    points: [
      "指令周期：取指周期 → 间址周期 → 执行周期 → 中断周期；取指由控制器完成，(PC)+1 → PC。",
      "ALU 完成算术/逻辑运算；CU 产生微操作控制信号，分硬布线与微程序两种实现。",
      "五段流水线 IF / ID / EX / MEM / WB；结构、数据、控制冒险分别靠资源重复、转发/阻塞、分支预测缓解。",
      "Cache 映射：直接映射、全相联、组相联；主存地址拆成 标记 | 组号(行号) | 块内地址。",
      "平均访问时间：先访问 Cache 时 t = h·tc + (1−h)(tc + tm)；同时访问时 t = h·tc + (1−h)·tm。",
      "L1 分指令/数据 Cache，L3 多核共享；写回 + 写分配、全写 + 非写分配是两种常见搭配。",
    ],
    chapters: [CO5, CO3],
    callouts: [
      { anchor: "alu", label: "ALU 运算器", color: "#E8843A" },
      { anchor: "cu", label: "CU 控制器", color: "#4678DC" },
      { anchor: "l1", label: "L1 Cache（指令/数据分离）", color: "#82D278" },
      { anchor: "l2", label: "L2 Cache（每核私有）", color: "#28965A" },
      { anchor: "l3", label: "L3 Cache（多核共享）", color: "#22AAAA" },
      { anchor: "ring", label: "片上环形互连", color: "#E6E6EE" },
      { anchor: "imc", label: "内存控制器 IMC", color: "#965AC8" },
      { anchor: "io", label: "PCIe / I/O 控制", color: "#D2B446" },
      { anchor: "ihs", label: "顶盖 IHS（已开盖）" },
      { anchor: "substrate", label: "封装基板 · LGA 触点" },
    ],
    explode: [-0.3, 0.07, 0.02],
    view: [-0.35, 0.95, 0.75],
    progressId: "cpu",
    hasInterior: true,
  },
  {
    id: "ram",
    name: "内存条",
    en: "DDR5 DIMM",
    tag: "主存储器",
    brief: "CPU 直接访问的主存。拆掉散热马甲，下面是一排 DRAM 颗粒；每个颗粒内部又分成多个 Bank。",
    points: [
      "存储器层次：寄存器 → Cache → 主存 → 辅存，越靠近 CPU 越快、越小、越贵，依靠局部性原理工作。",
      "DRAM 用电容存 1 位，需要定期刷新（集中 / 分散 / 异步刷新）；SRAM 用触发器，速度快，用作 Cache。",
      "DRAM 地址分行、列两次送入（RAS / CAS），地址引脚减半；读出的一整行先进入行缓冲。",
      "多体交叉编址：低位交叉时连续地址落在不同 Bank，可流水访问，带宽接近 m 倍。",
      "容量扩展：位扩展（加数据位）、字扩展（加地址，用译码器片选）、字位同时扩展。",
      "主存与 CPU 通过 MAR / MDR 交换：地址线位数决定寻址范围，数据线位数等于存储字长。",
    ],
    chapters: [CO3],
    callouts: [
      { anchor: "dram", label: "DRAM 颗粒", color: "#7AA7FF" },
      { anchor: "bank", label: "颗粒内部：8 个 Bank", color: "#5A8CF0" },
      { anchor: "rowbuf", label: "被激活的一行 → 行缓冲", color: "#FFC83C" },
      { anchor: "spd", label: "SPD（时序参数）" },
      { anchor: "pmic", label: "PMIC 电源管理" },
      { anchor: "gold", label: "金手指 288 pin" },
      { anchor: "hs", label: "散热马甲（已拆下）" },
    ],
    explode: [-0.28, 0.1, 0.06],
    view: [-0.25, 0.75, 1.0],
    progressId: "ram",
    hasInterior: true,
  },
  {
    id: "ssd",
    name: "NVMe 固态硬盘",
    en: "M.2 SSD",
    tag: "辅存 · 闪存",
    brief: "插在主板 M.2 插槽上，走 PCIe x4 直连 CPU。揭开标签：主控、DRAM 缓存和 NAND 闪存颗粒。",
    points: [
      "NAND 闪存属于非易失性存储，按页读写、按块擦除，写入前必须先擦除。",
      "FTL（闪存翻译层）在主控里把逻辑块号映射到物理页，映射表常驻 DRAM 缓存。",
      "磨损均衡：动态 / 静态磨损均衡把擦写次数分散到所有块，延长寿命。",
      "没有寻道和旋转延迟，随机读写远快于机械硬盘；但写放大、垃圾回收会影响写性能。",
      "NVMe 盘经 PCIe 直连 CPU；SATA 盘挂在芯片组的 SATA 控制器上。",
    ],
    chapters: [CO3, OS5],
    callouts: [
      { anchor: "ctrl", label: "主控（运行 FTL）", color: "#F0A050" },
      { anchor: "dram", label: "DRAM 缓存（映射表）", color: "#7AA7FF" },
      { anchor: "nand", label: "NAND 闪存颗粒", color: "#9FB4D8" },
      { anchor: "stack", label: "颗粒内多层裸片堆叠" },
      { anchor: "mkey", label: "M.2 接口 · PCIe x4" },
      { anchor: "label", label: "标签（已揭开）" },
    ],
    explode: [-0.26, 0.03, 0.06],
    view: [-0.3, 1.0, 0.9],
    progressId: "disk",
    hasInterior: true,
  },
  {
    id: "hdd",
    name: "机械硬盘",
    en: "3.5\" SATA HDD",
    tag: "辅存 · 磁表面存储",
    brief: "打开顶盖：高速旋转的盘片、在磁道间摆动的磁头臂。一次读写 = 寻道 + 旋转等待 + 传输。",
    points: [
      "存取时间 = 寻道时间 Ts + 旋转延迟 Tr + 传输时间 Tt；平均旋转延迟 = 转一圈时间的一半。",
      "例：7200 转/分 → 一圈 8.33 ms，平均旋转延迟约 4.17 ms。",
      "磁盘地址 = 柱面号 + 磁头号(盘面) + 扇区号；同一柱面的各磁道无需移动磁头即可连续读写。",
      "扇区是最小读写单位；交替编号、错位命名可减少连续读时的旋转等待。",
      "磁盘调度：FCFS、SSTF（可能饥饿）、SCAN（电梯）、C-SCAN、LOOK / C-LOOK。",
      "格式化顺序：低级格式化（划分扇区）→ 分区 → 高级格式化（建立文件系统）。",
    ],
    chapters: [OS5, CO3],
    callouts: [
      { anchor: "platter", label: "盘片（双面记录）", color: "#C8CDD6" },
      { anchor: "track", label: "磁道：同半径的磁道组成柱面", color: "#FF8C28" },
      { anchor: "sector", label: "扇区：最小读写单位", color: "#3C96FF" },
      { anchor: "head", label: "磁头（悬浮读写）", color: "#F0F0F0" },
      { anchor: "arm", label: "磁头臂：寻道" },
      { anchor: "vcm", label: "音圈电机：驱动寻道" },
      { anchor: "spindle", label: "主轴电机 7200 RPM" },
      { anchor: "sata", label: "SATA 数据 / 供电接口" },
    ],
    explode: [-0.3, 0.1, -0.04],
    view: [-0.35, 1.0, 0.85],
    progressId: "disk",
    hasInterior: true,
  },
  {
    id: "gpu",
    name: "显卡",
    en: "Graphics card",
    tag: "I/O 设备 · PCIe x16",
    brief: "挂在 PCIe x16 上的 I/O 设备。拆掉风扇和散热片：中央是 GPU 核心，周围一圈 GDDR 显存。",
    points: [
      "显卡是典型的 I/O 设备：由 I/O 接口（PCIe）+ 设备控制器 + 设备本体组成，显存独立于主存。",
      "大量简单核心并行执行同一指令流（SIMT），擅长数据并行；CPU 则是少量复杂核心，擅长控制流。",
      "PCIe 是串行、点对点总线：x16 = 16 条通道，每条通道双向差分传输。",
      "CPU 与显卡之间的大块数据常用 DMA 传送，CPU 只在传送开始和结束时介入。",
      "帧缓冲容量 = 分辨率 × 色深；刷新所需带宽 = 帧缓冲容量 × 帧率。",
    ],
    chapters: [CO7, CO6],
    callouts: [
      { anchor: "die", label: "GPU 核心", color: "#9AA6C8" },
      { anchor: "vram", label: "GDDR6 显存", color: "#7AA7FF" },
      { anchor: "vrm", label: "供电模块 VRM" },
      { anchor: "pcie", label: "PCIe x16 金手指", color: "#E0B85C" },
      { anchor: "heatsink", label: "散热鳍片 + 热管" },
      { anchor: "fan", label: "风扇" },
      { anchor: "power", label: "12V 供电接口" },
    ],
    explode: [-0.34, 0.02, 0.0],
    view: [-0.2, 1.0, 1.0],
    progressId: "io",
    hasInterior: true,
  },
  {
    id: "nic",
    name: "网卡",
    en: "PCIe NIC",
    tag: "物理层 + 数据链路层",
    brief: "插在芯片组引出的 PCIe x1 上。MAC 负责成帧和差错检测，PHY 负责把比特变成线上的电信号。",
    points: [
      "网卡实现物理层与数据链路层：MAC 成帧、CRC 差错检测、介质访问控制；PHY 负责编码与收发信号。",
      "MAC 地址 48 位、固化在网卡中；以太网帧 = 目的 MAC | 源 MAC | 类型 | 数据(46–1500 B) | FCS。",
      "CSMA/CD（半双工）：最短帧长 = 2τ × 数据传输率，经典以太网为 64 B；交换式全双工下不再冲突。",
      "收发数据时网卡用 DMA 把帧在网卡缓冲区和内存之间搬运，再以中断通知 CPU。",
      "网络变压器做电气隔离，RJ45 接双绞线（物理层）。",
    ],
    chapters: [CN3, CO7],
    callouts: [
      { anchor: "mac", label: "MAC：成帧 / CRC / 介质访问", color: "#3C6ED2" },
      { anchor: "phy", label: "PHY：编码与收发", color: "#E18232" },
      { anchor: "chip", label: "以太网控制器" },
      { anchor: "magnetics", label: "网络变压器（隔离）" },
      { anchor: "rj45", label: "RJ45 接口" },
      { anchor: "led", label: "链路 / 活动指示灯", color: "#3CE66E" },
      { anchor: "pcie", label: "PCIe x1 接口", color: "#E0B85C" },
      { anchor: "xtal", label: "晶振（提供时钟）" },
    ],
    explode: [-0.3, -0.04, 0.02],
    view: [-0.2, 1.0, 0.95],
    progressId: "nic",
    hasInterior: true,
  },
  {
    id: "psu",
    name: "电源",
    en: "Power supply",
    tag: "供电",
    brief: "把 220V 交流电变成 +12V / +5V / +3.3V 直流。打开外壳：滤波大电容、PFC 电感、主变压器、开关管散热片。",
    points: [
      "工作流程：EMI 滤波 → 整流 → PFC 功率因数校正 → 高频开关 → 变压器隔离降压 → 整流滤波输出。",
      "+12V 供 CPU（8pin EPS）和显卡，+5V / +3.3V 供主板、硬盘、内存等。",
      "掉电意味着 RAM、Cache、寄存器中的易失性数据全部丢失；ROM、闪存、磁盘中的数据不丢。",
      "电源掉电属于不可屏蔽中断（NMI）这一类紧急硬件事件，优先级最高。",
      "开机过程：上电 → 固化在 ROM 中的 BIOS/UEFI 自检 → 引导程序 → 装入操作系统内核。",
    ],
    chapters: [CO7, { label: "操作系统 · 第 1 章 计算机系统概述", to: "/lab#os" }],
    callouts: [
      { anchor: "xfmr", label: "主变压器（隔离 / 降压）", color: "#E2BE46" },
      { anchor: "bulk", label: "滤波大电容" },
      { anchor: "pfc", label: "PFC 电感", color: "#CE7A52" },
      { anchor: "hs", label: "开关管散热片" },
      { anchor: "fan", label: "散热风扇" },
      { anchor: "out", label: "模组输出 +12V / +5V / +3.3V", color: "#FFB040" },
      { anchor: "ocap", label: "输出滤波电容" },
    ],
    explode: [-0.34, 0.03, 0.0],
    view: [-0.3, 1.0, 0.9],
    hasInterior: true,
  },
  {
    id: "board",
    name: "主板与总线",
    en: "Motherboard",
    tag: "总线 · I/O",
    brief: "所有部件的连接中枢。去掉散热片后可以看到 CPU 插槽、内存插槽、PCIe、芯片组与 SATA 之间的走线。",
    points: [
      "系统总线分数据总线、地址总线、控制总线；地址线宽决定寻址空间，数据线宽决定一次传输的位数。",
      "总线带宽 = 总线工作频率 × 总线宽度(字节)；同步定时靠统一时钟，异步定时靠握手（不互锁 / 半互锁 / 全互锁）。",
      "总线仲裁：集中式（链式查询、计数器定时查询、独立请求）与分布式；链式查询对电路故障最敏感。",
      "I/O 控制方式：程序查询 → 程序中断 → DMA → 通道；DMA 与 CPU 争用主存：停止 CPU 访存、周期挪用、交替访存。",
      "内存与显卡直连 CPU；芯片组（PCH）经 DMI 连接 CPU，再挂接 SATA、USB、网卡等较慢的设备。",
      "中断处理：关中断 → 保存断点 → 识别中断源（向量）→ 保护现场 → 执行服务程序 → 恢复现场 → 开中断返回。",
    ],
    chapters: [CO6, CO7],
    callouts: [
      { anchor: "cpu", label: "CPU 插槽（LGA）", color: "#D2B446" },
      { anchor: "dimm", label: "内存插槽 · 双通道", color: "#965AC8" },
      { anchor: "pcie16", label: "PCIe x16（直连 CPU）", color: "#3CA0FF" },
      { anchor: "m2", label: "M.2 插槽（PCIe x4）", color: "#3CA0FF" },
      { anchor: "chipset", label: "芯片组 PCH", color: "#22AAAA" },
      { anchor: "sata", label: "SATA 接口", color: "#FF8C28" },
      { anchor: "vrm", label: "CPU 供电 VRM" },
      { anchor: "bios", label: "BIOS / UEFI（ROM）" },
      { anchor: "io", label: "后置 I/O 接口" },
      { anchor: "pcie1_2", label: "PCIe x1（芯片组）" },
    ],
    explode: [-0.3, 0.0, 0.0],
    view: [-1.0, 0.3, 0.4],
    progressId: "board",
    hasInterior: true,
  },
  {
    id: "case",
    name: "机箱与风道",
    en: "Chassis",
    tag: "整机",
    brief: "钢化玻璃侧透机箱：前面三把风扇进风，后面一把排风。点开可以拆下玻璃侧板直接看内部布局。",
    points: [
      "冯·诺依曼结构五大部件：运算器、控制器、存储器、输入设备、输出设备；以运算器为中心，现代计算机以存储器为中心。",
      "存储程序：指令和数据以二进制形式存放在存储器中，按地址访问，由 PC 指示下一条指令。",
      "性能指标：主频、CPI、MIPS；CPU 执行时间 = 指令条数 × CPI × 时钟周期。",
      "主机 = CPU + 主存；硬盘、网卡、显卡都属于 I/O 设备，经接口挂到总线上。",
    ],
    chapters: [{ label: "组成原理 · 第 1 章 系统概述", to: "/lab#co" }],
    callouts: [
      { anchor: "front_fans", label: "前置进风 ×3" },
      { anchor: "rear_fan", label: "后置排风" },
    ],
    explode: [0, 0, 0],
    view: [-1.0, 0.35, 0.3],
    hasInterior: false,
  },
];

export const PART_BY_ID = Object.fromEntries(PARTS.map((p) => [p.id, p])) as Record<PartId, PartDef>;

/** 连接线：端点 = [部件, 外观模型里的锚点]，via 为中间点相对偏移 */
export interface LinkDef {
  id: string;
  label: string;
  color: string;
  parts: PartId[];
  points: [PartId, string][];
  /** 每个中间点朝玻璃侧（-X）的偏移，让线浮在主板之上 */
  lift?: number;
  /** 流动方向：双向总线 or 单向供电 */
  bidir: boolean;
}

export const LINKS: LinkDef[] = [
  { id: "membus", label: "内存总线 DDR5", color: "#B07CFF", parts: ["cpu", "ram", "board"], points: [["board", "cpu"], ["board", "dimm"]], lift: 0.025, bidir: true },
  { id: "pcie_gpu", label: "PCIe 5.0 x16", color: "#3CA8FF", parts: ["cpu", "gpu", "board"], points: [["board", "cpu"], ["board", "pcie16"], ["gpu", "pcie"]], lift: 0.02, bidir: true },
  { id: "pcie_ssd", label: "PCIe 4.0 x4", color: "#46D2FF", parts: ["cpu", "ssd", "board"], points: [["board", "cpu"], ["board", "m2"], ["ssd", "ssd"]], lift: 0.015, bidir: true },
  { id: "dmi", label: "DMI 直连芯片组", color: "#2FD0B8", parts: ["cpu", "board"], points: [["board", "cpu"], ["board", "chipset"]], lift: 0.012, bidir: true },
  { id: "sata", label: "SATA 6Gb/s", color: "#FF9A3C", parts: ["hdd", "board"], points: [["board", "chipset"], ["board", "sata"], ["hdd", "sata"]], lift: 0.01, bidir: true },
  { id: "pcie_nic", label: "PCIe x1 → 网卡", color: "#4CE38A", parts: ["nic", "board"], points: [["board", "chipset"], ["board", "pcie1_2"], ["nic", "chip"]], lift: 0.012, bidir: true },
  { id: "pwr_board", label: "+12V/+5V/+3.3V 主供电", color: "#FFC24A", parts: ["psu", "board"], points: [["psu", "out"], ["case", "pw_a"], ["case", "pw_b"], ["case", "pw_c"], ["board", "atx24"]], lift: 0.0, bidir: false },
  { id: "pwr_cpu", label: "CPU 8pin 供电", color: "#FFC24A", parts: ["psu", "cpu"], points: [["psu", "out"], ["case", "pw_a"], ["case", "pw_b"], ["case", "pw_c"], ["case", "pw_top"], ["case", "pw_eps"], ["board", "eps8"], ["cpu", "cpu"]], lift: 0.0, bidir: false },
  { id: "pwr_gpu", label: "显卡 12V 供电", color: "#FFC24A", parts: ["psu", "gpu"], points: [["psu", "out"], ["case", "pw_g"], ["gpu", "power"]], lift: 0.0, bidir: false },
  { id: "pwr_hdd", label: "SATA 供电", color: "#FFC24A", parts: ["psu", "hdd"], points: [["psu", "out"], ["case", "pw_h"], ["hdd", "sata"]], lift: 0.0, bidir: false },
];
