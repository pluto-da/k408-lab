// CPU 内部世界：寄存器组与 ALU、MMU 与 TLB、L1 / L2 / L3 三层「仓库」、通往内存控制器的出口。
import * as THREE from "three";
import type { LineCue, RideStation, SceneCue, TlbCueEntry } from "../types";
import { CHIP } from "./layout";
import { C, Gate, MONO, TextPlate, disposeTree, dust, glowBox, gridFloor, lane, panelBg, rr, text } from "./kit";

type Cue<K extends SceneCue["kind"]> = Extract<SceneCue, { kind: K }>;

const CMP_STEP = 0.32;

export class ChipWorld {
  readonly scene = new THREE.Scene();
  private lanes: THREE.Mesh[] = [];
  private regs: { box: THREE.Group; plate: TextPlate }[] = [];
  private alu: THREE.Group;
  private aluPlate: TextPlate;
  private vaPlate: TextPlate;
  private tlbPlate: TextPlate;
  private mmuPlate: TextPlate;
  private cacheBack: TextPlate;
  private slabs: { mesh: THREE.Mesh<THREE.BoxGeometry, THREE.MeshBasicMaterial>; plate: TextPlate; home: THREE.Vector3 }[] = [];
  private incoming: { mesh: THREE.Mesh<THREE.BoxGeometry, THREE.MeshBasicMaterial>; plate: TextPlate };
  private lower: Record<2 | 3, { box: THREE.Group; plate: TextPlate; block: THREE.Mesh<THREE.BoxGeometry, THREE.MeshBasicMaterial> }>;
  readonly gates: Record<string, Record<string, Gate>> = {};
  private portals: THREE.Mesh<THREE.TorusGeometry, THREE.MeshBasicMaterial>[] = [];
  private plates: TextPlate[] = [];
  private q: number;

