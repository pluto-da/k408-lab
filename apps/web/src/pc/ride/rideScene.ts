// 「化身数据」的镜头与场景调度：把站点列表变成一条连续的飞行路线，按进度画出第一人称画面。
// 进度 s ∈ [0, N]：第 i 站的路段占 (i, i+1]，s = i + 1 时到站。
import * as THREE from "three";
import type { RideFrame, RideHost } from "../engine";
import type { RidePlan, RideStation, World } from "./types";
import { ChipWorld } from "./three/chip";
import { MemWorld } from "./three/mem";
import { buildPaths, pcAnchorOf, type StationPath } from "./three/layout";
import { C } from "./three/kit";

export type RideView = "first" | "follow" | "map";
export type RideMode = "auto" | "manual";

export interface RideCallbacks {
  /** 当前站点变化，或到站 */
  onStation: (i: number, arrived: boolean) => void;
  /** 本站动画播完（岔路已揭晓） */
  onCueDone: (i: number) => void;
  /** 位置（小地图用）：所在世界、站点、在机箱总线上的进度 */
  onPos: (world: World, i: number, pcU: number) => void;
  /** 走到终点后再按继续 */
  onEnd: () => void;
}

const ease = (t: number) => -(Math.cos(Math.PI * t) - 1) / 2;
const clamp = (x: number, a: number, b: number) => Math.min(b, Math.max(a, x));
const UP = new THREE.Vector3(0, 1, 0);

interface Pose {
  world: World;
  pos: THREE.Vector3;
  dir: THREE.Vector3;
  roll: number;
  pcU: number;
}

export class RideScene {
  private chip: ChipWorld;
  private mem: MemWorld;
  private icam = new THREE.PerspectiveCamera(60, 1, 0.05, 160);
  private mapCam = new THREE.PerspectiveCamera(32, 1, 0.01, 20);
  private plan: RidePlan | null = null;
  private paths: StationPath[] = [];
  private s = 0;
  private goal = 0;
  private mode: RideMode = "auto";
  private view: RideView = "first";
  private judge = false;
  private reduced = false;
  private speed = 1;
  private driveDir = 0;
  private autoNext = false;
  private paused = false;
  private inset = { bottom: 0, right: 0 };
  private insetNow = { bottom: 0, right: 0 };
  private arrivedAt = new Map<number, number>();
  private revealed = new Set<number>();
  private doneSent = new Set<number>();
  private cur = -1;
  private curArrived = false;
  private world: World | null = null;
  private yaw = 0;
  private pitch = 0;
  private lookHeld = false;
  private lookRelease = 0;
  private q = new THREE.Quaternion();
  private snap = true;
  private intro: { t0: number; from: THREE.Vector3; fromQ: THREE.Quaternion; to: THREE.Vector3; look: THREE.Vector3 } | null = null;
  private tunnel: THREE.Mesh<THREE.TubeGeometry, THREE.ShaderMaterial> | null = null;
  private pcOut: THREE.CatmullRomCurve3 | null = null;
  private pcBack: THREE.CatmullRomCurve3 | null = null;
  private orbs: Record<World, THREE.Group>;
  private mapOrb: THREE.Group;
  private lastPos = 0;
  private waitNext = 0;
  private ended = false;
  private alive = true;

  constructor(
    private host: RideHost,
    private fx: () => HTMLElement | null,
    private cb: RideCallbacks,
  ) {
    const low = host.lowEnd;
    this.chip = new ChipWorld({ phone: host.phone, low });
    this.mem = new MemWorld({ phone: host.phone, low });
    this.orbs = { chip: this.orb(0.09), mem: this.orb(0.09), pc: this.orb(0.0012) };
    this.chip.scene.add(this.orbs.chip);
    this.mem.scene.add(this.orbs.mem);
    host.scene.add(this.orbs.pc);
    this.mapOrb = this.orb(0.012);
    host.scene.add(this.mapOrb);
    for (const o of [...Object.values(this.orbs), this.mapOrb]) o.visible = false;
    this.buildTunnel();
    host.setFrame(this.frame);
  }

