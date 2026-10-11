// 「化身数据」路线的数据格式：画面层只按站点列表播放。

/** 站点所在的场景位置 */
export type PlaceId =
  | "core"
  | "tlb"
  | "busOut"
  | "ptDir"
  | "ptTbl"
  | "ptOne"
  | "fault"
  | "busBack"
  | "mmu"
  | "l1"
  | "l2"
  | "l3"
  | "busMem"
  | "dram"
  | "busMemBack"
  | "fill"
  | "reg";

/** 场景：CPU 内部 / 内存内部 / 机箱里的总线 */
export type World = "chip" | "mem" | "pc";

export type Tone = "vpn" | "off" | "tag" | "set" | "frame" | "data" | "plain" | "dir" | "tbl";

export interface ShellSeg {
  label: string;
  value: string;
  tone: Tone;
  bits?: number;
}

export interface ShellState {
  /** 我现在是什么：虚拟地址 / 物理地址 / 数据 */
  kind: string;
  segs: ShellSeg[];
}

export interface LabLink {
  label: string;
  to: string;
}

export interface ForkOption {
  id: string;
  /** 通道上写的条件 */
  label: string;
}

export interface ForkDef {
  question: string;
  options: ForkOption[];
  answer: string;
  /** 正确答案的理由 */
  why: string;
  /** 选错时的提示 */
  wrong: string;
}

export interface TlbCueEntry {
  valid: boolean;
  tag: string;
  frame: string;
}

export interface PtCueRow {
  idx: string;
  text: string;
  valid: boolean;
}

export interface LineCue {
  valid: boolean;
  dirty: boolean;
  tag: string;
}

export type SceneCue =
  | { kind: "core"; phase: "issue" | "reg"; reg: string; base: string; value: string; split: [string, string] }
  | { kind: "tlb"; set: number; entries: TlbCueEntry[]; hitWay: number; tag: string }
  | { kind: "mmu"; set: number; entries: TlbCueEntry[]; fillWay: number; pa: string }
  | { kind: "pt"; floor: number; floors: number; title: string; rows: PtCueRow[]; hi: number; valid: boolean; addr: string }
  | { kind: "fault" }
  | { kind: "bus"; link: "membus"; back: boolean }
  | { kind: "cache"; phase: "lookup" | "fill"; set: number; sets: number; ways: number; block: number; tag: string; lines: LineCue[]; hitWay: number; victimWay: number; after: LineCue[] }
  | { kind: "lower"; level: 2 | 3; hit: boolean }
  | { kind: "dram"; row: number; col: number; bank: number };

export interface RideStation {
  id: string;
  place: PlaceId;
  title: string;
  /** HUD 左上的位置 */
  loc: string;
  caption: string;
  /** 岔路口的结果（「我来判断」时答完才显示） */
  result?: string;
  tags: string[];
  labs: LabLink[];
  /** 本站计入的时间（ns） */
  cost: number;
  /** 到本站结束为止累计（ns） */
  clock: number;
  /** 到站后数据外壳显示的内容 */
  shell: ShellState;
  fork?: ForkDef;
  /** 自动巡航时是否在这里停下等「继续」 */
  stop: boolean;
  /** 「这是什么？」卡片 */
  what: { title: string; body: string };
  cue: SceneCue;
}

export interface RideSummaryRow {
  label: string;
  value: string;
  bad?: boolean;
}

export interface RideSummary {
  totalNs: number;
  formula: string;
  parts: string[];
  rows: RideSummaryRow[];
  /** 公式与代入式 */
  formulas: { title: string; lines: string[] }[];
  topics: LabLink[];
  /** 「换个参数再走一遍」 */
  retry: { label: string; hint: string; patch: Record<string, unknown> }[];
}

export interface RidePlan {
  routeId: string;
  title: string;
  initialShell: ShellState;
  stations: RideStation[];
  summary: RideSummary;
}
