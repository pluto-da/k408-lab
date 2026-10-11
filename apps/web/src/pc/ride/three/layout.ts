// 内部世界的布局与每一站的镜头路径。前进方向为 -Z，Y 向上，单位约等于「米」（以第一人称的眼睛为尺度）。
import * as THREE from "three";
import type { PlaceId, RideStation, World } from "../types";

const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

/** CPU 内部 */
export const CHIP = {
  start: V(0, 2.8, 11),
  core: { pos: V(0, 2.0, 7.6), look: V(0, 2.2, 0) },
  reg: { pos: V(-0.6, 2.0, 6.4), look: V(-2.0, 2.8, 0) },
  tlb: { pos: V(0.8, 1.9, -6.6), look: V(3.0, 3.0, -13.2) },
  tlbGates: { miss: V(-2.3, 0, -18.2), hit: V(2.3, 0, -18.2) },
  mmu: { pos: V(1.7, 1.8, -20.4), look: V(2.6, 2.5, -25.6) },
  mmuPlate: V(2.6, 2.6, -25.6),
  l1: { pos: V(0, 2.0, -25.6), look: V(0, 3.95, -34) },
  fill: { pos: V(-0.7, 2.1, -26.0), look: V(0, 3.95, -34) },
  l1Gates: { miss: V(-2.4, 0, -38), hit: V(2.4, 0, -38) },
  l2: { pos: V(0, 1.7, -42.6), look: V(0, 3.8, -47) },
  l2Gates: { miss: V(-2.4, 0, -50.5), hit: V(2.4, 0, -50.5) },
  l3: { pos: V(0, 1.7, -54.6), look: V(0, 3.8, -59) },
  l3Gates: { miss: V(-2.4, 0, -62.5), hit: V(2.4, 0, -62.5) },
  /** 通往内存控制器的出入口 */
  portal: V(-8.5, 1.7, -22),
  portalFar: V(0, 1.7, -68),
  laneX: 6.2,
};

/** 内存内部：页表楼层与 DRAM 阵列 */
export const MEM = {
  floorY: (k: number) => 10 - 5.5 * k,
  entry: V(0, 17.5, 15),
  floorDock: (k: number) => ({ pos: V(0, MEM.floorY(k) + 1.8, 7.4), look: V(0, MEM.floorY(k) + 2.3, 0) }),
  gate: (k: number, ok: boolean) => V(ok ? 4.3 : -4.3, MEM.floorY(k), 0.9),
  faultDock: (k: number) => ({ pos: V(-1.2, MEM.floorY(k) + 2.6, 7.4), look: V(-1.6, MEM.floorY(k) - 2.2, 0) }),
  exit: (k: number) => V(5.5, MEM.floorY(k) + 3.2, 11),
  dramX: 40,
  dram: { pos: V(40, 3.2, 11.5), look: V(40, 3.4, 0) },
  dramEntry: V(40, 3.8, 20),
};

export interface Leg {
  world: World;
  curve: THREE.CatmullRomCurve3;
  /** 到站时朝向的点；没有时朝曲线前进方向 */
  look?: THREE.Vector3;
  /** 时长权重 */
  w: number;
}

export interface StationPath {
  legs: Leg[];
  /** 本站的基本时长（秒，1 倍速） */
  dur: number;
}

/** 机箱里的总线：由 RideScene 用整机锚点生成 */
export type PcCurve = (back: boolean) => THREE.CatmullRomCurve3 | null;

const curve = (pts: THREE.Vector3[]) => new THREE.CatmullRomCurve3(pts, false, "centripetal", 0.5);

function chipLeg(pts: THREE.Vector3[], look?: THREE.Vector3): Leg {
  const c = curve(pts);
  return { world: "chip", curve: c, look, w: c.getLength() };
}
function memLeg(pts: THREE.Vector3[], look?: THREE.Vector3): Leg {
  const c = curve(pts);
  return { world: "mem", curve: c, look, w: c.getLength() };
}

const G = CHIP;
const eye = (v: THREE.Vector3, y = 1.7) => V(v.x, y, v.z);