  // ---------------------------------------------------------------- setup
  private orb(r: number): THREE.Group {
    const g = new THREE.Group();
    const core = new THREE.Mesh(new THREE.SphereGeometry(r, 20, 14), new THREE.MeshBasicMaterial({ color: "#ffffff", toneMapped: false }));
    const halo = new THREE.Mesh(new THREE.SphereGeometry(r * 2.4, 20, 14), new THREE.MeshBasicMaterial({ color: C.membus, transparent: true, opacity: 0.28, depthWrite: false, toneMapped: false }));
    g.add(core, halo);
    return g;
  }

  /** 内存总线：沿整机锚点生成曲线，外面套一层半透明的通道 */
  private buildTunnel() {
    const a = (p: string, k: string) => this.host.anchor(p as never, k);
    const pts = [a("board", "cpu"), a("board", "dimm"), a("ram", "chips")].filter((v): v is THREE.Vector3 => !!v);
    if (pts.length < 2) return;
    const lifted: THREE.Vector3[] = [];
    pts.forEach((p, i) => {
      const q = p.clone().add(new THREE.Vector3(-0.014, 0, 0));
      if (i > 0) lifted.push(lifted[lifted.length - 1]!.clone().lerp(q, 0.5).add(new THREE.Vector3(-0.006, 0.004, 0)));
      lifted.push(q);
    });
    // 从 CPU 上方一点点出发，到内存颗粒前一点点结束
    const start = lifted[0]!.clone().add(new THREE.Vector3(-0.01, 0.01, 0));
    const end = lifted[lifted.length - 1]!.clone().add(new THREE.Vector3(-0.012, 0.006, 0));
    const fwd = [start, ...lifted, end];
    this.pcOut = new THREE.CatmullRomCurve3(fwd, false, "centripetal", 0.5);
    this.pcBack = new THREE.CatmullRomCurve3([...fwd].reverse(), false, "centripetal", 0.5);
    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      uniforms: { uTime: { value: 0 }, uColor: { value: new THREE.Color(C.membus) }, uMove: { value: 1 } },
      vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
      fragmentShader: `varying vec2 vUv; uniform float uTime; uniform vec3 uColor; uniform float uMove;
        void main(){ float ring = smoothstep(0.82, 1.0, 0.5 + 0.5*sin(vUv.x*260.0 - uTime*6.0*uMove));
          float seam = smoothstep(0.9, 1.0, 0.5 + 0.5*sin(vUv.y*6.2831*4.0));
          gl_FragColor = vec4(uColor, 0.07 + ring*0.35 + seam*0.08); }`,
    });
    const len = this.pcOut.getLength();
    this.tunnel = new THREE.Mesh(new THREE.TubeGeometry(this.pcOut, Math.max(60, Math.round(len / 0.002)), 0.0045, 14, false), mat);
    this.tunnel.renderOrder = 5;
    this.tunnel.visible = false;
    this.host.scene.add(this.tunnel);
  }

  setPlan(plan: RidePlan, judge: boolean) {
    this.plan = plan;
    this.judge = judge;
    this.paths = buildPaths(plan.stations, (back) => (back ? this.pcBack : this.pcOut));
    const floors = plan.stations.filter((s) => s.cue.kind === "pt").length;
    this.mem.setFloors(Math.max(1, floors));
    this.mem.prepareFloors(plan.stations);
    this.s = 0;
    this.goal = 0;
    this.arrivedAt.clear();
    this.revealed.clear();
    this.doneSent.clear();
    this.cur = -1;
    this.curArrived = false;
    this.ended = false;
    this.snap = true;
    this.world = null;
  }

  /** 开始：从整机外俯冲进 CPU，再沿路线前进到第一站 */
  start(withIntro: boolean) {
    const cpu = this.host.anchor("board", "cpu");
    if (withIntro && !this.reduced && cpu) {
      const cam = this.host.camera;
      this.intro = { t0: performance.now(), from: cam.position.clone(), fromQ: cam.quaternion.clone(), to: cpu.clone().add(new THREE.Vector3(-0.035, 0.012, 0.004)), look: cpu.clone() };
    } else {
      this.intro = null;
    }
    this.goal = 1;
  }

  // ---------------------------------------------------------------- controls
  get count() {
    return this.plan?.stations.length ?? 0;
  }

  private idxOf(s: number) {
    return s <= 0 ? 0 : Math.min(this.count - 1, Math.ceil(s - 1e-6) - 1);
  }

  private isRevealed(i: number) {
    const st = this.plan?.stations[i];
    return !st?.fork || !this.judge || this.revealed.has(i);
  }

  /** 前进的上限：「我来判断」时停在还没回答的岔路口 */
  private limit() {
    const n = this.count;
    if (!this.judge) return n;
    for (let i = Math.max(0, this.idxOf(this.s)); i < n; i++) if (!this.isRevealed(i)) return i + 1;
    return n;
  }

  next() {
    if (!this.plan || this.intro) return;
    const i = this.idxOf(this.s);
    const arrived = this.s >= i + 1 - 1e-6;
    if (!arrived) {
      // 路上按继续：直接到站
      this.goal = i + 1;
      if (this.reduced) this.jump(i + 1);
      return;
    }
    if (!this.isRevealed(i)) return;
    if (i >= this.count - 1) {
      this.ended = true;
      this.cb.onEnd();
      return;
    }
    this.goal = Math.min(this.limit(), i + 2);
    if (this.reduced || this.mode === "manual") this.jump(this.goal);
  }

  prev() {
    this.goTo(Math.max(0, this.idxOf(this.s) - 1));
  }

  /** 跳到第 i 站（到站状态），重新播放本站动画 */
  goTo(i: number) {
    if (!this.plan) return;
    i = clamp(i, 0, this.count - 1);
    for (let j = 0; j < i; j++) this.revealed.add(j);
    this.arrivedAt.delete(i);
    this.doneSent.delete(i);
    this.ended = false;
    this.intro = null;
    this.jump(i + 1);
  }

  private jump(s: number) {
    const before = this.world;
    this.s = s;
    this.goal = s;
    this.snap = true;
    if (!this.reduced || before) this.flash();
  }

  reveal(i: number) {
    this.revealed.add(i);
  }

  setMode(m: RideMode) {
    if (m === this.mode) return;
    this.mode = m;
    this.driveDir = 0;
    if (m === "auto") this.goal = Math.max(this.s, this.goal);
  }

  setJudge(j: boolean) {
    this.judge = j;
  }

  setAutoNext(v: boolean) {
    this.autoNext = v;
    this.waitNext = 0;
  }

  drive(d: -1 | 0 | 1) {
    if (this.reduced && d !== 0) {
      if (d > 0) this.next();
      else this.prev();
      return;
    }
    this.driveDir = d;
  }

  /** 底部（或横屏时右侧）界面占去的像素：画面中心挪到剩下的区域中间 */
  setInsets(bottom: number, right: number) {
    this.inset = { bottom, right };
  }

  private applyOffset(cam: THREE.PerspectiveCamera, w: number, h: number) {
    const b = Math.min(this.insetNow.bottom, h * 0.6);
    const r = Math.min(this.insetNow.right, w * 0.55);
    if (b < 1 && r < 1) {
      if (cam.view?.enabled) cam.clearViewOffset();
      return;
    }
    cam.setViewOffset(w, h, r * 0.45, b * 0.42, w, h);
  }

  setPaused(p: boolean) {
    this.paused = p;
  }

  setSpeed(x: number) {
    this.speed = clamp(x, 0.4, 3);
  }

  getSpeed() {
    return this.speed;
  }

  look(dx: number, dy: number) {
    this.lookHeld = true;
    this.yaw = clamp(this.yaw - dx * 0.005, -1.2, 1.2);
    this.pitch = clamp(this.pitch - dy * 0.004, -0.75, 0.75);
  }

  lookEnd() {
    this.lookHeld = false;
    this.lookRelease = performance.now();
  }

  setView(v: RideView) {
    this.view = v;
    this.snap = true;
  }

  setReduced(r: boolean) {
    this.reduced = r;
    if (r && this.s < this.goal) this.jump(this.goal);
  }

  private flash() {
    const el = this.fx();
    if (!el) return;
    el.classList.remove("is-flash");
    void el.offsetWidth;
    el.classList.add("is-flash");
  }

  /** 退出：把整机相机放到数据所在的位置附近，交还给引擎拉回总览 */
  exit() {
    this.alive = false;
    this.host.setFrame(null);
    const cam = this.host.camera;
    if (this.world !== "pc" || this.view === "map") {
      const st = this.plan?.stations[this.idxOf(this.s)];
      const [p, k] = pcAnchorOf(this.world ?? "chip", st?.place ?? "core");
      const a = this.host.anchor(p as never, k);
      if (a) {
        cam.position.copy(a).add(new THREE.Vector3(-0.06, 0.02, 0.03));
        cam.up.set(0, 1, 0);
        cam.lookAt(a);
      }
    }
    cam.up.set(0, 1, 0);
    cam.clearViewOffset();
    cam.updateProjectionMatrix();
    this.host.focusLink(null);
  }

  // ---------------------------------------------------------------- pose
  private pose(s: number, out?: Pose): Pose {
    const i = this.idxOf(s);
    const path = this.paths[i]!;
    const t = s <= 0 ? 0 : clamp(s - i, 0, 1);
    const te = this.reduced ? 1 : ease(t);
    const total = path.legs.reduce((a, l) => a + l.w, 0);
    let acc = 0;
    let li = 0;
    for (; li < path.legs.length - 1; li++) {
      if ((acc + path.legs[li]!.w) / total >= te) break;
      acc += path.legs[li]!.w;
    }
    const leg = path.legs[li]!;
    const u = clamp((te * total - acc) / leg.w, 0, 1);
    const pos = leg.curve.getPointAt(u);
    const tan = leg.curve.getTangentAt(Math.min(u, 0.999));
    const dir = tan.clone();
    const last = li === path.legs.length - 1;
    if (last && leg.look) {
      const w = clamp((u - 0.45) / 0.55, 0, 1);
      const to = leg.look.clone().sub(pos);
      if (to.lengthSq() > 1e-12) dir.lerp(to.normalize(), w * w * (3 - 2 * w)).normalize();
    }
    // 转弯倾斜：前后两点切线的水平夹角
    let roll = 0;
    if (!this.reduced && u < 0.98) {
      const t2 = leg.curve.getTangentAt(Math.min(0.999, u + 0.03));
      const cross = new THREE.Vector3().crossVectors(tan, t2).y;
      roll = clamp(-cross * 2.2, -0.12, 0.12) * (leg.world === "pc" ? 0.5 : 1);
    }
    const pose = out ?? ({} as Pose);
    pose.world = leg.world;
    pose.pos = pos;
    pose.dir = dir;
    pose.roll = roll;
    pose.pcU = leg.world === "pc" ? u : -1;
    return pose;
  }

  // ---------------------------------------------------------------- frame
  private frame: RideFrame = (dt, time) => {
    if (!this.alive || !this.plan || !this.paths.length) return null;
    const now = performance.now();
    const host = this.host;
    const el = host.renderer.domElement;
    const aspect = Math.max(0.2, el.clientWidth / Math.max(1, el.clientHeight));
    const ka = 1 - Math.exp(-dt * 4);
    this.insetNow.bottom += (this.inset.bottom - this.insetNow.bottom) * ka;
    this.insetNow.right += (this.inset.right - this.insetNow.right) * ka;

    // 俯冲进 CPU
    if (this.intro) {
      const k = clamp((now - this.intro.t0) / 1800, 0, 1);
      const e = ease(k);
      const cam = host.camera;
      cam.near = 0.0008;
      cam.far = 6;
      cam.fov = 32 + 20 * e;
      cam.aspect = aspect;
      cam.updateProjectionMatrix();
      cam.position.lerpVectors(this.intro.from, this.intro.to, e);
      const m = new THREE.Matrix4().lookAt(cam.position, this.intro.look, UP);
      const q = new THREE.Quaternion().setFromRotationMatrix(m);
      cam.quaternion.slerpQuaternions(this.intro.fromQ, q, Math.min(1, e * 1.6));
      if (this.tunnel) this.tunnel.visible = false;
      if (k >= 1) {
        this.intro = null;
        this.snap = true;
        this.flash();
      }
      return { scene: host.scene, camera: cam };
    }

    // 推进
    const n = this.count;
    const i0 = this.idxOf(this.s);
    const segDur = (this.paths[i0]?.dur ?? 2.4) / this.speed;
    const lim = this.limit();
    if (this.paused) {
      /* 暂停：原地不动 */
    } else if (this.mode === "manual") {
      if (this.driveDir !== 0) this.s = clamp(this.s + (this.driveDir * dt) / segDur, 0, lim);
    } else if (this.s < this.goal) {
      this.s = Math.min(this.goal, lim, this.s + dt / segDur);
    }

    const i = this.idxOf(this.s);
    const arrived = this.s >= i + 1 - 1e-6;
    const st = this.plan.stations[i]!;
    if (arrived && !this.arrivedAt.has(i)) this.arrivedAt.set(i, now);
    if (i !== this.cur || arrived !== this.curArrived) {
      this.cur = i;
      this.curArrived = arrived;
      this.cb.onStation(i, arrived);
    }
    const k = arrived ? (now - this.arrivedAt.get(i)!) / 1000 : -1;
    const rev = this.isRevealed(i);

    // 场景状态
    const p = this.pose(this.s);
    let done = true;
    const stationWorld = this.paths[i]!.legs[this.paths[i]!.legs.length - 1]!.world;
    if (stationWorld === "chip") done = this.chip.apply(st, k, rev, time);
    else if (stationWorld === "mem") done = this.mem.apply(st, k, rev, time);
    else done = k > 0.6;
    if (arrived && done && !this.doneSent.has(i)) {
      this.doneSent.add(i);
      this.cb.onCueDone(i);
      this.waitNext = now;
    }
    this.updateGates(i, arrived && done, time);
    // 自动巡航：不停靠的站（总线）播完就继续；「自动继续」时停靠站也继续
    if (this.mode === "auto" && !this.paused && arrived && done && rev && !this.ended && this.goal <= i + 1) {
      const wait = st.stop ? (this.autoNext ? 2600 + st.caption.length * 28 : Infinity) : 250;
      if (now - this.waitNext > wait) {
        if (i < n - 1) this.goal = i + 2;
        else if (this.autoNext) {
          this.ended = true;
          this.cb.onEnd();
        }
        if (this.reduced && this.goal > this.s) this.jump(this.goal);
      }
    }

    // 世界切换时闪一下
    const world: World = this.view === "map" ? "pc" : p.world;
    if (this.world !== null && world !== this.world && this.view !== "map") this.flash();
    if (world !== this.world) this.snap = true;
    this.world = world;
    host.focusLink(p.world === "pc" || this.view === "map" ? "membus" : null);
    if (now - this.lastPos > 90) {
      this.lastPos = now;
      this.cb.onPos(p.world, i, p.pcU);
    }

    // 镜头
    if (this.view === "map") return this.frameMap(p, st, aspect, time);
    const cam = p.world === "pc" ? host.camera : this.icam;
    const pc = p.world === "pc";
    if (pc) {
      cam.near = 0.0006;
      cam.far = 6;
    }
    const vfov = clamp((2 * Math.atan(Math.tan((34 * Math.PI) / 180) / aspect) * 180) / Math.PI, pc ? 64 : 58, 96);
    cam.fov = vfov;
    cam.aspect = aspect;
    this.applyOffset(cam, el.clientWidth, el.clientHeight);
    cam.updateProjectionMatrix();
    if (!this.lookHeld && now - this.lookRelease > 1200) {
      const a = 1 - Math.exp(-dt * 2.5);
      this.yaw -= this.yaw * a;
      this.pitch -= this.pitch * a;
    }
    const target = new THREE.Quaternion();
    const eye = p.pos.clone();
    let lookAt: THREE.Vector3;
    const orb = this.orbs[p.world];
    for (const w of ["chip", "mem", "pc"] as World[]) this.orbs[w].visible = false;
    if (this.view === "follow") {
      const back = pc ? 0.03 : 3.6;
      const up = pc ? 0.008 : 1.1;
      const flat = p.dir.clone();
      eye.addScaledVector(flat, -back).addScaledVector(UP, up);
      lookAt = p.pos.clone().addScaledVector(p.dir, pc ? 0.01 : 1.2);
      orb.visible = true;
      orb.position.copy(p.pos);
      const s0 = 1 + 0.12 * Math.sin(time * 6);
      orb.scale.setScalar(s0);
    } else {
      lookAt = p.pos.clone().add(p.dir);
    }
    const m = new THREE.Matrix4().lookAt(eye, lookAt, UP);
    target.setFromRotationMatrix(m);
    if (this.view === "first" && p.roll) target.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), p.roll));
    if (this.yaw || this.pitch) {
      const yq = new THREE.Quaternion().setFromAxisAngle(UP, this.yaw);
      const pq = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), this.pitch);
      target.premultiply(yq).multiply(pq);
    }
    if (this.snap) {
      this.q.copy(target);
      this.snap = false;
    } else {
      this.q.slerp(target, 1 - Math.exp(-dt * (this.reduced ? 20 : 9)));
    }
    cam.position.copy(eye);
    cam.quaternion.copy(this.q);
    cam.up.copy(UP);
    if (this.tunnel) {
      this.tunnel.visible = pc;
      this.tunnel.material.uniforms.uTime!.value = time;
      this.tunnel.material.uniforms.uMove!.value = this.reduced ? 0 : 1;
    }
    this.mapOrb.visible = false;
    return { scene: pc ? host.scene : p.world === "mem" ? this.mem.scene : this.chip.scene, camera: cam };
  };

  private frameMap(p: Pose, st: RideStation, aspect: number, time: number) {
    const host = this.host;
    const ov = host.overview();
    const cam = this.mapCam;
    cam.aspect = aspect;
    cam.fov = aspect < 0.8 ? 52 : 34;
    this.applyOffset(cam, host.renderer.domElement.clientWidth, host.renderer.domElement.clientHeight);
    cam.updateProjectionMatrix();
    cam.position.copy(ov.position);
    cam.lookAt(ov.target);
    for (const w of ["chip", "mem", "pc"] as World[]) this.orbs[w].visible = false;
    let at: THREE.Vector3 | null;
    if (p.world === "pc") at = p.pos.clone();
    else {
      const [a, k] = pcAnchorOf(p.world, st.place);
      at = host.anchor(a as never, k);
      at?.add(new THREE.Vector3(-0.02, 0, 0));
    }
    this.mapOrb.visible = !!at;
    if (at) this.mapOrb.position.copy(at);
    this.mapOrb.scale.setScalar(1 + 0.3 * Math.sin(time * 5));
    if (this.tunnel) this.tunnel.visible = true;
    return { scene: host.scene, camera: cam };
  }

  private updateGates(i: number, curDone: boolean, time: number) {
    const plan = this.plan!;
    plan.stations.forEach((s, j) => {
      if (!s.fork) return;
      const passed = this.s > j + 1 + 1e-6 || (j === i && curDone && this.isRevealed(j));
      const chosen = passed ? s.fork.answer : null;
      if (s.cue.kind === "pt") this.mem.setGates(s.cue.floor, chosen, time);
      else this.chip.setGates(s.id, chosen, time);
    });
  }

  dispose() {
    this.alive = false;
    this.host.setFrame(null);
    this.chip.dispose();
    this.mem.dispose();
    for (const o of [this.orbs.pc, this.mapOrb]) {
      this.host.scene.remove(o);
      o.traverse((x) => {
        const m = x as THREE.Mesh;
        m.geometry?.dispose();
        (m.material as THREE.Material | undefined)?.dispose();
      });
    }
    if (this.tunnel) {
      this.host.scene.remove(this.tunnel);
      this.tunnel.geometry.dispose();
      this.tunnel.material.dispose();
    }
  }
}
