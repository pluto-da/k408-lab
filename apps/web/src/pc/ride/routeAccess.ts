// 路线一「一次访存」：把模拟结果编排成站点（讲解里的数字全部来自模拟器）。
import { fmtNs, fmtNum, formulaOf, simulateAccess, type AccessParams, type AccessResult } from "./sim/access";
import { hex, hex32Spaced, hexWidth, mix } from "./sim/addr";
import type { LabLink, LineCue, RidePlan, RideStation, RideSummary, ShellState, TlbCueEntry } from "./types";

export const LAB = {
  tlbcache: { label: "TLB + Cache 地址转换（图解）", to: "/lab#proc-tlbcache" },
  tlbflow: { label: "带 TLB 的虚存访问过程（图解）", to: "/lab#proc-tlbflow" },
  twolevel: { label: "二级页表地址转换（图解）", to: "/lab#proc-twolevel" },
  cache: { label: "Cache 地址映射（实验）", to: "/lab#lab-cache" },
  cachewrite: { label: "Cache 读写流程（图解）", to: "/lab#proc-cachewrite" },
  paging: { label: "页面置换（实验）", to: "/lab#lab-paging" },
  addressing: { label: "寻址方式与有效地址（实验）", to: "/lab#lab-addressing" },
  icycle: { label: "指令周期的数据流（图解）", to: "/lab#proc-icycle" },
  ptLevels: { label: "多级页表的级数（性质）", to: "/lab#prop-os-pt-levels" },
  ptSize: { label: "页表大小（性质）", to: "/lab#prop-os-pt-size" },
  eat: { label: "有效访问时间：快表与缺页（性质）", to: "/lab#prop-os-eat" },
  cacheTa: { label: "Cache 命中率与平均访问时间（性质）", to: "/lab#prop-co-cache-ta" },
  cacheAddr: { label: "Cache 地址划分与总容量（性质）", to: "/lab#prop-co-cache-addr" },
  interleave: { label: "多体低位交叉存储器（性质）", to: "/lab#prop-co-interleave" },
} satisfies Record<string, LabLink>;

const kb = (n: number) => (n >= 1024 ? `${n / 1024} KB` : `${n} B`);
const WAYNAME = (w: number) => (w === 1 ? "直接映射" : `${w} 路组相联`);
const POLICY = { lru: "LRU（最近最少使用）", fifo: "FIFO（先进先出）", random: "随机" } as const;

/** 演示用的取回数据（确定性） */
export const dataWord = (pa: number) => hex(mix(pa, 77), 8);

