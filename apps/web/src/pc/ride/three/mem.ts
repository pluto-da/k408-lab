// 内存内部世界：页表是「楼层」（页目录 → 二级页表），数据乘电梯逐层下降；另一侧是 DRAM 行列阵列。
import * as THREE from "three";
import type { RideStation, SceneCue } from "../types";
import { MEM } from "./layout";
import { C, Gate, MONO, TextPlate, disposeTree, dust, glowBox, gridFloor, panelBg, rr, text } from "./kit";

type Cue<K extends SceneCue["kind"]> = Extract<SceneCue, { kind: K }>;

const GRID = 16;

export class MemWorld {
  readonly scene = new THREE.Scene();
  private floors: { group: THREE.Group; plate: TextPlate; label: TextPlate }[] = [];
  readonly gates: Gate[][] = [];
  private alarm: TextPlate;
  private alarmLight: THREE.Mesh<THREE.SphereGeometry, THREE.MeshBasicMaterial>;
  private disk: THREE.Group;
  private beam: THREE.Mesh<THREE.CylinderGeometry, THREE.MeshBasicMaterial>;
  private cells: THREE.InstancedMesh;
  private cellColor = new THREE.Color();
  private dramPlate: TextPlate;
  private rowBuf: THREE.Mesh<THREE.BoxGeometry, THREE.MeshBasicMaterial>;
  private shaft: THREE.LineSegments;
  private plates: TextPlate[] = [];
  private q: number;
  private n = GRID;
  private lastCells = "";

