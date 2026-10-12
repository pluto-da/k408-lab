// CPU 内部世界：寄存器组与 ALU、MMU 与 TLB、L1 / L2 / L3 三层「仓库」、通往内存控制器的出口。
import * as THREE from "three";
import type { LineCue, RideStation, SceneCue, TlbCueEntry } from "../types";
import { CHIP } from "./layout";
import { C, FONT, Gate, MONO, TextPlate, UI, badge, disposeTree, dust, glowBox, gridFloor, lane, panelBg, rr, text, worldFont, planeCorners, type FocusSpec, type SceneLabel } from "./kit";

type Cue<K extends SceneCue["kind"]> = Extract<SceneCue, { kind: K }>;

const CMP_STEP = 0.32;
const V3 = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
/** 快表文字板：放在寄存器组的右前方，略微转向主通道，与寄存器组在镜头方向上错开 */
const TLB_POS = V3(3.0, 3.0, -13.2);
const TLB_YAW = -0.24;
/** 文字板上必须看清的最小字（逻辑像素）：完整版 / 小屏简化版 */
const MIN_FONT = { full: 30, compact: 44 };
/** 区域环境色（极低饱和度）：CPU 内部偏冷蓝，MMU / TLB 一带略偏紫 */
const LOWER = "#7d8aa6";
const ENV = { core: new THREE.Color("#0a0d15"), mmu: new THREE.Color("#0d0c17") };

/** 连续画几段不同颜色的字（同一基线），返回结束位置 */
function runs(g: CanvasRenderingContext2D, x: number, y: number, size: number, parts: [string, string, boolean?][], weight = 600) {
  let cx = x;
  for (const [t, color, mono] of parts) {
    text(g, t, cx, y, size, color, weight, "left", mono ? MONO : FONT);
    g.font = `${weight} ${size}px ${mono ? MONO : FONT}`;
    cx += g.measureText(t).width;
  }
  return cx;
}
const runsW = (g: CanvasRenderingContext2D, size: number, parts: [string, string, boolean?][], weight = 600) =>
  parts.reduce((a, [t, , mono]) => {
    g.font = `${weight} ${size}px ${mono ? MONO : FONT}`;
    return a + g.measureText(t).width;
  }, 0);

export class ChipWorld {
  readonly scene = new THREE.Scene();
  private lanes: THREE.Mesh[] = [];
  private regs: { box: THREE.Group; plate: TextPlate }[] = [];
  private alu: THREE.Group;
  private aluPlate: TextPlate;
  private tlbPlate: TextPlate;
  private mmuPlate: TextPlate;
  private cacheBack: TextPlate;
  private slabs: { mesh: THREE.Mesh<THREE.BoxGeometry, THREE.MeshBasicMaterial>; plate: TextPlate; home: THREE.Vector3 }[] = [];
  private incoming: { mesh: THREE.Mesh<THREE.BoxGeometry, THREE.MeshBasicMaterial>; plate: TextPlate };
  private lower: Record<2 | 3, { box: THREE.Group; plate: TextPlate; block: THREE.Mesh<THREE.BoxGeometry, THREE.MeshBasicMaterial> }>;
  readonly gates: Record<string, Record<string, Gate>> = {};
  private portals: THREE.Mesh<THREE.TorusGeometry, THREE.MeshBasicMaterial>[] = [];
  private plates: TextPlate[] = [];
  readonly labels: SceneLabel[] = [];
  private q: number;
  private compact = false;
  private lastTlb: Cue<"tlb"> | null = null;