export function buildAccessPlan(params: AccessParams): RidePlan {
  const r = simulateAccess(params);
  const p = r.p;
  const t = p.t;
  const par = p.mode === "par";
  const n = p.levels;
  const vpnHex = hex(r.vpn, hexWidth(r.vpnBits));
  const offHex = hex(r.off, hexWidth(r.offBits));
  const frameHex = hex(r.frame, hexWidth(r.frameBits));
  const paHex = hex(r.pa, 6);
  const S = r.cache.split;
  const direct = S.ways === 1;
  const ixName = direct ? "行号" : "组号";
  const ctagHex = hex(r.cache.tag, hexWidth(S.tag));
  const ttagHex = hex(r.tlb.tag, hexWidth(r.tlb.tagBits));
  const word = dataWord(r.pa);
  const regBase = hex((r.va - 8) >>> 0, 8);
  const stations: RideStation[] = [];
  let clock = 0;
  const push = (s: Omit<RideStation, "clock">) => {
    clock += s.cost;
    stations.push({ ...s, clock });
  };
  const term = (k: string) => r.terms.filter((x) => x.key === k).reduce((a, x) => a + x.ns, 0);

  const vaShell: ShellState = { kind: "虚拟地址", segs: [{ label: "虚拟地址", value: hex32Spaced(r.va), tone: "plain", bits: 32 }] };
  const splitShell: ShellState = {
    kind: "虚拟地址",
    segs: [
      { label: "虚页号", value: vpnHex, tone: "vpn", bits: r.vpnBits },
      { label: "页内偏移", value: offHex, tone: "off", bits: r.offBits },
    ],
  };
  const paShell: ShellState = {
    kind: "物理地址",
    segs: [
      { label: "页框号", value: frameHex, tone: "frame", bits: r.frameBits },
      { label: "页内偏移", value: offHex, tone: "off", bits: r.offBits },
    ],
  };
  const cacheShell: ShellState = {
    kind: `物理地址 ${paHex}`,
    segs: [
      { label: "标记", value: ctagHex, tone: "tag", bits: S.tag },
      { label: ixName, value: String(r.cache.set), tone: "set", bits: S.idx },
      { label: "块内地址", value: String(r.cache.off), tone: "off", bits: S.off },
    ],
  };

  // ① 产生虚拟地址并拆分
  push({
    id: "issue",
    place: "core",
    title: "我诞生了：一个虚拟地址",
    loc: "CPU · 执行单元",
    caption:
      `指令 LOAD R1, [R2+8] 进入执行阶段：ALU 把 R2 中的 ${regBase} 加上 8，得到要访问的地址 ${hex32Spaced(r.va)}——这就是我。` +
      `程序里用的都是虚拟地址，必须先翻译成物理地址。页大小 ${kb(p.pageSize)}，所以低 ${r.offBits} 位是页内偏移、高 ${r.vpnBits} 位是虚页号：` +
      `虚页号 ${vpnHex}，页内偏移 ${offHex}。`,
    tags: ["变址寻址：EA = (R2) + 8", "虚拟地址 = 虚页号 ‖ 页内偏移"],
    labs: [LAB.addressing, LAB.icycle],
    cost: 0,
    shell: splitShell,
    stop: true,
    what: {
      title: "CPU 执行单元",
      body: "运算器（ALU）与通用寄存器组在这里。访存指令在执行阶段算出有效地址，交给存储管理部件 MMU 去翻译。",
    },
    cue: { kind: "core", phase: "issue", reg: "R2", base: regBase, value: hex32Spaced(r.va), split: [vpnHex, offHex] },
  });

  // ② TLB
  const tlbEntries = (list: typeof r.tlb.before): TlbCueEntry[] =>
    list.map((e) => ({ valid: e.valid, tag: hex(e.tag, hexWidth(r.tlb.tagBits)), frame: hex(e.frame, hexWidth(r.frameBits)) }));
  const tlbHit = r.tlb.hit;
  push({
    id: "tlb",
    place: "tlb",
    title: "查快表 TLB",
    loc: "CPU · MMU 快表",
    caption:
      `TLB 是页表的高速缓存，这里是 4 路组相联、共 8 组。虚页号再拆一次：低 3 位 = ${r.tlb.set} 是 TLB 组号，其余 ${r.tlb.tagBits} 位 ${ttagHex} 是标记。` +
      `第 ${r.tlb.set} 组的 4 项同时与标记比较。`,
    result:
      (tlbHit
        ? `第 ${r.tlb.way} 路有效且标记相等：命中，直接取出页框号 ${frameHex}，一次主存都不用访问。`
        : `没有一项既有效又相等：TLB 缺失，只能去主存里查页表。`) +
      (par && !tlbHit ? "（按「同时查找」口径，查快表与查页表并行，这 " + t.tlb + " ns 被页表访问掩盖。）" : ""),
    tags: ["快表 TLB", tlbHit ? "TLB 命中" : "TLB 缺失"],
    labs: [LAB.tlbcache, LAB.tlbflow],
    cost: term("tlb"),
    shell: {
      kind: "虚拟地址",
      segs: [
        { label: "TLB 标记", value: ttagHex, tone: "tag", bits: r.tlb.tagBits },
        { label: "TLB 组号", value: String(r.tlb.set), tone: "set", bits: 3 },
        { label: "页内偏移", value: offHex, tone: "off", bits: r.offBits },
      ],
    },
    fork: {
      question: "TLB 里找到这一页了吗？",
      options: [
        { id: "hit", label: "命中 → 直接得到页框号" },
        { id: "miss", label: "缺失 → 去主存查页表" },
      ],
      answer: tlbHit ? "hit" : "miss",
      why: tlbHit ? `第 ${r.tlb.way} 路的有效位为 1，标记正好是 ${ttagHex}。` : `第 ${r.tlb.set} 组 4 项里没有「有效位 1 且标记为 ${ttagHex}」的项。`,
      wrong: tlbHit ? "再看一眼高亮的那一路：有效位是 1，标记也相等，所以是命中。" : "命中要求有效位为 1 且标记相等，这一组里没有这样的项。",
    },
    stop: true,
    what: {
      title: "快表 TLB",
      body: "TLB 存放最近用过的页表项，由硬件并行比较。命中时省掉访问主存里页表的那一次（多级页表时省掉 n 次）；TLB 命中说明这一页一定在主存。",
    },
    cue: { kind: "tlb", set: r.tlb.set, entries: tlbEntries(r.tlb.before), hitWay: tlbHit ? r.tlb.way : -1, tag: ttagHex },
  });

  if (!tlbHit) {
    push({
      id: "busOut",
      place: "busOut",
      title: "沿内存总线去主存",
      loc: "主板 · 内存总线 DDR5",
      caption: `页表放在主存里。我离开 CPU，经内存控制器沿内存总线飞向内存条。访问一次主存约 ${t.mem} ns，是查一次 TLB 的 ${t.tlb > 0 ? Math.round(t.mem / t.tlb) : "许多"} 倍。`,
      tags: ["存储器层次：越远越慢"],
      labs: [LAB.cacheTa],
      cost: 0,
      shell: n === 2
        ? {
            kind: "虚拟地址",
            segs: [
              { label: "页目录号", value: String(r.ptIndex[0]), tone: "dir", bits: r.ptBits[0] },
              { label: "页表索引", value: String(r.ptIndex[1]), tone: "tbl", bits: r.ptBits[1] },
              { label: "页内偏移", value: offHex, tone: "off", bits: r.offBits },
            ],
          }
        : splitShell,
      stop: false,
      what: { title: "内存总线", body: "CPU 内的内存控制器经内存总线直连内存条。地址、数据、控制信号都走这里，一次传送 64 位。" },
      cue: { kind: "bus", link: "membus", back: false },
    });

    r.walk.forEach((w, i) => {
      const leaf = i === r.walk.length - 1;
      const rows = w.rows.map((row) => ({
        idx: `#${row.idx}`,
        text: row.valid ? `页框 ${hex(row.frame, leaf ? hexWidth(r.frameBits) : 3)}  V=1` : "——  V=0",
        valid: row.valid,
      }));
      const addr = `${hex(w.base, 8)} + ${w.index} × 4 = ${hex(w.entryAddr, 8)}`;
      let caption: string;
      if (n === 2 && i === 0) {
        caption =
          `一页能放 ${kb(p.pageSize)} / 4 B = ${2 ** r.ptBits[1]!} 个页表项，所以虚页号再分两段：高 ${r.ptBits[0]} 位页目录号 = ${r.ptIndex[0]}，低 ${r.ptBits[1]} 位页表索引 = ${r.ptIndex[1]}。` +
          `页目录项地址 = 页目录基址 ${addr}。第 1 次访存读出这一项：有效，二级页表放在页框 ${hex(w.frame, 3)}。`;
      } else if (n === 2) {
        caption =
          `二级页表起始地址 = 页框号 × ${kb(p.pageSize)} = ${hex(w.base, 8)}，页表项地址 = ${addr}。第 2 次访存读出第 ${w.index} 项。`;
      } else {
        caption =
          `一级页表直接用 ${r.vpnBits} 位虚页号作下标：页表项地址 = 页表基址 ${addr}。第 1 次访存读出这一项。` +
          `一级页表要 2^${r.vpnBits} 项 × 4 B 的连续空间，这正是要分级的原因。`;
      }
      push({
        id: n === 2 ? (i === 0 ? "ptDir" : "ptTbl") : "ptOne",
        place: n === 2 ? (i === 0 ? "ptDir" : "ptTbl") : "ptOne",
        title: n === 2 ? (i === 0 ? "页目录：第一层" : "二级页表：第二层") : "页表：只有一层",
        loc: `内存 · ${w.name}`,
        caption,
        result: leaf ? (w.valid ? `有效位 V = 1，页框号 ${frameHex}。` : "有效位 V = 0：这一页不在主存，要先调页。") : undefined,
        tags: n === 2 ? ["二级页表", `第 ${i + 1} 次访存`] : ["一级页表", "第 1 次访存"],
        labs: n === 2 ? [LAB.twolevel, LAB.ptLevels] : [LAB.ptSize, LAB.ptLevels],
        cost: t.mem,
        shell:
          n === 2
            ? {
                kind: leaf && w.valid ? "页框号已取得" : "虚拟地址",
                segs: [
                  { label: "页目录号", value: String(r.ptIndex[0]), tone: "dir", bits: r.ptBits[0] },
                  { label: i === 0 ? "页表索引" : "页框号", value: i === 0 ? String(r.ptIndex[1]) : w.valid ? frameHex : "?", tone: i === 0 ? "tbl" : "frame", bits: i === 0 ? r.ptBits[1] : r.frameBits },
                  { label: "页内偏移", value: offHex, tone: "off", bits: r.offBits },
                ],
              }
            : { kind: w.valid ? "页框号已取得" : "虚拟地址", segs: [{ label: "页框号", value: w.valid ? frameHex : "?", tone: "frame" }, { label: "页内偏移", value: offHex, tone: "off", bits: r.offBits }] },
        fork: leaf
          ? {
              question: "这一项的有效位 V 是几？",
              options: [
                { id: "v1", label: "V = 1 → 页在主存，取出页框号" },
                { id: "v0", label: "V = 0 → 缺页，请操作系统调页" },
              ],
              answer: w.valid ? "v1" : "v0",
              why: w.valid ? `页表项写着页框 ${frameHex}，V = 1。` : "页表项的有效位为 0：这一页还在外存上。",
              wrong: w.valid ? "高亮那一项的 V 是 1：页在主存，不会缺页。" : "高亮那一项的 V 是 0，页不在主存，要先调页。",
            }
          : undefined,
        stop: true,
        what: {
          title: n === 2 ? "多级页表" : "页表",
          body:
            n === 2
              ? "页目录（顶级页表）最多占一页；每级页表项数 = 页大小 / 页表项大小。分级省下了连续的大块内存，代价是 TLB 缺失时要多访存几次。"
              : "页表把虚页号映射到页框号，常驻主存。没有快表时，取一次数据要访存 2 次：页表 1 次 + 数据 1 次。",
        },
        cue: { kind: "pt", floor: i, floors: r.walk.length, title: `${w.name}（${2 ** w.indexBits} 项）`, rows, hi: w.hi, valid: w.valid, addr },
      });
    });

    if (r.fault) {
      const cost = term("fault") + term("tlb2") + term("walk2");
      push({
        id: "fault",
        place: "fault",
        title: "缺页中断：请操作系统调页",
        loc: "内存 · 缺页处理",
        caption:
          `页表项无效，MMU 产生缺页异常。CPU 保存现场转入操作系统：找一个空闲页框（没有就按页面置换算法换出一页），启动外存把这一页读进来，` +
          `把页框号 ${frameHex} 和 V = 1 写回页表项。外存一次约 ${fmtNs(t.disk)}，相当于 ${fmtNum(Math.round(t.disk / Math.max(1, t.mem)))} 次主存访问。` +
          `处理完后这条 LOAD 指令重新执行：${par ? "" : "再查一次 TLB（仍未命中）、"}再查 ${n} 级页表，又访存 ${n} 次。`,
        tags: ["缺页异常（故障）", "页面置换", "指令重新执行"],
        labs: [LAB.paging, LAB.eat, LAB.tlbflow],
        cost,
        shell: paShell,
        stop: true,
        what: {
          title: "缺页中断",
          body: "缺页属于故障类异常，在指令执行中途产生，处理完后返回并重新执行这条指令。调页的细节在「从硬盘读一个文件」那条路线里。",
        },
        cue: { kind: "fault" },
      });
    }

    push({
      id: "busBack",
      place: "busBack",
      title: "带着页框号回到 CPU",
      loc: "主板 · 内存总线 DDR5",
      caption: `页框号 ${frameHex} 沿内存总线送回 CPU 里的 MMU。`,
      tags: ["地址变换机构"],
      labs: [LAB.tlbflow],
      cost: 0,
      shell: { kind: "页框号已取得", segs: [{ label: "页框号", value: frameHex, tone: "frame", bits: r.frameBits }, { label: "页内偏移", value: offHex, tone: "off", bits: r.offBits }] },
      stop: false,
      what: { title: "内存总线", body: "返回时走同一组数据线。总线是共享的，同一时刻只能有一个主设备占用。" },
      cue: { kind: "bus", link: "membus", back: true },
    });
  }

  // 拼出物理地址
  push({
    id: "mmu",
    place: "mmu",
    title: "拼出物理地址",
    loc: "CPU · MMU",
    caption:
      (tlbHit ? "" : `先把这一项写进 TLB 第 ${r.tlb.set} 组第 ${r.tlb.way} 路，下次访问这一页就能命中。`) +
      `物理地址 = 页框号 ‖ 页内偏移 = ${frameHex} ‖ ${offHex} = ${paHex}。页内偏移在翻译中原样保留，只有页号被换掉。`,
    tags: ["物理地址 = 页框号 ‖ 页内偏移"],
    labs: [LAB.tlbcache],
    cost: 0,
    shell: paShell,
    stop: true,
    what: { title: "存储管理部件 MMU", body: "MMU 负责虚实地址变换，TLB 就在它里面。物理地址的位数由主存容量决定，这里是 24 位。" },
    cue: { kind: "mmu", set: r.tlb.set, entries: tlbEntries(r.tlb.after), fillWay: tlbHit ? -1 : r.tlb.way, pa: paHex },
  });

  // L1
  const lines = (l: typeof r.cache.before): LineCue[] => l.map((x) => ({ valid: x.valid, dirty: x.dirty, tag: hex(x.tag, hexWidth(S.tag)) }));
  const l1Hit = r.cache.l1Hit;
  const paBits = `标记 ${S.tag} 位 | ${ixName} ${S.idx} 位 | 块内地址 ${S.off} 位`;
  push({
    id: "l1",
    place: "l1",
    title: `L1：在第 ${r.cache.set} ${direct ? "行" : "组"}里比较标记`,
    loc: "CPU · L1 数据 Cache",
    caption:
      `L1 容量 ${kb(p.l1Size)}、块 ${p.blockSize} B、${WAYNAME(S.ways)}：共 ${kb(p.l1Size)} / ${p.blockSize} B = ${S.lines} 行` +
      (direct ? "。" : `，分成 ${S.sets} 组。`) +
      `24 位物理地址拆成 ${paBits}：标记 ${ctagHex}，${ixName} ${r.cache.set}，块内地址 ${r.cache.off}。` +
      (direct ? `直接定位到第 ${r.cache.set} 行，比较它的标记。` : `直接选中第 ${r.cache.set} 组，组内 ${S.ways} 行同时比较标记。`),
    result:
      (l1Hit ? `第 ${r.cache.way} 路有效且标记相等：命中！` : `没有一行的标记是 ${ctagHex}：L1 缺失。`) +
      (par && !l1Hit ? "（各级同时查找时，L1 这一次不单独计时。）" : ""),
    tags: ["Cache 地址划分", WAYNAME(S.ways), l1Hit ? "L1 命中" : "L1 缺失"],
    labs: [LAB.cache, LAB.cacheAddr],
    cost: term("l1"),
    shell: cacheShell,
    fork: {
      question: "L1 里有这一块吗？",
      options: [
        { id: "hit", label: "命中 → 直接取数" },
        { id: "miss", label: "缺失 → 去 L2 找" },
      ],
      answer: l1Hit ? "hit" : "miss",
      why: l1Hit ? `第 ${r.cache.way} 路有效位为 1，标记正是 ${ctagHex}。` : `这一${direct ? "行" : "组"}里没有标记为 ${ctagHex} 的有效行。`,
      wrong: l1Hit ? "高亮那一行的标记与地址里的标记相等且有效，这是命中。" : "逐行看标记：都不等于地址里的标记，所以缺失。",
    },
    stop: true,
    what: {
      title: "L1 数据 Cache",
      body: "离运算器最近的一级 Cache，用 SRAM 做成，分指令 Cache 和数据 Cache。组相联时先用组号选组，再在组内并行比较标记。",
    },
    cue: { kind: "cache", phase: "lookup", set: r.cache.set, sets: S.sets, ways: S.ways, block: p.blockSize, tag: ctagHex, lines: lines(r.cache.before), hitWay: l1Hit ? r.cache.way : -1, victimWay: -1, after: lines(r.cache.after) },
  });

  const reach = ["l1", "l2", "l3", "mem"].indexOf(r.cache.outcome);
  for (const level of [2, 3] as const) {
    if (reach < level - 1) break;
    const hit = reach === level - 1;
    push({
      id: `l${level}`,
      place: level === 2 ? "l2" : "l3",
      title: level === 2 ? "L2：再往外一层" : "L3：多核共享的仓库",
      loc: level === 2 ? "CPU · L2（每核私有）" : "CPU · L3（多核共享）",
      caption:
        level === 2 ? `L2 比 L1 大，也慢一些（约 ${t.l2} ns）。` : `L3 由所有核心共享，容量最大，约 ${t.l3} ns。`,
      result:
        (hit ? `在这里找到了物理地址 ${paHex} 所在的块，整块送往 L1。` : level === 2 ? "这里也没有，继续去 L3。" : "三级 Cache 都没有，只能去主存。") +
        (par && !hit ? "（同时查找口径下不单独计时。）" : ""),
      tags: ["多级 Cache", hit ? `L${level} 命中` : `L${level} 缺失`],
      labs: [LAB.cacheTa],
      cost: term(`l${level}`),
      shell: cacheShell,
      fork: {
        question: `L${level} 里有这一块吗？`,
        options: [
          { id: "hit", label: "命中 → 整块搬回 L1" },
          { id: "miss", label: level === 2 ? "缺失 → 去 L3" : "缺失 → 去主存" },
        ],
        answer: hit ? "hit" : "miss",
        why: hit ? `L${level} 存有这一块。` : `L${level} 里没有这一块。`,
        wrong: hit ? `这次参数设置为数据在 L${level} 里，所以命中。` : `这次数据不在 L${level}，要继续往外找。`,
      },
      stop: true,
      what: {
        title: level === 2 ? "L2 Cache" : "L3 Cache",
        body: level === 2 ? "每个核心私有，容量比 L1 大一个数量级，速度慢几倍。" : "多核共享的最后一级 Cache；未命中就要访问主存，代价最大。",
      },
      cue: { kind: "lower", level, hit },
    });
  }

  if (r.cache.outcome === "mem") {
    push({
      id: "busMem",
      place: "busMem",
      title: "去主存取整块",
      loc: "主板 · 内存总线 DDR5",
      caption: `按块访问主存：物理地址 ${paHex} 所在的整块 ${p.blockSize} B 都要读回来，因为相邻的数据很可能马上就用到（空间局部性）。`,
      tags: ["局部性原理", "按块调入"],
      labs: [LAB.cacheTa],
      cost: 0,
      shell: cacheShell,
      stop: false,
      what: { title: "内存总线", body: "Cache 与主存之间以块为单位交换数据。" },
      cue: { kind: "bus", link: "membus", back: false },
    });
    push({
      id: "dram",
      place: "dram",
      title: "内存颗粒：先选行、再选列",
      loc: "内存 · DRAM 颗粒",
      caption:
        `DRAM 地址分两次送入：先送行地址，把第 ${r.dram.row} 行整行读进行缓冲；再送列地址，从第 ${r.dram.col} 列起连续送出。` +
        `一块 ${p.blockSize} B 以突发方式在几个总线周期内传完。电容会漏电，所以 DRAM 还要定期刷新。`,
      tags: ["DRAM 行列地址", "主存访问约 " + t.mem + " ns"],
      labs: [LAB.interleave],
      cost: term("mem"),
      shell: { kind: "整块数据", segs: [{ label: `块 ${p.blockSize} B`, value: `${hex(Math.floor(r.pa / p.blockSize) * p.blockSize, 6)} 起`, tone: "data" }] },
      stop: true,
      what: { title: "DRAM 颗粒", body: "每个存储元是一个电容加一个晶体管。颗粒内部分成多个 Bank，按行激活、按列读写；多体交叉可以让多个 Bank 轮流工作。" },
      cue: { kind: "dram", row: r.dram.row, col: r.dram.col, bank: r.dram.bank },
    });
    push({
      id: "busMemBack",
      place: "busMemBack",
      title: "整块回到 CPU",
      loc: "主板 · 内存总线 DDR5",
      caption: "这一块沿内存总线回到 CPU，依次装入 L3、L2，再装入 L1。",
      tags: ["逐级调入"],
      labs: [LAB.cachewrite],
      cost: 0,
      shell: { kind: "整块数据", segs: [{ label: `块 ${p.blockSize} B`, value: `${hex(Math.floor(r.pa / p.blockSize) * p.blockSize, 6)} 起`, tone: "data" }] },
      stop: false,
      what: { title: "内存总线", body: "数据线一次传 64 位，一整块要连续传几次。" },
      cue: { kind: "bus", link: "membus", back: true },
    });
  }

  if (!l1Hit) {
    const ev = r.cache.victimTag;
    const evHex = ev === null ? "" : hex(ev, hexWidth(S.tag));
    const why = direct
      ? `直接映射没有选择余地：只能放进第 ${r.cache.set} 行，原来标记为 ${evHex} 的块被换出。`
      : p.policy === "lru"
        ? `第 ${r.cache.set} 组 ${S.ways} 行都有效，需要替换。按 LRU 换掉最久没用过的第 ${r.cache.way} 路（标记 ${evHex}）。`
        : p.policy === "fifo"
          ? `第 ${r.cache.set} 组 ${S.ways} 行都有效，需要替换。按 FIFO 换掉最早装入的第 ${r.cache.way} 路（标记 ${evHex}）。`
          : `第 ${r.cache.set} 组 ${S.ways} 行都有效，需要替换。随机选中了第 ${r.cache.way} 路（标记 ${evHex}）。`;
    push({
      id: "fill",
      place: "fill",
      title: "装入 L1：替换哪一行？",
      loc: "CPU · L1 数据 Cache",
      caption: `${why}新块装入这一行：有效位置 1，标记写成 ${ctagHex}。被换出的行脏位为 0，不必写回；若脏位为 1，要先把它写回下一级。`,
      tags: ["替换算法 " + (direct ? "（直接映射无须选择）" : POLICY[p.policy]), "写回法与脏位"],
      labs: [LAB.cache, LAB.cachewrite],
      cost: 0,
      shell: cacheShell,
      stop: true,
      what: { title: "替换算法", body: "组满时才需要替换。LRU 换最久未用的行，FIFO 换最早装入的行，随机替换实现最简单；直接映射每块只有一个位置，不需要替换算法。" },
      cue: { kind: "cache", phase: "fill", set: r.cache.set, sets: S.sets, ways: S.ways, block: p.blockSize, tag: ctagHex, lines: lines(r.cache.before), hitWay: -1, victimWay: r.cache.way, after: lines(r.cache.after) },
    });
  }

  push({
    id: "reg",
    place: "reg",
    title: "落进寄存器 R1",
    loc: "CPU · 寄存器组",
    caption: `按块内地址 ${r.cache.off} 从这一块里取出 4 字节 ${word}，送进 R1。LOAD 指令的访存阶段结束，下一步写回。我这一趟到此结束。`,
    tags: ["访存 → 写回", "R1 ← M[" + paHex + "]"],
    labs: [LAB.icycle],
    cost: 0,
    shell: { kind: "数据", segs: [{ label: "R1", value: word, tone: "data" }] },
    stop: true,
    what: { title: "通用寄存器组", body: "寄存器是存储层次的最顶层，在一个时钟周期内就能读写。" },
    cue: { kind: "core", phase: "reg", reg: "R1", base: regBase, value: word, split: [vpnHex, offHex] },
  });

  return { routeId: "access", title: "一次访存", initialShell: vaShell, stations, summary: buildSummary(r) };
}