  constructor(opts: { phone: boolean; low: boolean }) {
    this.q = opts.low || opts.phone ? 0.75 : 1;
    this.n = opts.phone || opts.low ? 12 : GRID;
    const s = this.scene;
    s.background = new THREE.Color(C.bg);
    s.fog = new THREE.FogExp2(C.bg, 0.03);
    s.add(dust(opts.phone || opts.low ? 140 : 360, new THREE.Box3(new THREE.Vector3(-14, -6, -6), new THREE.Vector3(50, 20, 20)), C.membus));

    // 楼层
    for (let k = 0; k < 2; k++) {
      const y = MEM.floorY(k);
      const group = new THREE.Group();
      const slab = glowBox(10, 0.16, 3.2, C.membus, 0.1);
      slab.position.set(0, y - 0.08, 0.6);
      group.add(slab);
      const grid = gridFloor(14, "#7a63b8", y + 0.001);
      grid.scale.set(1, 1, 0.24);
      grid.position.z = 0.6;
      group.add(grid);
      s.add(group);
      const plate = this.plate(1100, 560, 6.2);
      plate.mesh.position.set(0, y + 2.0, 0);
      const label = this.plate(700, 90, 3.6);
      label.mesh.position.set(0, y + 4.05, 0);
      this.floors.push({ group, plate, label });
      const ok = new Gate("V = 1 → 带着页框号回 CPU", C.ok, this.q);
      ok.group.position.copy(MEM.gate(k, true));
      ok.group.rotation.y = -0.45;
      ok.group.scale.setScalar(0.72);
      const bad = new Gate("V = 0 → 缺页处理", C.bad, this.q);
      bad.group.position.copy(MEM.gate(k, false));
      bad.group.rotation.y = 0.45;
      bad.group.scale.setScalar(0.72);
      s.add(ok.group, bad.group);
      this.gates.push([ok, bad]);
    }
    // 电梯井
    const sp: number[] = [];
    for (const x of [-0.6, 0.6]) for (const z of [2.8, 4.0]) sp.push(x, MEM.floorY(1) - 1, z, x, MEM.floorY(0) + 6, z);
    const sg = new THREE.BufferGeometry();
    sg.setAttribute("position", new THREE.Float32BufferAttribute(sp, 3));
    this.shaft = new THREE.LineSegments(sg, new THREE.LineBasicMaterial({ color: C.membus, transparent: true, opacity: 0.5 }));
    s.add(this.shaft);
    const pdbr = this.plate(640, 92, 3.0);
    pdbr.mesh.position.set(-4.6, MEM.floorY(0) + 4.1, 0);
    pdbr.draw("pdbr", (g, w, h) => {
      rr(g, 2, 2, w - 4, h - 4, 14);
      g.fillStyle = "rgba(10,12,16,0.75)";
      g.fill();
      text(g, "页表基址寄存器 → 0x0010 0000", w / 2, h / 2, 34, C.pcie, 600, "center");
    });

    // 缺页：警示牌、外存、调页光束
    this.alarm = this.plate(820, 200, 4.2);
    this.alarm.mesh.position.set(-1.6, MEM.floorY(1) - 0.9, 1.2);
    this.alarm.draw("alarm", (g, w, h) => {
      rr(g, 4, 4, w - 8, h - 8, 20);
      g.fillStyle = "rgba(40,10,12,0.9)";
      g.fill();
      g.lineWidth = 4;
      g.strokeStyle = C.bad;
      g.stroke();
      text(g, "缺页：V = 0", w / 2, 70, 52, "#fff", 700, "center");
      text(g, "转入操作系统 · 从外存调入这一页", w / 2, 144, 32, "rgba(255,220,220,0.9)", 500, "center");
    });
    this.alarmLight = new THREE.Mesh(new THREE.SphereGeometry(0.25, 16, 12), new THREE.MeshBasicMaterial({ color: C.bad, transparent: true, toneMapped: false }));
    this.alarmLight.position.set(-3.6, MEM.floorY(1) + 3.0, 1.6);
    s.add(this.alarmLight);
    this.disk = new THREE.Group();
    const platter = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.6, 0.12, 48), new THREE.MeshBasicMaterial({ color: "#c8cdd6", transparent: true, opacity: 0.35, toneMapped: false }));
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.6, 0.03, 6, 64), new THREE.MeshBasicMaterial({ color: C.sata, toneMapped: false }));
    ring.rotation.x = Math.PI / 2;
    this.disk.add(platter, ring);
    this.disk.position.set(-1.6, MEM.floorY(1) - 4.6, 0.6);
    s.add(this.disk);
    const dl = this.plate(500, 90, 2.4);
    dl.mesh.position.set(-1.6, MEM.floorY(1) - 3.7, 2.4);
    dl.draw("disk", (g, w, h) => text(g, "外存（交换区）", w / 2, h / 2, 40, C.sata, 600, "center"));
    this.beam = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 4.4, 12, 1, true), new THREE.MeshBasicMaterial({ color: C.sata, transparent: true, opacity: 0, depthWrite: false, toneMapped: false }));
    this.beam.position.set(-1.6, MEM.floorY(1) - 2.4, 0.6);
    s.add(this.beam);

    // DRAM 阵列
    const X = MEM.dramX;
    const n = this.n;
    const cellGeo = new THREE.BoxGeometry(0.34, 0.34, 0.12);
    this.cells = new THREE.InstancedMesh(cellGeo, new THREE.MeshBasicMaterial({ toneMapped: false }), n * n);
    const m = new THREE.Matrix4();
    for (let r = 0; r < n; r++)
      for (let c = 0; c < n; c++) {
        m.makeTranslation(X - (n - 1) * 0.22 + c * 0.44, 3.1 + (n - 1) * 0.22 - r * 0.44, 0);
        this.cells.setMatrixAt(r * n + c, m);
        this.cells.setColorAt(r * n + c, this.cellColor.set("#26304a"));
      }
    s.add(this.cells);
    const frame = glowBox(n * 0.44 + 0.6, n * 0.44 + 0.6, 0.2, "#7aa7ff", 0.04);
    frame.position.set(X, 3.1, -0.1);
    s.add(frame);
    this.rowBuf = new THREE.Mesh(new THREE.BoxGeometry(n * 0.44, 0.22, 0.14), new THREE.MeshBasicMaterial({ color: C.power, transparent: true, opacity: 0.25, toneMapped: false }));
    this.rowBuf.position.set(X, 3.1 - n * 0.22 - 0.55, 0);
    s.add(this.rowBuf);
    this.dramPlate = this.plate(1100, 150, 6.2);
    this.dramPlate.mesh.position.set(X, 3.1 + n * 0.22 + 0.95, 0);
    const side = this.plate(400, 90, 1.8);
    side.mesh.position.set(X - n * 0.22 - 1.4, 3.1, 0);
    side.draw("row", (g, w, h) => text(g, "行译码 RAS", w / 2, h / 2, 40, C.power, 600, "center"));
    const bot = this.plate(560, 90, 2.4);
    bot.mesh.position.set(X, 3.1 - n * 0.22 - 1.15, 0);
    bot.draw("col", (g, w, h) => text(g, "行缓冲 → 列选择 CAS", w / 2, h / 2, 40, C.pcie, 600, "center"));
    s.add(gridFloor(80, "#5b6b8f", -0.6).translateX(X));
  }

  private plate(w: number, h: number, worldW: number) {
    const p = new TextPlate(w, h, worldW, this.q);
    this.plates.push(p);
    this.scene.add(p.mesh);
    return p;
  }

  setFloors(count: number) {
    this.floors.forEach((f, k) => {
      const on = k < count;
      f.group.visible = f.plate.mesh.visible = f.label.mesh.visible = on;
      for (const g of this.gates[k]!) g.group.visible = on && k === count - 1;
    });
    // 缺页的警示与外存跟着最后一层
    const y = MEM.floorY(count - 1);
    this.alarm.mesh.position.y = y - 0.9;
    this.alarmLight.position.y = y + 3.0;
    this.disk.position.y = y - 4.6;
    this.beam.position.y = y - 2.4;
  }

  setGates(floor: number, chosen: string | null, time: number) {
    const g = this.gates[floor];
    if (!g) return;
    g[0]!.set(chosen === null ? "idle" : chosen === "v1" ? "on" : "off", time);
    g[1]!.set(chosen === null ? "idle" : chosen === "v0" ? "on" : "off", time);
  }

  apply(st: RideStation, k: number, reveal: boolean, time: number): boolean {
    const c = st.cue;
    const faultOn = c.kind === "fault";
    this.alarm.mesh.visible = faultOn || (c.kind === "pt" && !c.valid && reveal && k > 1.2);
    this.alarmLight.visible = this.alarm.mesh.visible;
    this.alarmLight.material.opacity = 0.5 + 0.5 * Math.sin(time * 9);
    this.disk.visible = faultOn;
    this.beam.material.opacity = faultOn && k > 0.4 ? 0.3 + 0.25 * Math.sin(time * 10) : 0;
    this.disk.rotation.y = time * 2;
    switch (c.kind) {
      case "pt":
        return this.cuePt(c, k, reveal);
      case "fault":
        return k > 1.5;
      case "dram":
        return this.cueDram(c, k);
      default:
        return true;
    }
  }

  /** 进入页表世界前，先把每一层的表画成该站之前的样子 */
  prepareFloors(stations: RideStation[]) {
    for (const st of stations) if (st.cue.kind === "pt") this.drawFloor(st.cue, -1, false);
  }

  private drawFloor(c: Cue<"pt">, stage: number, reveal: boolean) {
    const f = this.floors[c.floor];
    if (!f) return;
    f.label.draw(c.title, (g, w, h) => {
      rr(g, 2, 2, w - 4, h - 4, 14);
      g.fillStyle = "rgba(10,12,16,0.75)";
      g.fill();
      g.fillStyle = C.membus;
      g.fillRect(14, h / 2 - 12, 8, 24);
      text(g, `第 ${c.floor + 1} 层 · ${c.title}`, 40, h / 2 + 1, 38, C.ink, 600);
    });
    f.plate.draw(`${c.addr}|${stage}|${reveal}|${c.rows.map((r) => r.text).join()}`, (g, w, h) => {
      panelBg(g, w, h, C.membus);
      text(g, "表项地址", 40, 50, 28, C.dim, 500);
      text(g, c.addr, 40, 96, 34, stage >= 0 ? "#fff" : "rgba(233,234,238,0.5)", 600, "left", MONO);
      const top = 150;
      const rowH = 100;
      // 上下各露出一截，表示表很长
      g.fillStyle = "rgba(255,255,255,0.04)";
      rr(g, 40, top - 26, w - 80, 16, 6);
      g.fill();
      c.rows.forEach((row, i) => {
        const y = top + i * (rowH + 12);
        const hi = i === c.hi;
        const lit = hi && stage >= 1;
        const bad = lit && reveal && !row.valid;
        rr(g, 40, y, w - 80, rowH, 12);
        g.fillStyle = bad ? "rgba(255,90,90,0.22)" : lit ? (reveal ? "rgba(76,227,138,0.24)" : "rgba(176,124,255,0.26)") : "rgba(255,255,255,0.06)";
        g.fill();
        g.lineWidth = lit ? 3 : 1.5;
        g.strokeStyle = bad ? C.bad : lit ? (reveal ? C.ok : C.membus) : "rgba(255,255,255,0.14)";
        g.stroke();
        text(g, row.idx, 72, y + rowH / 2, 36, hi ? "#fff" : C.dim, 600, "left", MONO);
        const showVal = !hi || reveal || c.floor < c.floors - 1;
        text(g, showVal ? row.text : "V = ?", w - 72, y + rowH / 2, 34, !row.valid && showVal ? C.bad : C.ink, 500, "right", MONO);
      });
      g.fillStyle = "rgba(255,255,255,0.04)";
      rr(g, 40, top + c.rows.length * (rowH + 12) + 4, w - 80, 16, 6);
      g.fill();
    });
  }

  private cuePt(c: Cue<"pt">, k: number, reveal: boolean) {
    const stage = k < 0 ? -1 : k < 0.6 ? 0 : 1;
    const leaf = c.floor === c.floors - 1;
    const r = leaf ? reveal && k > 1.2 : true;
    this.drawFloor(c, stage, r);
    // 上一层保持已查过的样子
    return k > 1.2 && (reveal || !leaf);
  }

  private cueDram(c: Cue<"dram">, k: number) {
    const n = this.n;
    const row = c.row % n;
    const col = c.col % n;
    const t = Math.max(0, k);
    const rowOn = k >= 0 && t > 0.4;
    const colOn = k >= 0 && t > 1.2;
    const key = `${row}|${col}|${rowOn}|${colOn}`;
    if (key !== this.lastCells) {
      this.lastCells = key;
      for (let r = 0; r < n; r++)
        for (let cc = 0; cc < n; cc++) {
          let col0 = "#26304a";
          if (rowOn && r === row) col0 = "#8a7a2e";
          if (colOn && r === row && cc >= col && cc < col + 2) col0 = C.power;
          if (colOn && r !== row && cc >= col && cc < col + 2) col0 = "#2b4a7a";
          this.cells.setColorAt(r * n + cc, this.cellColor.set(col0));
        }
      if (this.cells.instanceColor) this.cells.instanceColor.needsUpdate = true;
    }
    this.rowBuf.material.opacity = rowOn ? 0.75 : 0.2;
    this.dramPlate.draw(`${c.row}|${c.col}|${rowOn}|${colOn}`, (g, w, h) => {
      panelBg(g, w, h, "#7aa7ff");
      text(g, `Bank ${c.bank}`, 40, h / 2, 36, C.ink, 600);
      text(g, `行地址 ${c.row}`, 330, h / 2, 36, rowOn ? C.power : C.dim, 600);
      text(g, `列地址 ${c.col}`, 680, h / 2, 36, colOn ? C.pcie : C.dim, 600);
    });
    return t > 2.0;
  }

  dispose() {
    for (const p of this.plates) p.dispose();
    for (const g of this.gates) for (const x of g) x.dispose();
    disposeTree(this.scene);
  }
}