/** 当前站点的终点（同一世界里下一站从这里出发） */
function dockOf(place: PlaceId, s: RideStation): { pos: THREE.Vector3; world: World } {
  const leafFloor = s.cue.kind === "pt" ? s.cue.floor : 0;
  switch (place) {
    case "core":
      return { pos: G.core.pos, world: "chip" };
    case "reg":
      return { pos: G.reg.pos, world: "chip" };
    case "tlb":
      return { pos: G.tlb.pos, world: "chip" };
    case "mmu":
      return { pos: G.mmu.pos, world: "chip" };
    case "l1":
      return { pos: G.l1.pos, world: "chip" };
    case "fill":
      return { pos: G.fill.pos, world: "chip" };
    case "l2":
      return { pos: G.l2.pos, world: "chip" };
    case "l3":
      return { pos: G.l3.pos, world: "chip" };
    case "ptDir":
    case "ptTbl":
    case "ptOne":
      return { pos: MEM.floorDock(leafFloor).pos, world: "mem" };
    case "fault":
      return { pos: MEM.faultDock(0).pos, world: "mem" };
    case "dram":
      return { pos: MEM.dram.pos, world: "mem" };
    default:
      return { pos: G.core.pos, world: "pc" };
  }
}

/** 按站点顺序生成每一站的镜头路径（前一站的终点就是这一站的起点） */
export function buildPaths(stations: RideStation[], pc: PcCurve): StationPath[] {
  const out: StationPath[] = [];
  const leafFloors = stations.filter((s) => s.cue.kind === "pt").length;
  const leaf = Math.max(0, leafFloors - 1);
  for (let i = 0; i < stations.length; i++) {
    const s = stations[i]!;
    const prev = i > 0 ? stations[i - 1]! : null;
    const from = prev ? prev.place : null;
    const legs: Leg[] = [];
    let dur = 2.4;
    switch (s.place) {
      case "core":
        legs.push(chipLeg([G.start, V(0, 2.2, 8.6), G.core.pos], G.core.look));
        dur = 2.2;
        break;
      case "tlb":
        legs.push(chipLeg([G.core.pos, V(0, 1.7, 2.5), V(0, 1.7, -3), G.tlb.pos], G.tlb.look));
        dur = 2.8;
        break;
      case "busOut":
      case "busMem": {
        // 先在 CPU 里穿过「缺失」的门洞，到达内存控制器的出口，再沿内存总线飞向内存条
        if (from === "tlb") legs.push(chipLeg([G.tlb.pos, V(-1.2, 1.7, -14), eye(G.tlbGates.miss, 1.7), V(-4.6, 1.7, -21), G.portal]));
        else legs.push(chipLeg([G.l3.pos, V(-1.4, 1.7, -59), eye(G.l3Gates.miss, 1.7), V(-1, 1.7, -65.5), G.portalFar]));
        const c = pc(false);
        if (c) legs.push({ world: "pc", curve: c, w: legs[0]!.w * 1.4 });
        dur = 5.2;
        break;
      }
      case "ptDir":
      case "ptOne":
        legs.push(memLeg([MEM.entry, V(0, 14, 10), MEM.floorDock(0).pos], MEM.floorDock(0).look));
        dur = 2.4;
        break;
      case "ptTbl": {
        const a = MEM.floorDock(0).pos;
        const b = MEM.floorDock(1).pos;
        legs.push(memLeg([a, V(0, a.y - 0.4, 3.4), V(0, b.y + 0.6, 3.4), b], MEM.floorDock(1).look));
        dur = 2.6;
        break;
      }
      case "fault": {
        const k = leaf;
        const d = MEM.floorDock(k).pos;
        const f = MEM.faultDock(k);
        legs.push(memLeg([d, V(-2.4, d.y, 3.4), V(MEM.gate(k, false).x, d.y, MEM.gate(k, false).z + 0.4), V(-2.6, f.pos.y - 0.4, 5.4), f.pos], f.look));
        dur = 2.6;
        break;
      }
      case "busBack": {
        const k = leaf;
        const start = from === "fault" ? MEM.faultDock(k).pos : MEM.floorDock(k).pos;
        const g = MEM.gate(k, true);
        legs.push(memLeg([start, V(2.2, MEM.floorY(k) + 1.6, 3.6), V(g.x, MEM.floorY(k) + 1.6, g.z + 0.3), V(5, MEM.floorY(k) + 2.4, 6), MEM.exit(k)]));
        const c = pc(true);
        if (c) legs.push({ world: "pc", curve: c, w: legs[0]!.w * 1.4 });
        dur = 5.0;
        break;
      }
      case "busMemBack": {
        legs.push(memLeg([MEM.dram.pos, V(40.6, 3.6, 15), MEM.dramEntry]));
        const c = pc(true);
        if (c) legs.push({ world: "pc", curve: c, w: legs[0]!.w * 1.6 });
        dur = 4.4;
        break;
      }
      case "dram":
        legs.push(memLeg([MEM.dramEntry, V(40.2, 3.4, 15.5), MEM.dram.pos], MEM.dram.look));
        dur = 2.2;
        break;
      case "mmu":
        if (from === "tlb") legs.push(chipLeg([G.tlb.pos, V(1.3, 1.7, -14.4), eye(G.tlbGates.hit, 1.75), G.mmu.pos], G.mmu.look));
        else legs.push(chipLeg([G.portal, V(-4.6, 1.7, -20.4), V(-1.2, 1.75, -19.6), G.mmu.pos], G.mmu.look));
        dur = 2.6;
        break;
      case "l1":
        legs.push(chipLeg([G.mmu.pos, V(1.4, 1.8, -23.4), V(0.4, 1.8, -26.2), G.l1.pos], G.l1.look));
        dur = 2.2;
        break;
      case "l2":
        legs.push(chipLeg([G.l1.pos, V(-1.3, 1.7, -34), eye(G.l1Gates.miss), V(-1.1, 1.7, -41), G.l2.pos], G.l2.look));
        dur = 2.8;
        break;
      case "l3":
        legs.push(chipLeg([G.l2.pos, V(-1.3, 1.7, -47), eye(G.l2Gates.miss), V(-1.1, 1.7, -53), G.l3.pos], G.l3.look));
        dur = 2.8;
        break;
      case "fill": {
        const L = G.laneX;
        if (from === "l2" || from === "l3") {
          const d = from === "l2" ? G.l2 : G.l3;
          const gate = from === "l2" ? G.l2Gates.hit : G.l3Gates.hit;
          legs.push(chipLeg([d.pos, V(1.4, 1.7, gate.z + 3.5), eye(gate), V(4.6, 1.75, gate.z + 1), V(L, 1.8, gate.z + 6), V(L, 1.8, -27), V(3.2, 1.85, -25), G.fill.pos], G.fill.look));
          dur = 4.2;
        } else {
          // 从内存回来：经内存控制器进入 CPU
          legs.push(chipLeg([G.portal, V(-4.4, 1.8, -25.6), V(-2, 1.85, -27.6), G.fill.pos], G.fill.look));
          dur = 2.6;
        }
        break;
      }
      case "reg": {
        const L = G.laneX;
        if (from === "l1") legs.push(chipLeg([G.l1.pos, V(1.4, 1.75, -34.5), eye(G.l1Gates.hit), V(4.6, 1.75, -37), V(L, 1.8, -31), V(L, 1.8, 3), V(3, 1.8, 8.4), G.reg.pos], G.reg.look));
        else legs.push(chipLeg([G.fill.pos, V(2.6, 1.85, -26.5), V(L, 1.8, -22), V(L, 1.8, 3), V(3, 1.8, 8.4), G.reg.pos], G.reg.look));
        dur = 4.4;
        break;
      }
    }
    if (!legs.length) {
      const d = dockOf(s.place, s);
      legs.push({ world: d.world === "pc" ? "chip" : d.world, curve: curve([d.pos.clone().add(V(0, 0, 1)), d.pos]), w: 1 });
    }
    out.push({ legs, dur });
  }
  return out;
}

/** 某一站的数据位置在整机里对应的锚点（小地图与全景用） */
export function pcAnchorOf(world: World, place: PlaceId): [string, string] {
  if (world === "mem" || place === "dram" || place.startsWith("pt") || place === "fault") return ["ram", "chips"];
  return ["board", "cpu"];
}