function buildSummary(r: AccessResult): RideSummary {
  const p = r.p;
  const t = p.t;
  const n = p.levels;
  const par = p.mode === "par";
  const reach = ["l1", "l2", "l3", "mem"].indexOf(r.cache.outcome);
  const rows = [
    { label: "TLB", value: r.tlb.hit ? "命中" : "缺失", bad: !r.tlb.hit },
    ...(r.tlb.hit ? [] : [{ label: "页表", value: `${n} 级${r.fault ? "，缺页 1 次" : ""}`, bad: r.fault }]),
    { label: "L1", value: reach === 0 ? "命中" : "缺失", bad: reach > 0 },
    ...(reach >= 1 ? [{ label: "L2", value: reach === 1 ? "命中" : "缺失", bad: reach > 1 }] : []),
    ...(reach >= 2 ? [{ label: "L3", value: reach === 2 ? "命中" : "缺失", bad: reach > 2 }] : []),
    { label: "访存次数", value: `${r.memAccesses} 次` },
    ...(r.diskAccesses ? [{ label: "访问外存", value: `${r.diskAccesses} 次`, bad: true }] : []),
  ];
  const parts = ["CPU 执行单元", "MMU 与 TLB"];
  if (!r.tlb.hit) parts.push("内存总线", "内存里的页表");
  parts.push("L1 Cache");
  if (reach >= 1) parts.push("L2 Cache");
  if (reach >= 2) parts.push("L3 Cache");
  if (reach >= 3) parts.push("内存颗粒");
  parts.push("寄存器 R1");
  const savedByTlb = r.tlb.hit ? 0 : n * t.mem + (par ? -t.tlb : 0);
  const lam = t.tlb;
  const tm = t.mem;
  const eatSeq = `EAT = a(λ + t) + (1 − a)(λ + ${n + 1}t)`;
  const eatPar = `EAT = a(λ + t) + (1 − a)·${n + 1}t`;
  const subSeq = `= a(${lam} + ${tm}) + (1 − a)(${lam} + ${n + 1} × ${tm})`;
  const subPar = `= a(${lam} + ${tm}) + (1 − a) × ${n + 1} × ${tm}`;
  const a9 = par ? 0.9 * (lam + tm) + 0.1 * (n + 1) * tm : 0.9 * (lam + tm) + 0.1 * (lam + (n + 1) * tm);
  const formulas = [
    { title: "本次访问时间（各段之和）", lines: [r.terms.map((x) => `${x.label} ${fmtNum(x.ns)} ns`).join(" + "), formulaOf(r)] },
    {
      title: par ? "有效访问时间 · 快表与页表同时查找" : "有效访问时间 · 先查快表",
      lines: [
        `${par ? eatPar : eatSeq}（λ 查快表，t 访存，a 快表命中率，${n} 级页表，数据在主存）`,
        `${par ? subPar : subSeq}；a = 0.9 时 EAT = ${fmtNum(Math.round(a9 * 100) / 100)} ns`,
      ],
    },
    {
      title: par ? "Cache 平均访问时间 · 同时访问" : "Cache 平均访问时间 · 先查 Cache",
      lines: [
        par ? "t = h·tc + (1 − h)·tm" : "t = h·tc + (1 − h)(tc + tm)",
        par
          ? `设命中率 h = 0.95、tc = ${t.l1}、tm = ${tm}：t = 0.95 × ${t.l1} + 0.05 × ${tm} = ${fmtNum(Math.round((0.95 * t.l1 + 0.05 * tm) * 100) / 100)} ns`
          : `设命中率 h = 0.95、tc = ${t.l1}、tm = ${tm}：t = 0.95 × ${t.l1} + 0.05 × (${t.l1} + ${tm}) = ${fmtNum(Math.round((t.l1 + 0.05 * tm) * 100) / 100)} ns`,
      ],
    },
  ];
  const topics = [LAB.tlbcache, LAB.cache, LAB.twolevel, LAB.ptLevels, LAB.eat, LAB.cacheTa];
  if (r.fault) topics.splice(2, 0, LAB.paging);
  const retry: RideSummary["retry"] = [];
  if (!r.tlb.hit) retry.push({ label: "把 TLB 设为命中", hint: `能省 ${fmtNs(savedByTlb + (r.fault ? t.disk + (par ? 0 : t.tlb) + n * tm : 0))}`, patch: { tlbHit: true, resident: true } });
  else retry.push({ label: "让 TLB 缺失", hint: `多查 ${n} 级页表`, patch: { tlbHit: false } });
  if (p.ways !== 1) retry.push({ label: "改成直接映射", hint: "只有一个位置可放", patch: { ways: 1 } });
  else retry.push({ label: "改成 4 路组相联", hint: "组内可选替换", patch: { ways: 4 } });
  if (r.cache.outcome !== "l1") retry.push({ label: "让数据在 L1 命中", hint: "最快的情况", patch: { outcome: "l1", resident: true } });
  if (!r.fault) retry.push({ label: "模拟一次缺页", hint: "TLB 缺失 + 页不在主存", patch: { tlbHit: false, resident: false } });
  else retry.push({ label: "页在主存", hint: "不缺页", patch: { resident: true } });
  if (p.levels === 2) retry.push({ label: "改用一级页表", hint: "少访存 1 次", patch: { levels: 1 } });
  else retry.push({ label: "改用二级页表", hint: "多访存 1 次", patch: { levels: 2 } });
  return { totalNs: r.totalNs, formula: formulaOf(r), parts, rows, formulas, topics, retry };
}