  constructor(opts: { phone: boolean; low: boolean }) {
    this.q = opts.low || opts.phone ? 0.75 : 1;
    const s = this.scene;
    s.background = ENV.core.clone();
    s.fog = new THREE.FogExp2(ENV.core.getHex(), 0.028);
    s.add(gridFloor(220, "#56658a"));
    s.add(dust(opts.phone || opts.low ? 60 : 140, new THREE.Box3(new THREE.Vector3(-12, 0.3, -72), new THREE.Vector3(12, 8, 14))));

    // 走线：主通道（青）、回程通道（绿）、去内存控制器的支路（紫）
    const L = CHIP.laneX;
    const mk = (pts: THREE.Vector3[], c: string, w?: number) => {
      const m = lane(pts.map((p) => new THREE.Vector3(p.x, 0, p.z)), c, w, 0.38);
      this.lanes.push(m);
      s.add(m);
    };
    mk([new THREE.Vector3(0, 0, 12), new THREE.Vector3(0, 0, -68)], C.dmi, 0.7);
    mk([new THREE.Vector3(2.4, 0, -62.5), new THREE.Vector3(L, 0, -58), new THREE.Vector3(L, 0, 4), new THREE.Vector3(2, 0, 9)], C.nic, 0.5);
    mk([new THREE.Vector3(0, 0, -15), new THREE.Vector3(-2.3, 0, -18.2), new THREE.Vector3(-5, 0, -21.4), CHIP.portal], C.membus, 0.5);


    // ---- 寄存器组与 ALU（z = 0）
    for (let i = 0; i < 8; i++) {
      const x = -3.5 + i * 1.0;
      const box = glowBox(0.86, 0.62, 0.3, C.cu, 0.1);
      box.position.set(x, 3.0, 0);
      const plate = this.plate(200, 140, 0.8);
      plate.mesh.position.set(x, 3.0, 0.17);
      s.add(box);
      this.regs.push({ box, plate });
    }
    this.label("通用寄存器组", V3(0, 3.62, 0), C.cu, "reg");
    // ALU 紧贴在寄存器组下方：第 1 站的基址寄存器和地址加法器可以同框
    this.alu = glowBox(2.4, 0.9, 1.2, C.alu, 0.12);
    this.alu.position.set(0, 1.75, -0.6);
    s.add(this.alu);
    this.aluPlate = this.plate(420, 120, 2.0);
    this.aluPlate.mesh.position.set(0, 1.75, 0.02);
    const cu = glowBox(1.6, 1.4, 1.0, C.cu, 0.1);
    cu.position.set(-5, 0.7, -0.4);
    s.add(cu);
    this.label("CU 控制器", V3(-5, 1.7, -0.4), C.cu, "reg");
    this.label("ALU 运算器", V3(1.95, 1.2, 0), C.alu, "core");
    // 控制信号线：CU → 寄存器 / ALU
    const ctl = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-4.2, 1.2, -0.4), new THREE.Vector3(-3.5, 2.7, 0),
      new THREE.Vector3(-4.2, 0.9, -0.4), new THREE.Vector3(-1.2, 1.6, -0.6),
    ]);
    s.add(new THREE.LineSegments(ctl, new THREE.LineBasicMaterial({ color: C.cu, transparent: true, opacity: 0.6 })));

    // ---- MMU / TLB（z = -14）
    this.tlbPlate = this.plate(1200, 680, 6.0);
    this.tlbPlate.mesh.position.copy(TLB_POS);
    this.tlbPlate.mesh.rotation.y = TLB_YAW;
    this.label("MMU · 快表 TLB", TLB_POS.clone().add(V3(0, 2.05, 0)), C.membus, "tlb");
    this.addGates("tlb", CHIP.tlbGates, { miss: ["缺失 → 去主存查页表", C.bad], hit: ["命中 → 直接得到页框号", C.ok] });
    this.mmuPlate = this.plate(900, 420, 4.2);
    this.mmuPlate.mesh.position.copy(CHIP.mmuPlate);
    this.mmuPlate.mesh.lookAt(CHIP.mmu.pos.x, CHIP.mmuPlate.y, CHIP.mmu.pos.z);

    // ---- L1（z = -34）
    this.cacheBack = this.plate(1200, 780, 5.0);
    this.cacheBack.mesh.position.set(0, 3.6, -34.35);
    for (let i = 0; i < 8; i++) {
      // 行本身只是文字板的支架：不再画半透明的彩色盒子（它比文字板宽、前表面又贴得很近，会在左右露出一圈闪烁的绿边）
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(3.3, 0.42, 0.16), new THREE.MeshBasicMaterial({ visible: false, transparent: true, opacity: 0.16, depthWrite: false }));
      const plate = this.plate(800, 100, 3.3);
      plate.mesh.position.z = 0.09;
      mesh.add(plate.mesh);
      s.add(mesh);
      this.slabs.push({ mesh, plate, home: new THREE.Vector3() });
    }
    {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(3.3, 0.42, 0.16), new THREE.MeshBasicMaterial({ visible: false, transparent: true, opacity: 0.3, depthWrite: false }));
      const plate = this.plate(800, 100, 3.3);
      plate.mesh.position.z = 0.09;
      mesh.add(plate.mesh);
      mesh.visible = false;
      s.add(mesh);
      this.incoming = { mesh, plate };
    }
    this.label("L1 数据 Cache", V3(0, 6.15, -34.3), C.l1, "l1");
    this.addGates("l1", CHIP.l1Gates, { miss: ["缺失 → 去 L2 找", C.bad], hit: ["命中 → 直接取数", C.ok] });

    // ---- L2 / L3
    // L2 / L3 的外框用中性的钢灰：绿色只表示命中、红色只表示缺失
    const mkLower = (level: 2 | 3, z: number, _color: string, label: string) => {
      const box = glowBox(level === 2 ? 5.2 : 5.8, 2.2, 1.6, LOWER, 0.05);
      box.position.set(0, 3.8, z);
      s.add(box);
      const plate = this.plate(900, 220, level === 2 ? 4.8 : 5.4);
      plate.mesh.position.set(0, 3.8, z + 0.82);
      const block = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.42, 0.42), new THREE.MeshBasicMaterial({ color: UI.ok, transparent: true, opacity: 0, toneMapped: false }));
      block.position.set(0, 2.5, z + 0.9);
      s.add(block);
      plate.draw(label, (g, w, h) => {
        panelBg(g, w, h, 0.82);
        text(g, label, w / 2, h / 2, 54, C.ink, 600, "center");
      });
      return { box, plate, block };
    };
    this.lower = {
      2: mkLower(2, -47, C.l2, "L2 Cache · 每核私有"),
      3: mkLower(3, -59, C.l3, "L3 Cache · 多核共享"),
    };
    this.addGates("l2", CHIP.l2Gates, { miss: ["缺失 → 去 L3", C.bad], hit: ["命中 → 整块搬回 L1", C.ok] });
    this.addGates("l3", CHIP.l3Gates, { miss: ["缺失 → 去主存", C.bad], hit: ["命中 → 整块搬回 L1", C.ok] });

    // ---- 出入口
    for (const [p, label] of [
      [CHIP.portal, "内存控制器 → 内存总线"],
      [CHIP.portalFar, "内存控制器 → 内存总线"],
    ] as const) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(1.25, 0.06, 8, 48), new THREE.MeshBasicMaterial({ color: C.membus, transparent: true, toneMapped: false }));
      ring.position.copy(p);
      if (p === CHIP.portal) ring.rotation.y = Math.PI / 2 - 0.3;
      s.add(ring);
      this.portals.push(ring);
      this.label(label, p.clone().add(V3(0, 1.75, 0)), C.membus, "portal");
    }
    this.label("回程通道 → 寄存器", V3(L, 3.3, -12), C.nic, "return");

    this.layoutSlabs(4);
    this.drawRegs(-1, "");
    this.drawAlu("", 0);
  }

  private plate(w: number, h: number, worldW: number) {
    const p = new TextPlate(w, h, worldW, this.q);
    this.plates.push(p);
    this.scene.add(p.mesh);
    return p;
  }

  private label(text0: string, pos: THREE.Vector3, color: string, tag?: string) {
    this.labels.push({ text: text0, pos, color, tag });
  }

  private addGates(id: string, at: { miss: THREE.Vector3; hit: THREE.Vector3 }, labels: { miss: [string, string]; hit: [string, string] }) {
    const g: Record<string, Gate> = {};
    for (const k of ["miss", "hit"] as const) {
      const gate = new Gate(labels[k][0], labels[k][1], this.q);
      gate.group.position.copy(at[k]);
      this.scene.add(gate.group);
      g[k] = gate;
    }
    this.gates[id] = g;
  }

  // ------------------------------------------------------------ drawing
  private drawRegs(hi: number, value: string) {
    this.regs.forEach((r, i) => {
      const on = i === hi;
      const name = `R${i}`;
      const v = on ? value : "";
      // 小屏只留 R1 ~ R3
      const show = !this.compact || (i >= 1 && i <= 3);
      r.box.visible = r.plate.mesh.visible = show;
      r.plate.draw(`${name}|${on}|${v}`, (g, w) => {
        text(g, name, w / 2, 40, 40, on ? "#fff" : C.dim, 600, "center");
        if (v) text(g, v.replace(/^0x/, "").replace(/\s/g, ""), w / 2, 100, 36, UI.ink, 600, "center", MONO);
      });
      // 当前寄存器：主色描边
      (r.box.userData.fill as THREE.MeshBasicMaterial).opacity = on ? 0.22 : 0.08;
      (r.box.userData.edge as THREE.LineBasicMaterial).color.set(on ? UI.accent : C.cu);
      (r.box.userData.edge as THREE.LineBasicMaterial).opacity = on ? 1 : 0.55;
    });
  }

  private drawAlu(expr: string, k: number) {
    this.aluPlate.draw(`${expr}|${k > 0}`, (g, w, h) => {
      text(g, expr || "ALU", w / 2, h / 2, expr ? 46 : 52, k > 0 ? UI.ink : C.dim, 600, "center", expr ? MONO : undefined);
    });
    // ALU 保持自己的颜色，但压低饱和的填充，不抢文字
    (this.alu.userData.fill as THREE.MeshBasicMaterial).opacity = 0.05 + 0.1 * k;
    (this.alu.userData.edge as THREE.LineBasicMaterial).opacity = 0.45 + 0.35 * k;
  }

  /**
   * 快表文字板。cmp：已经比到第几路（逐路比较时当前路主色描边）；result：比较结束后命中的那一路变绿，
   * 缺失时只在表头出现红色「缺失」徽章，各行不整体变红。组号用青绿、查找标记用琥珀，与讲解栏的地址条同色。
   */
  private drawTlb(c: Cue<"tlb">, cmp: number, result: "pending" | "hit" | "miss" | "none") {
    const compact = this.compact;
    const key = `${compact}|${c.set}|${c.tag}|${cmp}|${result}|${c.entries.map((e) => e.tag).join()}`;
    if (compact) this.tlbPlate.resize(1000, 640);
    else this.tlbPlate.resize(1200, 680);
    const done = result === "hit" || result === "miss";
    const row = (g: CanvasRenderingContext2D, k: number, x: number, y: number, w: number, h: number) => {
      const isHit = result === "hit" && c.hitWay === k;
      const cur = !done && cmp === k + 1;
      rr(g, x, y, w, h, 10);
      g.fillStyle = isHit ? UI.okSoft : cur ? UI.accentSoft : UI.row;
      g.fill();
      g.lineWidth = isHit || cur ? 3 : 1.5;
      g.strokeStyle = isHit ? UI.ok : cur ? UI.accent : UI.rowLine;
      g.stroke();
    };
    // 刚比完、不相等的那一路：标记数字闪一下红色（下一路开始比较时恢复）
    const mism = (e: TlbCueEntry) => !e.valid || e.tag !== c.tag;
    const tagColor = (k: number, e: TlbCueEntry) => (result === "none" && cmp === k + 2 && mism(e) ? UI.badInk : "#fff");
    const ne = (k: number, e: TlbCueEntry) => (result === "hit" || result === "miss") && mism(e) && !(result === "hit" && c.hitWay === k);
    this.tlbPlate.draw(key, (g, w, h) => {
      panelBg(g, w, h, 0.9);
      if (compact) {
        // 小屏：只画当前组的 4 项
        runs(g, 36, 52, 46, [["TLB ", UI.ink], [`第 ${c.set} 组`, UI.set], [" · 4 路", UI.ink2]]);
        const tw = runsW(g, 46, [[c.tag, UI.tag, true]]);
        text(g, c.tag, w - 36, 52, 46, UI.tag, 600, "right", MONO);
        text(g, "标记", w - 36 - tw - 14, 52, 44, UI.ink3, 500, "right");
        const cols = [36, 170, 400, 700];
        ["路", "有效位", "标记", "页框号"].forEach((t, i) => text(g, t, cols[i]! + 8, 124, 44, C.dim, 500));
        for (let k = 0; k < 4; k++) {
          const e: TlbCueEntry = c.entries[k]!;
          const y = 156 + k * 108;
          row(g, k, 24, y, w - 48, 98);
          text(g, String(k), cols[0]! + 18, y + 49, 46, UI.ink2, 600, "left", MONO);
          text(g, `V=${e.valid ? 1 : 0}`, cols[1]! + 8, y + 49, 46, e.valid ? C.ink : UI.badInk, 600, "left", MONO);
          text(g, e.tag, cols[2]! + 8, y + 49, 48, tagColor(k, e), 600, "left", MONO);
          if (ne(k, e)) text(g, "≠", cols[3]! - 24, y + 49, 44, UI.ink3, 500, "right");
          text(g, e.valid ? e.frame : "—", cols[3]! + 8, y + 49, 48, e.valid ? "#fff" : UI.ink3, 500, "left", MONO);
        }
        if (done) badge(g, result === "hit" ? "命中" : "缺失", 36, h - 34, 40, result === "hit", "left");
        text(g, "其余 7 组已折叠", w - 36, h - 32, 44, UI.ink3, 500, "right");
        return;
      }
      const tEnd = runs(g, 40, 52, 34, [["TLB · 4 路组相联 · 8 组", UI.ink]]);
      if (done) badge(g, result === "hit" ? "命中" : "缺失", tEnd + 22, 52, 28, result === "hit", "left");
      const tw = runsW(g, 36, [[c.tag, UI.tag, true]]);
      text(g, c.tag, w - 40, 52, 36, UI.tag, 600, "right", MONO);
      text(g, "查找标记", w - 40 - tw - 14, 52, 30, UI.ink3, 500, "right");
      // 左侧：8 组都写组号，当前组青绿高亮
      const top = 98;
      const barH = (h - top - 24) / 8;
      for (let s0 = 0; s0 < 8; s0++) {
        const y = top + s0 * barH;
        const cur = s0 === c.set;
        rr(g, 32, y + 4, 170, barH - 8, 8);
        g.fillStyle = cur ? "rgba(63,181,160,0.16)" : "rgba(255,255,255,0.025)";
        g.fill();
        if (cur) {
          g.lineWidth = 2;
          g.strokeStyle = UI.set;
          g.stroke();
        }
        text(g, `第 ${s0} 组`, 117, y + barH / 2, 30, cur ? UI.set : "rgba(133,140,156,0.75)", cur ? 600 : 500, "center");
      }
      // 当前组的 4 项：有效位 · 标记 · 页框号
      const x0 = 236;
      const cols = [x0, x0 + 150, x0 + 330, x0 + 640];
      ["路", "有效位", "标记", "页框号"].forEach((t, i) => text(g, t, cols[i]! + 14, 126, 30, C.dim, 500));
      for (let k = 0; k < 4; k++) {
        const e: TlbCueEntry = c.entries[k]!;
        const y = 152 + k * 126;
        row(g, k, x0, y, w - x0 - 32, 114);
        text(g, `第 ${k} 路`, cols[0]! + 14, y + 57, 32, UI.ink2, 500);
        text(g, `V=${e.valid ? 1 : 0}`, cols[1]! + 14, y + 57, 40, e.valid ? C.ink : UI.badInk, 600, "left", MONO);
        text(g, e.tag, cols[2]! + 14, y + 57, 42, tagColor(k, e), 600, "left", MONO);
        if (ne(k, e)) text(g, "≠", cols[3]! - 30, y + 57, 40, UI.ink3, 500, "right");
        text(g, e.valid ? e.frame : "—", cols[3]! + 14, y + 57, 42, e.valid ? "#fff" : UI.ink3, 500, "left", MONO);
      }
    });
  }

  private drawMmu(c: Cue<"mmu">, k: number) {
    const cp = this.compact;
    const f = cp ? 40 : 30;
    this.mmuPlate.draw(`${cp}|${c.pa}|${c.fillWay}|${k > 0.5}`, (g, w) => {
      panelBg(g, w, this.mmuPlate.h, 0.9);
      text(g, "MMU · 拼出物理地址", 40, 50, cp ? 44 : 34, C.ink, 600);
      if (c.fillWay >= 0) {
        const e = c.entries[c.fillWay]!;
        runs(g, 40, 124, f, [["写入 TLB ", UI.ink2], [`第 ${c.set} 组`, UI.set], [` · 第 ${c.fillWay} 路`, UI.ink2]]);
        runs(g, 40, 184, f, [["标记 ", UI.ink3], [e.tag, UI.tag, true], ["  →  页框 ", UI.ink3], [e.frame, UI.frame, true]], 500);
      } else {
        text(g, "TLB 命中，页框号直接可用", 40, 150, f, UI.ok, 600);
      }
      if (k > 0.5) {
        text(g, "物理地址", 40, 262, f, C.dim, 500);
        text(g, c.pa, 40, 342, 76, UI.frame, 600, "left", MONO);
      }
    });
  }

  private layoutSlabs(ways: number) {
    const two = ways > 4;
    const per = two ? Math.ceil(ways / 2) : ways;
    for (let i = 0; i < 8; i++) {
      const s = this.slabs[i]!;
      s.mesh.visible = i < ways;
      const col = two ? Math.floor(i / per) : 0;
      const row = two ? i % per : i;
      const x = two ? (col === 0 ? -1.75 : 1.75) : 0;
      const y = 3.6 + ((per - 1) / 2 - row) * 0.52;
      s.home.set(x, y, -34);
      s.mesh.position.copy(s.home);
      s.mesh.rotation.set(0, 0, 0);
      s.mesh.scale.setScalar(1);
    }
  }

  /**
   * Cache 的一行。cmp = 正在比较（主色描边）；flash = 刚比完不相等（标记闪红）；seen = 已比过；
   * ne = 比较结束、不相等（标记旁加「≠」）；hit = 命中（绿）；victim = 被替换（红色删除线淡出）；new = 新调入（绿）。
   */
  private drawLine(p: TextPlate, i: number, L: LineCue, state: "idle" | "cmp" | "flash" | "seen" | "ne" | "hit" | "new" | "victim", block: string, fade = 1) {
    const cp = this.compact;
    p.draw(`${cp}|${i}|${L.tag}|${L.valid}|${L.dirty}|${state}|${block}|${fade.toFixed(1)}`, (g, w, h) => {
      g.globalAlpha = fade;
      rr(g, 2, 2, w - 4, h - 4, 10);
      g.fillStyle = "rgba(20,24,33,0.96)";
      g.fill();
      const ok = state === "hit" || state === "new";
      g.fillStyle = ok ? UI.okSoft : state === "cmp" ? UI.accentSoft : state === "victim" ? "rgba(229,83,75,0.10)" : UI.row;
      g.fill();
      g.lineWidth = state === "idle" || state === "seen" || state === "ne" || state === "flash" ? 1.5 : 3;
      g.strokeStyle = ok ? UI.ok : state === "cmp" ? UI.accent : state === "victim" ? UI.bad : UI.rowLine;
      g.stroke();
      const tagC = state === "flash" ? UI.badInk : state === "victim" ? UI.ink3 : "#fff";
      const strike = (x: number, y: number, s: string, size: number) => {
        if (state !== "victim") return;
        g.font = `600 ${size}px ${MONO}`;
        const tw = g.measureText(s).width;
        g.fillStyle = UI.badInk;
        g.fillRect(x - 4, y - 2, tw + 8, 4);
      };
      if (cp) {
        text(g, `路${i}`, 22, h / 2, 40, UI.ink2, 600);
        text(g, `V${L.valid ? 1 : 0}`, 150, h / 2, 44, L.valid ? C.ink : UI.badInk, 600, "left", MONO);
        text(g, `D${L.dirty ? 1 : 0}`, 262, h / 2, 44, L.dirty ? UI.tag : C.ink, 600, "left", MONO);
        const tg = L.valid ? L.tag : "—";
        text(g, tg, 390, h / 2, 46, tagC, 600, "left", MONO);
        strike(390, h / 2, tg, 46);
        if (state === "ne") text(g, "≠", w - 28, h / 2, 44, UI.ink3, 500, "right");
        g.globalAlpha = 1;
        return;
      }
      text(g, `第 ${i} 路`, 20, h / 2, 30, UI.ink2, 500);
      text(g, `V ${L.valid ? 1 : 0}`, 150, h / 2, 32, L.valid ? C.ink : UI.badInk, 600, "left", MONO);
      text(g, `D ${L.dirty ? 1 : 0}`, 250, h / 2, 32, L.dirty ? UI.tag : C.ink, 600, "left", MONO);
      text(g, "标记", 352, h / 2, 28, UI.ink3, 500);
      const tg = L.valid ? L.tag : "—";
      text(g, tg, 422, h / 2, 38, tagC, 600, "left", MONO);
      strike(422, h / 2, tg, 38);
      if (state === "ne") text(g, "≠", 600, h / 2, 34, UI.ink3, 500, "center");
      text(g, block, w - 20, h / 2, 28, ok ? "#BFF0D4" : UI.ink3, 500, "right");
      g.globalAlpha = 1;
    });
  }

  /** L1 背板的尺寸：刚好包住表头与当前组的各行（上下各露出一截相邻的组），整块作为取景范围 */
  private fitCacheBack(ways: number) {
    const per = ways > 4 ? Math.ceil(ways / 2) : ways;
    const half = ((per - 1) / 2) * 0.52 + 0.21;
    const top = 3.6 + half + (this.compact ? 0.42 : 0.62);
    const bottom = 3.6 - half - 0.42;
    const worldW = ways > 4 ? 7.3 : 3.8;
    const PX = 240;
    this.cacheBack.resize(Math.round(worldW * PX), Math.round((top - bottom) * PX), worldW);
    this.cacheBack.mesh.position.set(0, (top + bottom) / 2, -34.35);
    return { top, bottom };
  }

  /** L1 背板：表头写当前组（青绿）与查找标记（琥珀），比较结束后表头出现命中 / 缺失徽章；上下露出相邻的组 */
  private drawCacheBack(c: Cue<"cache">, result: "none" | "hit" | "miss" = "none") {
    const cp = this.compact;
    this.fitCacheBack(c.ways);
    this.cacheBack.draw(`${cp}|${c.set}|${c.sets}|${c.ways}|${c.tag}|${result}`, (g, w, h) => {
      panelBg(g, w, h, 0.86);
      const direct = c.ways === 1;
      const unit = direct ? "行" : "组";
      const x0 = 34;
      const x1 = w - 34;
      if (!cp) {
        const end = runs(g, x0, 46, 30, [[`第 ${c.set} ${unit}`, UI.set], [` · ${direct ? "直接映射" : c.ways + " 路组相联"} · 共 ${c.sets} ${unit}`, UI.ink2]]);
        const tw = runsW(g, 30, [[c.tag, UI.tag, true]]);
        text(g, c.tag, x1, 46, 30, UI.tag, 600, "right", MONO);
        text(g, "标记", x1 - tw - 12, 46, 28, UI.ink3, 500, "right");
        if (result !== "none") badge(g, result === "hit" ? "命中" : "缺失", end + 16, 46, 26, result === "hit", "left");
      }
      // 相邻的组：只露出一截，表示表还很长
      const nb = (d: number, y: number) => {
        const s = c.set + d;
        if (s < 0 || s >= c.sets) return;
        g.fillStyle = "rgba(255,255,255,0.03)";
        rr(g, x0, y - 13, x1 - x0, 26, 8);
        g.fill();
        text(g, `第 ${s} ${unit}`, x0 + 14, y, 24, "rgba(133,140,156,0.7)", 500);
      };
      nb(-1, cp ? 34 : 104);
      nb(1, h - 40);
    });
  }

  // ------------------------------------------------------------ cues
  /**
   * 把站点的场景状态画出来。k：到站后经过的秒数（< 0 表示还在路上）；
   * reveal：岔路结果是否可以揭晓（「我来判断」时等学生选完）。返回本站动画是否已播完。
   */
  apply(st: RideStation, k: number, reveal: boolean, time: number): boolean {
    const c = st.cue;
    for (const m of this.lanes) (m.material as THREE.ShaderMaterial).uniforms.uTime!.value = time;
    for (const p of this.portals) p.material.opacity = 0.6 + 0.4 * Math.sin(time * 3);
    this.mmuPlate.mesh.visible = c.kind === "mmu";
    // 区域环境色：MMU / TLB 一带略偏紫，其余偏冷蓝；缓慢过渡
    const env = st.place === "tlb" || st.place === "mmu" ? ENV.mmu : ENV.core;
    const bg = this.scene.background as THREE.Color;
    bg.lerp(env, k < 0 ? 0.03 : 0.08);
    (this.scene.fog as THREE.FogExp2).color.copy(bg);
    switch (c.kind) {
      case "core":
        return this.cueCore(c, k);
      case "tlb":
        return this.cueTlb(c, k, reveal);
      case "mmu":
        this.drawMmu(c, Math.max(0, k));
        return k > 1.2;
      case "cache":
        return c.phase === "lookup" ? this.cueLookup(c, k, reveal) : this.cueFill(c, k);
      case "lower":
        return this.cueLower(c, k, reveal, time);
      default:
        return true;
    }
  }

  /** 岔路门洞的状态：chosen = 已揭晓的选项；show = 是否显示（只在岔路站揭晓后与驶离途中显示） */
  setGates(id: string, chosen: string | null, time: number, show = true) {
    const g = this.gates[id];
    if (!g) return;
    for (const [k, gate] of Object.entries(g)) {
      gate.show(show);
      if (show) gate.set(chosen === null ? "idle" : k === chosen ? "on" : "off", time);
    }
  }

  private cueCore(c: Cue<"core">, k: number) {
    if (c.phase === "issue") {
      const t = Math.max(0, k);
      this.drawRegs(2, c.base);
      this.drawAlu(t > 0.6 ? "R2 + 8" : "", t > 0.6 ? 1 : 0);
      return t > 2.0;
    }
    this.drawAlu("", 0);
    this.drawRegs(k >= 0 ? 1 : -1, c.value);
    return k > 0.8;
  }

  private cueTlb(c: Cue<"tlb">, k: number, reveal: boolean) {
    this.lastTlb = c;
    const t = Math.max(0, k - 0.3);
    const cmp = Math.min(4, Math.floor(t / CMP_STEP) + (k >= 0.3 ? 1 : 0));
    const done = k >= 0.3 + 4 * CMP_STEP;
    const res = !done || k < 0 ? "none" : reveal ? (c.hitWay >= 0 ? "hit" : "miss") : "pending";
    this.drawTlb(c, k < 0 ? 0 : cmp, res);
    return done && reveal;
  }

  private cueLookup(c: Cue<"cache">, k: number, reveal: boolean) {
    this.layoutSlabs(c.ways);
    this.incoming.mesh.visible = false;
    const t = Math.max(0, k - 0.3);
    const step = c.ways > 4 ? CMP_STEP * 0.6 : CMP_STEP;
    const cmp = k < 0.3 ? 0 : Math.min(c.ways, Math.floor(t / step) + 1);
    const done = k >= 0.3 + c.ways * step;
    const shown = done && reveal;
    this.drawCacheBack(c, shown ? (c.hitWay >= 0 ? "hit" : "miss") : "none");
    for (let i = 0; i < c.ways; i++) {
      const L = c.lines[i]!;
      const mism = !L.valid || L.tag !== c.tag;
      let st: "idle" | "cmp" | "flash" | "seen" | "ne" | "hit" = "idle";
      if (shown) st = c.hitWay === i ? "hit" : "ne";
      else if (!done && cmp === i + 1) st = "cmp";
      else if (cmp > i) st = reveal && mism && cmp === i + 2 && !done ? "flash" : "seen";
      this.drawLine(this.slabs[i]!.plate, i, L, st, `${c.block} B 数据块`);
      this.slabs[i]!.plate.mesh.material.opacity = 1;
    }
    return done && reveal;
  }

  private cueFill(c: Cue<"cache">, k: number) {
    this.layoutSlabs(c.ways);
    this.drawCacheBack(c);
    const v = c.victimWay;
    const t = Math.max(0, k);
    const flip = Math.min(1, Math.max(0, (t - 0.5) / 0.7));
    const fly = Math.min(1, Math.max(0, (t - 1.2) / 0.9));
    for (let i = 0; i < c.ways; i++) {
      const s = this.slabs[i]!;
      if (i === v) {
        const replaced = fly >= 1;
        const L = replaced ? c.after[i]! : c.lines[i]!;
        this.drawLine(s.plate, i, L, replaced ? "new" : k >= 0 ? "victim" : "idle", replaced ? "新调入的块" : `${c.block} B 数据块`);
        // 被替换的行：红色删除线后翻转淡出，新块绿色描边飞入
        s.mesh.rotation.x = replaced ? 0 : flip * Math.PI * 0.5;
        s.mesh.visible = replaced || flip < 1;
        s.plate.mesh.material.opacity = replaced ? 1 : 1 - 0.85 * flip;
      } else {
        this.drawLine(s.plate, i, c.lines[i]!, "idle", `${c.block} B 数据块`);
        s.mesh.rotation.x = 0;
        s.mesh.visible = true;
        s.plate.mesh.material.opacity = 1;
      }
    }
    const inc = this.incoming;
    inc.mesh.visible = k >= 0 && fly > 0 && fly < 1;
    if (inc.mesh.visible) {
      const home = this.slabs[v]!.home;
      inc.mesh.position.set(home.x + (1 - fly) * 6, home.y - (1 - fly) * 1.5, home.z - (1 - fly) * 8);
      this.drawLine(inc.plate, v, c.after[v]!, "new", "新调入的块");
    }
    return t > 2.3;
  }

  private cueLower(c: Cue<"lower">, k: number, reveal: boolean, time: number) {
    const L = this.lower[c.level];
    const t = Math.max(0, k);
    const done = t > 1.0;
    const fill = L.box.userData.fill as THREE.MeshBasicMaterial;
    const edge = L.box.userData.edge as THREE.LineBasicMaterial;
    const z0 = L.box.position.z;
    L.block.position.set(0, 2.95, z0 + 0.9);
    if (k < 0 || !done || !reveal) {
      // 查找中：外框是中性色，轻微呼吸（减少动态效果时由场景整体静止）
      fill.opacity = k < 0 ? 0.05 : 0.06 + 0.04 * (0.5 + 0.5 * Math.sin(time * 4));
      edge.color.set(LOWER);
      L.block.material.opacity = 0;
      return false;
    }
    // 结果：命中绿、缺失红；命中时整块数据向外送出
    fill.opacity = 0.08;
    edge.color.set(c.hit ? UI.ok : UI.bad);
    L.block.material.opacity = c.hit ? 0.85 * Math.min(1, (t - 1) / 0.4) : 0;
    L.block.position.z = z0 + 0.9 + Math.min(1, (t - 1) / 0.6) * 0.8;
    return true;
  }

  /** 小屏简化：文字板换成大字少列的版本 */
  get isCompact() {
    return this.compact;
  }

  setCompact(c: boolean) {
    if (c === this.compact) return;
    this.compact = c;
    if (!c) this.regs.forEach((r) => (r.box.visible = r.plate.mesh.visible = true));
  }

  /** 本站的焦点对象（没有焦点的站返回 null） */
  focus(st: RideStation): FocusSpec | null {
    const c = st.cue;
    const mf = this.compact ? MIN_FONT.compact : MIN_FONT.full;
    const fwd = V3(0, -0.06, -1).normalize();
    this.scene.updateMatrixWorld(true);
    const boxOf = (...o: THREE.Object3D[]) => {
      const b = new THREE.Box3();
      for (const x of o) b.expandByObject(x);
      return b;
    };
    switch (c.kind) {
      case "core": {
        const r = this.regs[c.phase === "issue" ? 2 : 1]!;
        if (c.phase === "issue") {
          if (this.compact) this.drawRegs(2, c.base);
          return { objects: [r.box, r.plate.mesh, this.alu, this.aluPlate.mesh], box: boxOf(r.box, this.alu), font: { size: worldFont(r.plate, 36), at: r.plate.mesh.position.clone() }, dir: fwd, plates: [r.plate, this.aluPlate] };
        }
        return { objects: [r.box, r.plate.mesh], box: boxOf(r.box), font: { size: worldFont(r.plate, 36), at: r.plate.mesh.position.clone() }, dir: fwd, plates: [r.plate], maxArea: 0.32 };
      }
      case "tlb": {
        if (this.lastTlb !== c) this.drawTlb(c, 0, "none");
        else if (this.compact) this.tlbPlate.resize(1000, 640);
        else this.tlbPlate.resize(1200, 680);
        this.scene.updateMatrixWorld(true);
        const m = this.tlbPlate.mesh;
        const dir = V3(-Math.sin(TLB_YAW), -0.06, -Math.cos(TLB_YAW)).normalize();
        return { objects: [m], box: boxOf(m), pts: planeCorners(m), font: { size: worldFont(this.tlbPlate, mf), at: m.position.clone() }, dir, plates: [this.tlbPlate] };
      }
      case "mmu": {
        const m = this.mmuPlate.mesh;
        const dir = m.position.clone().sub(CHIP.mmu.pos).setY(0).normalize().add(V3(0, -0.06, 0)).normalize();
        return { objects: [m], box: boxOf(m), pts: planeCorners(m), font: { size: worldFont(this.mmuPlate, this.compact ? 40 : 30), at: m.position.clone() }, dir, plates: [this.mmuPlate] };
      }
      case "cache": {
        this.layoutSlabs(c.ways);
        this.drawCacheBack(c);
        this.scene.updateMatrixWorld(true);
        // 取景范围 = 整块背板（表头、当前组各行、上下露出的相邻组），不会被裁掉一半
        const pts = planeCorners(this.cacheBack.mesh);
        const b = new THREE.Box3().setFromPoints(pts);
        const objs: THREE.Object3D[] = [this.cacheBack.mesh];
        for (let i = 0; i < c.ways; i++) {
          const sl = this.slabs[i]!;
          b.expandByPoint(sl.home.clone().add(V3(-1.65, -0.21, 0.08)));
          b.expandByPoint(sl.home.clone().add(V3(1.65, 0.21, 0.08)));
          objs.push(sl.mesh);
        }
        if (c.phase === "fill") objs.push(this.incoming.mesh);
        const p0 = this.slabs[0]!.plate;
        return { objects: objs, box: b, pts: [...pts, ...this.slabs.slice(0, c.ways).flatMap((sl) => [sl.home.clone().add(V3(-1.65, -0.21, 0.08)), sl.home.clone().add(V3(1.65, 0.21, 0.08))])], font: { size: worldFont(p0, this.compact ? 40 : 26), at: this.slabs[0]!.home.clone() }, dir: fwd, plates: this.slabs.slice(0, c.ways).map((x) => x.plate).concat(c.phase === "fill" ? [this.incoming.plate] : []) };
      }
      case "lower": {
        const L = this.lower[c.level];
        return { objects: [L.box, L.plate.mesh, L.block], box: boxOf(L.box), font: { size: worldFont(L.plate, 54), at: L.plate.mesh.position.clone() }, dir: V3(0, -0.1, -1).normalize(), plates: [L.plate] };
      }
      default:
        return null;
    }
  }

  dispose() {
    for (const p of this.plates) p.dispose();
    for (const g of Object.values(this.gates)) for (const x of Object.values(g)) x.dispose();
    disposeTree(this.scene);
  }
}