  constructor(opts: { phone: boolean; low: boolean }) {
    this.q = opts.low || opts.phone ? 0.75 : 1;
    const s = this.scene;
    s.background = new THREE.Color(C.bg);
    s.fog = new THREE.FogExp2(C.bg, 0.028);
    s.add(gridFloor(220, "#5b6b8f"));
    s.add(dust(opts.phone || opts.low ? 160 : 420, new THREE.Box3(new THREE.Vector3(-12, 0.3, -72), new THREE.Vector3(12, 8, 14))));

    // 走线：主通道（青）、回程通道（绿）、去内存控制器的支路（紫）
    const L = CHIP.laneX;
    const mk = (pts: THREE.Vector3[], c: string, w?: number) => {
      const m = lane(pts.map((p) => new THREE.Vector3(p.x, 0, p.z)), c, w);
      this.lanes.push(m);
      s.add(m);
    };
    mk([new THREE.Vector3(0, 0, 12), new THREE.Vector3(0, 0, -68)], C.dmi, 0.7);
    mk([new THREE.Vector3(2.4, 0, -62.5), new THREE.Vector3(L, 0, -58), new THREE.Vector3(L, 0, 4), new THREE.Vector3(2, 0, 9)], C.nic, 0.5);
    mk([new THREE.Vector3(0, 0, -15), new THREE.Vector3(-2.3, 0, -18.2), new THREE.Vector3(-5, 0, -21.4), CHIP.portal], C.membus, 0.5);

    // 两侧的「硅片墙」：竖向细线
    for (const side of [-1, 1]) {
      const g = new THREE.Group();
      const mat = new THREE.LineBasicMaterial({ color: "#2a3550", transparent: true, opacity: 0.7 });
      const pts: number[] = [];
      for (let z = 12; z > -72; z -= 1.6) pts.push(side * 11, 0, z, side * 11, 7 + Math.sin(z) * 1.5, z);
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
      g.add(new THREE.LineSegments(geo, mat));
      s.add(g);
    }

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
    this.sign("通用寄存器组", new THREE.Vector3(0, 3.75, 0), C.cu, 3.2);
    this.alu = glowBox(2.4, 1.1, 1.2, C.alu, 0.12);
    this.alu.position.set(0, 0.6, -0.6);
    s.add(this.alu);
    this.aluPlate = this.plate(420, 120, 2.0);
    this.aluPlate.mesh.position.set(0, 0.62, 0.02);
    this.vaPlate = this.plate(760, 150, 3.4);
    this.vaPlate.mesh.position.set(0, 1.85, 0.6);
    const cu = glowBox(1.6, 1.4, 1.0, C.cu, 0.1);
    cu.position.set(-5, 0.7, -0.4);
    s.add(cu);
    this.sign("CU 控制器", new THREE.Vector3(-5, 1.75, -0.4), C.cu, 1.8);
    this.sign("ALU 运算器", new THREE.Vector3(2.6, 0.9, 0), C.alu, 1.8);
    // 控制信号线：CU → 寄存器 / ALU
    const ctl = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-4.2, 1.2, -0.4), new THREE.Vector3(-3.5, 2.7, 0),
      new THREE.Vector3(-4.2, 0.8, -0.4), new THREE.Vector3(-1.2, 0.8, -0.6),
    ]);
    s.add(new THREE.LineSegments(ctl, new THREE.LineBasicMaterial({ color: C.cu, transparent: true, opacity: 0.6 })));

    // ---- MMU / TLB（z = -14）
    this.tlbPlate = this.plate(1100, 620, 6.0);
    this.tlbPlate.mesh.position.set(0, 3.3, -14);
    this.sign("MMU · 快表 TLB", new THREE.Vector3(0, 5.25, -14), C.membus, 3.2);
    this.addGates("tlb", CHIP.tlbGates, { miss: ["缺失 → 去主存查页表", C.bad], hit: ["命中 → 直接得到页框号", C.ok] });
    this.mmuPlate = this.plate(900, 420, 4.2);
    this.mmuPlate.mesh.position.copy(CHIP.mmuPlate);
    this.mmuPlate.mesh.lookAt(CHIP.mmu.pos.x, CHIP.mmuPlate.y, CHIP.mmu.pos.z);

    // ---- L1（z = -34）
    this.cacheBack = this.plate(1200, 780, 7.4);
    this.cacheBack.mesh.position.set(0, 3.6, -34.35);
    for (let i = 0; i < 8; i++) {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(3.3, 0.42, 0.16), new THREE.MeshBasicMaterial({ color: C.l1, transparent: true, opacity: 0.16, toneMapped: false, depthWrite: false }));
      const plate = this.plate(800, 100, 3.25);
      plate.mesh.position.z = 0.085;
      mesh.add(plate.mesh);
      s.add(mesh);
      this.slabs.push({ mesh, plate, home: new THREE.Vector3() });
    }
    {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(3.3, 0.42, 0.16), new THREE.MeshBasicMaterial({ color: C.l2, transparent: true, opacity: 0.3, toneMapped: false, depthWrite: false }));
      const plate = this.plate(800, 100, 3.25);
      plate.mesh.position.z = 0.085;
      mesh.add(plate.mesh);
      mesh.visible = false;
      s.add(mesh);
      this.incoming = { mesh, plate };
    }
    this.sign("L1 数据 Cache", new THREE.Vector3(0, 6.1, -34.3), C.l1, 3.2);
    this.addGates("l1", CHIP.l1Gates, { miss: ["缺失 → 去 L2 找", C.bad], hit: ["命中 → 直接取数", C.ok] });

    // ---- L2 / L3
    const mkLower = (level: 2 | 3, z: number, color: string, label: string) => {
      const box = glowBox(level === 2 ? 5.2 : 7.2, 2.2, 1.6, color, 0.08);
      box.position.set(0, 3.8, z);
      s.add(box);
      const plate = this.plate(900, 220, level === 2 ? 4.8 : 6.4);
      plate.mesh.position.set(0, 3.8, z + 0.82);
      const block = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.42, 0.42), new THREE.MeshBasicMaterial({ color: C.ok, transparent: true, opacity: 0, toneMapped: false }));
      block.position.set(0, 2.5, z + 0.9);
      s.add(block);
      plate.draw(label, (g, w, h) => {
        panelBg(g, w, h, color, 0.6);
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
      const sg = this.sign(label, p.clone().add(new THREE.Vector3(0, 1.75, 0)), C.membus, 3.0);
      if (p === CHIP.portal) sg.rotation.y = Math.PI / 2 - 0.3;
    }
    this.sign("回程通道 → 寄存器", new THREE.Vector3(L, 3.3, -12), C.nic, 3).rotation.y = Math.PI;

    this.layoutSlabs(4);
    this.drawRegs(-1, "");
    this.drawAlu("", 0);
    this.vaPlate.mesh.visible = false;
  }

  private plate(w: number, h: number, worldW: number) {
    const p = new TextPlate(w, h, worldW, this.q);
    this.plates.push(p);
    this.scene.add(p.mesh);
    return p;
  }

  private sign(label: string, pos: THREE.Vector3, color: string, worldW: number) {
    const p = this.plate(640, 92, worldW);
    p.mesh.position.copy(pos);
    p.draw(label, (g, w, h) => {
      rr(g, 2, 2, w - 4, h - 4, 14);
      g.fillStyle = "rgba(10,12,16,0.72)";
      g.fill();
      g.fillStyle = color;
      g.fillRect(14, h / 2 - 12, 8, 24);
      text(g, label, 40, h / 2 + 1, 40, C.ink, 600);
    });
    return p.mesh;
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
      r.plate.draw(`${name}|${on}|${v}`, (g, w) => {
        text(g, name, w / 2, 40, 40, on ? "#fff" : C.dim, 600, "center");
        if (v) text(g, v.replace(/^0x/, ""), w / 2, 98, 30, C.power, 500, "center", MONO);
      });
      (r.box.userData.fill as THREE.MeshBasicMaterial).opacity = on ? 0.45 : 0.1;
    });
  }

  private drawAlu(expr: string, k: number) {
    this.aluPlate.draw(`${expr}|${k > 0}`, (g, w, h) => {
      text(g, expr || "ALU", w / 2, h / 2, expr ? 46 : 52, k > 0 ? "#fff" : C.dim, 600, "center", expr ? MONO : undefined);
    });
    (this.alu.userData.fill as THREE.MeshBasicMaterial).opacity = 0.12 + 0.35 * k;
  }

  private drawVa(value: string, segs: { a: string; b: string } | null) {
    this.vaPlate.draw(`${value}|${segs?.a}`, (g, w, h) => {
      rr(g, 4, 4, w - 8, h - 8, 20);
      g.fillStyle = "rgba(12,14,20,0.9)";
      g.fill();
      g.lineWidth = 3;
      g.strokeStyle = C.membus;
      g.stroke();
      if (!segs) {
        text(g, value, w / 2, h / 2, 64, "#fff", 600, "center", MONO);
        return;
      }
      g.fillStyle = "rgba(176,124,255,0.22)";
      g.fillRect(10, 10, w * 0.6 - 10, h - 20);
      g.fillStyle = "rgba(70,210,255,0.2)";
      g.fillRect(w * 0.6 + 4, 10, w * 0.4 - 14, h - 20);
      text(g, "虚页号", 30, 34, 26, C.membus, 600);
      text(g, segs.a, w * 0.3, h / 2 + 14, 54, "#fff", 600, "center", MONO);
      text(g, "页内偏移", w * 0.6 + 24, 34, 26, "#46D2FF", 600);
      text(g, segs.b, w * 0.8, h / 2 + 14, 54, "#fff", 600, "center", MONO);
    });
  }

  private drawTlb(c: Cue<"tlb">, cmp: number, result: "pending" | "hit" | "miss" | "none") {
    const key = `${c.set}|${c.tag}|${cmp}|${result}|${c.entries.map((e) => e.tag).join()}`;
    this.tlbPlate.draw(key, (g, w, h) => {
      panelBg(g, w, h, C.membus);
      text(g, "TLB · 4 路组相联 · 8 组", 40, 44, 34, C.ink, 600);
      text(g, `查找标记 ${c.tag}`, w - 40, 44, 30, C.power, 600, "right", MONO);
      const top = 92;
      const rowH = (h - top - 26) / 8;
      const colX = 150;
      const colW = (w - colX - 30) / 4;
      for (let s = 0; s < 8; s++) {
        const y = top + s * rowH;
        const cur = s === c.set;
        text(g, `组 ${s}`, 40, y + rowH / 2, 26, cur ? "#fff" : "rgba(233,234,238,0.4)", cur ? 600 : 500);
        for (let k = 0; k < 4; k++) {
          const x = colX + k * colW;
          rr(g, x + 4, y + 4, colW - 8, rowH - 8, 8);
          if (!cur) {
            g.fillStyle = "rgba(255,255,255,0.04)";
            g.fill();
            continue;
          }
          const e: TlbCueEntry = c.entries[k]!;
          const lit = cmp > k;
          const isHit = result === "hit" && c.hitWay === k;
          g.fillStyle = isHit ? "rgba(76,227,138,0.32)" : result === "miss" && lit ? "rgba(255,90,90,0.16)" : lit ? "rgba(176,124,255,0.22)" : "rgba(255,255,255,0.08)";
          g.fill();
          g.lineWidth = isHit || cmp === k + 1 ? 3 : 1.5;
          g.strokeStyle = isHit ? C.ok : cmp === k + 1 ? C.membus : "rgba(255,255,255,0.18)";
          g.stroke();
          text(g, `V${e.valid ? 1 : 0}`, x + 18, y + rowH / 2, 22, e.valid ? C.ink : C.bad, 600, "left", MONO);
          text(g, e.tag, x + colW / 2 + 8, y + rowH / 2, 23, "#fff", 500, "center", MONO);
        }
      }
    });
  }

  private drawMmu(c: Cue<"mmu">, k: number) {
    this.mmuPlate.draw(`${c.pa}|${c.fillWay}|${k > 0.5}`, (g, w, h) => {
      panelBg(g, w, h, C.alu);
      text(g, "MMU · 拼出物理地址", 40, 46, 32, C.ink, 600);
      if (c.fillWay >= 0) {
        const e = c.entries[c.fillWay]!;
        text(g, `写入 TLB 第 ${c.set} 组 · 第 ${c.fillWay} 路`, 40, 112, 28, C.membus, 600);
        text(g, `标记 ${e.tag} → 页框 ${e.frame}`, 40, 156, 28, C.ink, 500, "left", MONO);
      } else {
        text(g, "TLB 命中，页框号直接可用", 40, 130, 28, C.ok, 600);
      }
      if (k > 0.5) {
        text(g, "物理地址", 40, 250, 28, C.dim, 500);
        text(g, c.pa, 40, 320, 76, "#fff", 600, "left", MONO);
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

  private drawLine(p: TextPlate, i: number, L: LineCue, state: "idle" | "cmp" | "hit" | "miss" | "new" | "victim", block: string) {
    p.draw(`${i}|${L.tag}|${L.valid}|${L.dirty}|${state}`, (g, w, h) => {
      rr(g, 2, 2, w - 4, h - 4, 10);
      g.fillStyle = "rgba(14,17,23,0.96)";
      g.fill();
      g.fillStyle = state === "hit" || state === "new" ? "rgba(76,227,138,0.28)" : state === "miss" || state === "victim" ? "rgba(255,90,90,0.2)" : state === "cmp" ? "rgba(130,210,120,0.22)" : "rgba(14,17,23,0.78)";
      g.fill();
      g.lineWidth = state === "idle" ? 1.5 : 3;
      g.strokeStyle = state === "hit" || state === "new" ? C.ok : state === "miss" || state === "victim" ? C.bad : state === "cmp" ? C.l1 : "rgba(255,255,255,0.18)";
      g.stroke();
      text(g, `第 ${i} 路`, 20, h / 2, 30, "rgba(233,234,238,0.75)", 500);
      text(g, `V ${L.valid ? 1 : 0}`, 150, h / 2, 32, L.valid ? C.ink : C.bad, 600, "left", MONO);
      text(g, `D ${L.dirty ? 1 : 0}`, 250, h / 2, 32, L.dirty ? C.power : C.ink, 600, "left", MONO);
      text(g, "标记", 352, h / 2, 28, "rgba(233,234,238,0.75)", 500);
      text(g, L.valid ? L.tag : "—", 422, h / 2, 38, "#fff", 600, "left", MONO);
      text(g, block, w - 20, h / 2, 24, "rgba(233,234,238,0.6)", 500, "right");
    });
  }

  private drawCacheBack(c: Cue<"cache">) {
    this.cacheBack.draw(`${c.set}|${c.sets}|${c.ways}|${c.tag}`, (g, w, h) => {
      panelBg(g, w, h, C.l1, 0.88);
      const direct = c.ways === 1;
      text(g, `${direct ? "直接映射" : c.ways + " 路组相联"} · 共 ${c.sets} ${direct ? "行" : "组"}`, 40, 46, 32, C.ink, 600);
      text(g, `标记 ${c.tag}`, w - 40, 46, 30, C.power, 600, "right", MONO);
      const nb = (d: number, y: number) => {
        const s = c.set + d;
        if (s < 0 || s >= c.sets) return;
        text(g, `${direct ? "第" : "第"} ${s} ${direct ? "行" : "组"}`, 40, y, 26, "rgba(233,234,238,0.35)", 500);
        g.fillStyle = "rgba(255,255,255,0.05)";
        rr(g, 200, y - 16, w - 240, 32, 8);
        g.fill();
      };
      nb(-2, 104);
      nb(-1, 150);
      nb(1, h - 120);
      nb(2, h - 74);
      g.fillStyle = C.l1;
      text(g, `第 ${c.set} ${direct ? "行" : "组"}`, 40, h / 2, 34, C.l1, 600);
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

  /** 岔路门洞的状态：chosen = 已揭晓的选项 */
  setGates(id: string, chosen: string | null, time: number) {
    const g = this.gates[id];
    if (!g) return;
    for (const [k, gate] of Object.entries(g)) gate.set(chosen === null ? "idle" : k === chosen ? "on" : "off", time);
  }

  private cueCore(c: Cue<"core">, k: number) {
    this.vaPlate.mesh.visible = c.phase === "issue";
    if (c.phase === "issue") {
      const t = Math.max(0, k);
      this.drawRegs(2, c.base);
      this.drawAlu(t > 0.6 ? "R2 + 8" : "", t > 0.6 ? 1 : 0);
      const split = t > 2.0;
      this.drawVa(c.value, split ? { a: c.split[0], b: c.split[1] } : null);
      this.vaPlate.mesh.position.y = 0.9 + Math.min(1, Math.max(0, (t - 0.9) / 0.8)) * 1.05;
      this.vaPlate.mesh.material.opacity = Math.min(1, Math.max(0, (t - 0.8) / 0.4));
      return t > 2.4;
    }
    this.drawAlu("", 0);
    this.drawRegs(k >= 0 ? 1 : -1, c.value);
    return k > 0.8;
  }

  private cueTlb(c: Cue<"tlb">, k: number, reveal: boolean) {
    const t = Math.max(0, k - 0.3);
    const cmp = Math.min(4, Math.floor(t / CMP_STEP) + (k >= 0.3 ? 1 : 0));
    const done = k >= 0.3 + 4 * CMP_STEP;
    const res = !done || k < 0 ? "none" : reveal ? (c.hitWay >= 0 ? "hit" : "miss") : "pending";
    this.drawTlb(c, k < 0 ? 0 : cmp, res);
    return done && reveal;
  }

  private cueLookup(c: Cue<"cache">, k: number, reveal: boolean) {
    this.layoutSlabs(c.ways);
    this.drawCacheBack(c);
    this.incoming.mesh.visible = false;
    const t = Math.max(0, k - 0.3);
    const step = c.ways > 4 ? CMP_STEP * 0.6 : CMP_STEP;
    const cmp = k < 0.3 ? 0 : Math.min(c.ways, Math.floor(t / step) + 1);
    const done = k >= 0.3 + c.ways * step;
    for (let i = 0; i < c.ways; i++) {
      const L = c.lines[i]!;
      let st: "idle" | "cmp" | "hit" | "miss" = "idle";
      if (done && reveal) st = c.hitWay === i ? "hit" : c.hitWay < 0 ? "miss" : "idle";
      else if (cmp > i) st = "cmp";
      this.drawLine(this.slabs[i]!.plate, i, L, st, `${c.block} B 数据块`);
      this.slabs[i]!.mesh.material.opacity = st === "idle" ? 0.16 : 0.3;
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
        s.mesh.rotation.x = replaced ? 0 : flip * Math.PI * 0.5;
        s.mesh.visible = replaced || flip < 1;
        s.mesh.material.opacity = replaced ? 0.32 : 0.2 * (1 - flip) + 0.05;
      } else {
        this.drawLine(s.plate, i, c.lines[i]!, "idle", `${c.block} B 数据块`);
        s.mesh.rotation.x = 0;
        s.mesh.visible = true;
        s.mesh.material.opacity = 0.16;
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
    const color = new THREE.Color(c.level === 2 ? C.l2 : C.l3);
    if (k < 0) {
      fill.opacity = 0.08;
      edge.color.copy(color);
      L.block.material.opacity = 0;
      return false;
    }
    if (!done || !reveal) {
      fill.opacity = 0.1 + 0.08 * (0.5 + 0.5 * Math.sin(time * 8));
      edge.color.copy(color);
      L.block.material.opacity = 0;
      return false;
    }
    fill.opacity = c.hit ? 0.2 : 0.12;
    edge.color.set(c.hit ? C.ok : C.bad);
    L.block.material.opacity = c.hit ? Math.min(1, (t - 1) / 0.4) : 0;
    L.block.position.y = 2.5 - Math.min(1, (t - 1) / 0.6) * 0.4;
    return true;
  }

  dispose() {
    for (const p of this.plates) p.dispose();
    for (const g of Object.values(this.gates)) for (const x of Object.values(g)) x.dispose();
    disposeTree(this.scene);
  }
}
