// 「化身数据」的镜头与场景调度：把站点列表变成一条连续的飞行路线，按进度画出第一人称画面。
// 进度 s ∈ [0, N]：第 i 站的路段占 (i, i+1]，s = i + 1 时到站。
import * as THREE from "three";
import type { RideFrame, RideHost } from "../engine";
import type { RidePlan, RideStation, World } from "./types";
import { ChipWorld } from "./three/chip";
import { MemWorld } from "./three/mem";
import { buildPaths, pcAnchorOf, type StationPath } from "./three/layout";
import { C, type FocusSpec, type SceneLabel, type TextPlate } from "./three/kit";

/** 矩形（CSS 像素） */
export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** 测试构建的检查接口读取的状态 */
export interface RideProbe {
  station: number;
  arrived: boolean;
  settled: boolean;
  world: World;
  compact: boolean;
  view: Rect;
  safe: Rect;
  focus: Rect | null;
  minFontPx: number | null;
  labels: { text: string; rect: Rect }[];
  occluded: number;
  faded: number;
  dim: number;
}

const overlap = (a: Rect, b: Rect, pad = 0) => a.x < b.x + b.w + pad && b.x < a.x + a.w + pad && a.y < b.y + b.h + pad && b.y < a.y + a.h + pad;
const inside = (a: Rect, b: Rect) => a.x >= b.x - 0.5 && a.y >= b.y - 0.5 && a.x + a.w <= b.x + b.w + 0.5 && a.y + a.h <= b.y + b.h + 0.5;
/** 到站取景的过渡时间（秒） */
const FRAME_T = 0.75;
/** 焦点在观察窗口里最多占的面积比例：不无限放大 */
const MAX_AREA = 0.5;

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
  /** 观察窗口（相对画布）与其中不被界面覆盖的安全区（相对观察窗口） */
  private vp: Rect = { x: 0, y: 0, w: 1, h: 1 };
  private safe: Rect = { x: 0, y: 0, w: 1, h: 1 };
  private compact = false;
  private focus: FocusSpec | null = null;
  private focusIdx = -1;
  private focusKey = "";
  private frameP = new THREE.Vector3();
  private frameQ = new THREE.Quaternion();
  private hasFrame = false;
  /** 窗口尺寸变化后重新取景：从旧位置平滑过渡到新位置 */
  private reframe: { p: THREE.Vector3; q: THREE.Quaternion; t0: number } | null = null;
  private layoutAt = 0;
  private frameK = 0;
  private snapFrame = false;
  private dimK = 0;
  private layered: THREE.Object3D[] = [];
  private hiPlates: TextPlate[] = [];
  private faded: { mat: THREE.Material; o: number }[] = [];
  private occluded = 0;
  private focusRect: Rect | null = null;
  private labelEls = new Map<SceneLabel, { el: HTMLElement; w: number; h: number; t: string; on: boolean }>();
  private shownLabels: { text: string; rect: Rect }[] = [];
  private tmpCam = new THREE.PerspectiveCamera(60, 1, 0.05, 160);
  private dimScene = new THREE.Scene();
  private dimCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private dimMat = new THREE.MeshBasicMaterial({ color: "#05060a", transparent: true, opacity: 0, depthTest: false, depthWrite: false, toneMapped: false });
  private ray = new THREE.Raycaster();
  private lastCam: THREE.PerspectiveCamera | null = null;
  private lastWorld: World = "chip";
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
    private labelHost: () => HTMLElement | null = () => null,
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
    this.dimScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.dimMat));
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
    this.snapFrame = true;
    this.yaw = 0;
    this.pitch = 0;
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

  /** 页面坐标是否落在当前焦点上（电脑上悬停提示用） */
  overFocus(clientX: number, clientY: number) {
    const f = this.focusRect;
    if (!f) return false;
    const c = this.canvasRect();
    const x = clientX - c.left - this.vp.x;
    const y = clientY - c.top - this.vp.y;
    return x >= f.x && x <= f.x + f.w && y >= f.y && y <= f.y + f.h;
  }

  canvasRect() {
    return this.host.renderer.domElement.getBoundingClientRect();
  }

  /**
   * 观察窗口与安全区：渲染只覆盖观察窗口；到站取景把焦点放进安全区（观察窗口里扣掉贴边按钮的部分）。
   * view 相对画布，safe 相对观察窗口，单位 CSS 像素。
   */
  setLayout(view: Rect, safe: Rect) {
    const same = (a: Rect, b: Rect) => Math.abs(a.x - b.x) < 0.5 && Math.abs(a.y - b.y) < 0.5 && Math.abs(a.w - b.w) < 0.5 && Math.abs(a.h - b.h) < 0.5;
    if (same(view, this.vp) && same(safe, this.safe)) return;
    this.vp = { ...view, w: Math.max(1, view.w), h: Math.max(1, view.h) };
    this.safe = { ...safe, w: Math.max(1, safe.w), h: Math.max(1, safe.h) };
    // 小屏：文字板换大字少列的版本
    const compact = this.safe.w < 640 || this.safe.h < 400;
    if (compact !== this.compact) {
      this.compact = compact;
      this.chip.setCompact(compact);
      this.mem.setCompact(compact);
    }
    this.focusKey = "";
    this.layoutAt = performance.now();
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
    this.setFocus(-1, null);
    this.clearLabels();
    const r = this.host.renderer;
    r.setScissorTest(false);
    r.setViewport(0, 0, r.domElement.clientWidth, r.domElement.clientHeight);
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

  // ---------------------------------------------------------------- focus & framing
  private worldOf(i: number): World {
    const legs = this.paths[i]?.legs;
    return legs ? legs[legs.length - 1]!.world : "chip";
  }

  /** 切换焦点：把焦点物体放进第二层（压暗背景后全亮再画一遍），文字板提高分辨率 */
  private setFocus(i: number, spec: FocusSpec | null) {
    for (const o of this.layered) o.traverse((x) => x.layers.disable(1));
    this.layered = [];
    for (const f of this.faded) (f.mat as THREE.Material & { opacity: number }).opacity = f.o;
    this.faded = [];
    for (const p of this.hiPlates) if (!spec?.plates.includes(p)) p.setRes(p.baseRes);
    this.hiPlates = [];
    this.focus = spec;
    this.focusIdx = i;
    this.occluded = 0;
    if (!spec) return;
    for (const o of spec.objects) o.traverse((x) => x.layers.enable(1));
    this.layered = spec.objects.slice();
  }

  private boxCorners(b: THREE.Box3) {
    const out: THREE.Vector3[] = [];
    for (const x of [b.min.x, b.max.x]) for (const y of [b.min.y, b.max.y]) for (const z of [b.min.z, b.max.z]) out.push(new THREE.Vector3(x, y, z));
    return out;
  }

  /** 把世界点投影到观察窗口（CSS 像素，相对观察窗口左上角）；在镜头后面返回 null */
  private toView(cam: THREE.Camera, p: THREE.Vector3): { x: number; y: number } | null {
    const c = p.clone().applyMatrix4(cam.matrixWorldInverse);
    if (c.z > -0.02) return null;
    const n = p.clone().project(cam);
    return { x: ((n.x + 1) / 2) * this.vp.w, y: ((1 - n.y) / 2) * this.vp.h };
  }

  private rectOf(cam: THREE.Camera, pts: THREE.Vector3[]): Rect | null {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const p of pts) {
      const v = this.toView(cam, p);
      if (!v) return null;
      x0 = Math.min(x0, v.x);
      y0 = Math.min(y0, v.y);
      x1 = Math.max(x1, v.x);
      y1 = Math.max(y1, v.y);
    }
    return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
  }

  /**
   * 到站取景：沿首选方向后退，求出焦点包围盒完整落在安全区（四周留 8%）的最近距离，
   * 再把镜头朝向偏一点，让焦点中心落在安全区中心。只在到站（或窗口尺寸变化）时算一次。
   */
  private solveFrame(spec: FocusSpec, fov: number, dir: THREE.Vector3) {
    const cam = this.tmpCam;
    const W = this.vp.w;
    const H = this.vp.h;
    cam.fov = fov;
    cam.aspect = W / H;
    cam.near = 0.05;
    cam.far = 160;
    cam.updateProjectionMatrix();
    const S = this.safe;
    const mx = S.w * 0.08;
    const my = S.h * 0.08;
    const inner = { x: S.x + mx, y: S.y + my, w: S.w - 2 * mx, h: S.h - 2 * my };
    const center = spec.box.getCenter(new THREE.Vector3());
    const corners = spec.pts ?? this.boxCorners(spec.box);
    const tanV = Math.tan((fov * Math.PI) / 360);
    const nx = ((S.x + S.w / 2) / W) * 2 - 1;
    const ny = -(((S.y + S.h / 2) / H) * 2 - 1);
    const cdir = new THREE.Vector3(nx * tanV * cam.aspect, ny * tanV, -1).normalize();
    const qc = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, -1), cdir).invert();
    const qd = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().lookAt(new THREE.Vector3(), dir, UP));
    const q = qd.multiply(qc);
    const place = (d: number) => {
      cam.position.copy(center).addScaledVector(dir, -d);
      cam.quaternion.copy(q);
      cam.updateMatrixWorld(true);
      return this.rectOf(cam, corners);
    };
    let lo = 0.3;
    let hi = 150;
    for (let k = 0; k < 32; k++) {
      const mid = (lo + hi) / 2;
      const r = place(mid);
      if (r && inside(r, inner)) hi = mid;
      else lo = mid;
    }
    let d = hi;
    const area = (r: Rect | null) => (r ? (r.w * r.h) / (W * H) : 0);
    const cap = spec.maxArea ?? MAX_AREA;
    if (area(place(d)) > cap) {
      let a = d;
      let b = d * 6;
      for (let k = 0; k < 28; k++) {
        const mid = (a + b) / 2;
        if (area(place(mid)) > cap) a = mid;
        else b = mid;
      }
      d = b;
    }
    place(d);
    return { pos: cam.position.clone(), quat: cam.quaternion.clone(), cam };
  }

  /** 从镜头向焦点包围盒的采样点发射射线，返回被别的物体挡住的采样点比例与遮挡物 */
  private occlusion(spec: FocusSpec, from: THREE.Vector3, scene: THREE.Scene) {
    const focusSet = new Set<THREE.Object3D>();
    for (const o of spec.objects) o.traverse((x) => focusSet.add(x));
    const meshes: THREE.Object3D[] = [];
    scene.traverse((x) => {
      const m = x as THREE.Mesh;
      if (!m.isMesh || focusSet.has(m) || m === this.tunnel) return;
      let v: THREE.Object3D | null = m;
      while (v) {
        if (!v.visible) return;
        v = v.parent;
      }
      const mat = m.material as THREE.Material & { opacity?: number };
      if (Array.isArray(mat) || (mat.opacity ?? 1) < 0.05) return;
      if (m.geometry.type === "PlaneGeometry" && (m.geometry as THREE.PlaneGeometry).parameters.width > 50) return;
      meshes.push(m);
    });
    const c = spec.box.getCenter(new THREE.Vector3());
    const pts = [c, ...(spec.pts ?? this.boxCorners(spec.box)).map((p) => p.clone().lerp(c, 0.12))];
    const hits = new Set<THREE.Mesh>();
    let blocked = 0;
    for (const p of pts) {
      const d = p.clone().sub(from);
      const len = d.length();
      this.ray.set(from, d.normalize());
      this.ray.far = len - 0.05;
      const h = this.ray.intersectObjects(meshes, false);
      if (h.length) {
        blocked++;
        for (const x of h) hits.add(x.object as THREE.Mesh);
      }
    }
    return { frac: blocked / pts.length, hits: [...hits] };
  }

  private frameStation(i: number, st: RideStation, fov: number) {
    const w = this.worldOf(i);
    const world = w === "mem" ? this.mem : w === "chip" ? this.chip : null;
    const spec = world ? world.focus(st) : null;
    // 同一站因窗口变化重新取景：记下旧位置，过渡过去
    this.reframe = i === this.focusIdx && this.hasFrame && this.frameK > 0.5 && !this.reduced ? { p: this.frameP.clone(), q: this.frameQ.clone(), t0: performance.now() } : null;
    if (i !== this.focusIdx || spec?.objects[0] !== this.focus?.objects[0]) this.setFocus(i, spec);
    else this.focus = spec;
    this.hasFrame = false;
    if (!spec) return;
    const scene = w === "mem" ? this.mem.scene : this.chip.scene;
    // 首选方向；被挡住时依次试：抬高、左移、右移
    const right = new THREE.Vector3().crossVectors(spec.dir, UP).normalize();
    const dirs = [spec.dir, spec.dir.clone().add(new THREE.Vector3(0, -0.32, 0)).normalize(), spec.dir.clone().addScaledVector(right, -0.35).normalize(), spec.dir.clone().addScaledVector(right, 0.35).normalize()];
    let best: { pos: THREE.Vector3; quat: THREE.Quaternion; frac: number; hits: THREE.Mesh[] } | null = null;
    for (const d of dirs) {
      const f = this.solveFrame(spec, fov, d);
      const o = this.occlusion(spec, f.pos, scene);
      if (!best || o.frac < best.frac - 1e-6) best = { pos: f.pos, quat: f.quat, frac: o.frac, hits: o.hits };
      if (o.frac <= 0.1) break;
    }
    this.frameP.copy(best!.pos);
    this.frameQ.copy(best!.quat);
    this.hasFrame = true;
    this.occluded = best!.frac;
    // 换了方向仍被挡住：把遮挡物临时淡化到 15%
    for (const f of this.faded) (f.mat as THREE.Material & { opacity: number }).opacity = f.o;
    this.faded = [];
    if (best!.frac > 0.1) {
      for (const m of best!.hits) {
        const mat = m.material as THREE.Material & { opacity: number };
        if (this.faded.some((f) => f.mat === mat)) continue;
        this.faded.push({ mat, o: mat.opacity });
        mat.transparent = true;
      }
    }
    // 焦点文字板按屏幕上的实际像素重画
    const cam = this.tmpCam;
    cam.position.copy(this.frameP);
    cam.quaternion.copy(this.frameQ);
    cam.updateMatrixWorld(true);
    const dpr = this.host.renderer.getPixelRatio();
    for (const p of spec.plates) {
      const a = this.toView(cam, p.mesh.localToWorld(new THREE.Vector3(-p.worldW / 2, 0, 0)));
      const b = this.toView(cam, p.mesh.localToWorld(new THREE.Vector3(p.worldW / 2, 0, 0)));
      if (!a || !b) continue;
      const px = Math.hypot(b.x - a.x, b.y - a.y) * dpr;
      p.setRes(Math.max(p.baseRes, Math.min(this.host.lowEnd ? 1.5 : 2.5, (px / p.w) * 1.15)));
      this.hiPlates.push(p);
    }
  }

  private labelMatches(tag: string | undefined, st: RideStation) {
    if (!tag) return false;
    const pl = st.place;
    if (tag === pl) return true;
    if (tag === "reg") return pl === "core" || pl === "reg";
    if (tag === "l1") return pl === "fill";
    if (tag.startsWith("floor")) return st.cue.kind === "pt" && tag === `floor${st.cue.floor}`;
    return false;
  }

  /** 画面里的标签：投影到观察窗口，固定字号；落在安全区外、压住焦点或彼此相交的次要标签隐藏 */
  private layoutLabels(cam: THREE.Camera, world: World, st: RideStation | undefined) {
    const host = this.labelHost();
    const list: SceneLabel[] = world === "chip" ? this.chip.labels : world === "mem" ? this.mem.labels : [];
    const shown: { text: string; rect: Rect }[] = [];
    if (host) {
      for (const [lab, e] of this.labelEls) if (!list.includes(lab) && e.on) {
        e.el.style.visibility = "hidden";
        e.on = false;
      }
      const camPos = cam.getWorldPosition(new THREE.Vector3());
      const cands: { lab: SceneLabel; pri: number; x: number; y: number }[] = [];
      for (const lab of list) {
        if (lab.hidden || !lab.text || this.view === "map") continue;
        const d = lab.pos.distanceTo(camPos);
        if (d > 30) continue;
        const v = this.toView(cam, lab.pos);
        if (!v) continue;
        cands.push({ lab, pri: (st && this.labelMatches(lab.tag, st) ? 0 : 100) + d, x: v.x, y: v.y });
      }
      cands.sort((a, b) => a.pri - b.pri);
      const taken: Rect[] = [];
      const ok = new Set<SceneLabel>();
      for (const c of cands) {
        let e = this.labelEls.get(c.lab);
        if (!e) {
          const el = document.createElement("span");
          el.className = "rd-lab";
          host.appendChild(el);
          e = { el, w: 0, h: 0, t: "", on: false };
          this.labelEls.set(c.lab, e);
        }
        if (e.t !== c.lab.text) {
          e.el.textContent = c.lab.text;
          e.el.style.setProperty("--c", c.lab.color);
          e.t = c.lab.text;
          e.w = e.el.offsetWidth;
          e.h = e.el.offsetHeight;
        }
        const r: Rect = { x: c.x - e.w / 2, y: c.y - e.h / 2, w: e.w, h: e.h };
        if (!inside(r, this.safe)) continue;
        if (this.focusRect && overlap(r, this.focusRect, 4)) continue;
        if (taken.some((t) => overlap(r, t, 4))) continue;
        taken.push(r);
        ok.add(c.lab);
        e.el.style.transform = `translate(${Math.round(r.x)}px, ${Math.round(r.y)}px)`;
        shown.push({ text: c.lab.text, rect: r });
      }
      for (const lab of list) {
        const e = this.labelEls.get(lab);
        if (!e) continue;
        const on = ok.has(lab);
        if (on !== e.on) {
          e.el.style.visibility = on ? "visible" : "hidden";
          e.on = on;
        }
      }
    }
    this.shownLabels = shown;
  }

  private clearLabels() {
    for (const e of this.labelEls.values()) e.el.remove();
    this.labelEls.clear();
    this.shownLabels = [];
  }

  /** 只画观察窗口：整块画布先清成底色，再在观察窗口里画场景；有焦点时压暗背景、焦点全亮再画一遍 */
  private draw(scene: THREE.Scene, cam: THREE.Camera, focusPass: boolean) {
    const r = this.host.renderer;
    const el = r.domElement;
    const W = el.clientWidth;
    const H = el.clientHeight;
    const v = this.vp;
    const prevColor = r.getClearColor(new THREE.Color());
    const prevAlpha = r.getClearAlpha();
    r.setScissorTest(true);
    r.setViewport(0, 0, W, H);
    r.setScissor(0, 0, W, H);
    r.setClearColor(C.bg, 1);
    r.clear();
    r.setClearColor(prevColor, prevAlpha);
    const y = H - v.y - v.h;
    r.setViewport(v.x, y, v.w, v.h);
    r.setScissor(v.x, y, v.w, v.h);
    r.render(scene, cam);
    if (focusPass && this.dimK > 0.01 && this.focus) {
      const auto = r.autoClear;
      r.autoClear = false;
      this.dimMat.opacity = 0.6 * this.dimK;
      r.render(this.dimScene, this.dimCam);
      r.clearDepth();
      const bg = scene.background;
      scene.background = null;
      cam.layers.set(1);
      r.render(scene, cam);
      cam.layers.set(0);
      scene.background = bg;
      r.autoClear = auto;
    }
    r.setScissorTest(false);
    r.setViewport(0, 0, W, H);
  }

  /** 测试构建的检查接口：当前站焦点、标签、观察窗口在页面上的位置 */
  // 生产构建里 __RIDE_AUDIT__ 为 false，整段函数被删除
  readonly probe: (() => RideProbe) | undefined = __RIDE_AUDIT__
    ? (): RideProbe => {
    const cr = this.host.renderer.domElement.getBoundingClientRect();
    const off = (r: Rect, base: { x: number; y: number }): Rect => ({ x: r.x + base.x, y: r.y + base.y, w: r.w, h: r.h });
    const vb = { x: cr.left + this.vp.x, y: cr.top + this.vp.y };
    const i = this.idxOf(this.s);
    const arrived = this.s >= i + 1 - 1e-6;
    let minFont: number | null = null;
    const cam = this.lastCam;
    if (cam && this.focus?.font) {
      const a = this.toView(cam, this.focus.font.at);
      const b = this.toView(cam, this.focus.font.at.clone().add(new THREE.Vector3(0, this.focus.font.size, 0)));
      if (a && b) minFont = Math.hypot(b.x - a.x, b.y - a.y);
    }
    const needFocus = this.view === "first" && this.worldOf(i) !== "pc";
    const settled = arrived && performance.now() - this.layoutAt > 600 && !this.reframe && (needFocus ? !!this.focus && this.focusIdx === i : !this.focus) && (!this.focus || (this.focusKey !== "" && this.frameK >= 0.999 && cam !== null && cam.position.distanceTo(this.frameP) < 1e-3 && this.q.angleTo(this.frameQ) < 0.002));
    return {
      station: i,
      arrived,
      settled,
      world: this.lastWorld,
      compact: this.compact && this.chip.isCompact && this.mem.isCompact,
      view: off(this.vp, { x: cr.left, y: cr.top }),
      safe: off(this.safe, vb),
      focus: this.focusRect ? off(this.focusRect, vb) : null,
      minFontPx: minFont,
      labels: this.shownLabels.map((l) => ({ text: l.text, rect: off(l.rect, vb) })),
      occluded: this.occluded,
      faded: this.faded.length,
      dim: this.dimK,
    };
  }
    : undefined;

  // ---------------------------------------------------------------- frame
  private frame: RideFrame = (dt, time) => {
    if (!this.alive || !this.plan || !this.paths.length) return null;
    const now = performance.now();
    const host = this.host;
    const aspect = Math.max(0.2, this.vp.w / Math.max(1, this.vp.h));

    // 俯冲进 CPU
    if (this.intro) {
      const k = clamp((now - this.intro.t0) / 1800, 0, 1);
      const e = ease(k);
      const cam = host.camera;
      cam.near = 0.0008;
      cam.far = 6;
      cam.fov = 32 + 20 * e;
      cam.aspect = aspect;
      if (cam.view?.enabled) cam.clearViewOffset();
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
      this.layoutLabels(cam, "pc", undefined);
      return { scene: host.scene, camera: cam, render: () => this.draw(host.scene, cam, false) };
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
    const stationWorld = this.worldOf(i);
    if (stationWorld === "chip") done = this.chip.apply(st, k, rev, time);
    else if (stationWorld === "mem") done = this.mem.apply(st, k, rev, time);
    else done = k > 0.6;
    for (const f of this.faded) (f.mat as THREE.Material & { opacity: number }).opacity = f.o * 0.15;
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
    this.lastWorld = p.world;
    host.focusLink(p.world === "pc" || this.view === "map" ? "membus" : null);
    if (now - this.lastPos > 90) {
      this.lastPos = now;
      this.cb.onPos(p.world, i, p.pcU);
    }

    // 镜头
    if (this.view === "map") {
      if (this.focusIdx !== -1) this.setFocus(-1, null);
      this.focusRect = null;
      return this.frameMap(p, st, aspect, time);
    }
    const cam = p.world === "pc" ? host.camera : this.icam;
    const pc = p.world === "pc";
    if (pc) {
      cam.near = 0.0006;
      cam.far = 6;
    } else {
      cam.near = 0.05;
      cam.far = 160;
    }
    const vfov = clamp((2 * Math.atan(Math.tan((34 * Math.PI) / 180) / aspect) * 180) / Math.PI, pc ? 64 : 58, 96);
    cam.fov = vfov;
    cam.aspect = aspect;
    if (cam.view?.enabled) cam.clearViewOffset();
    cam.updateProjectionMatrix();
    // 手动游走时学生转过的头不强制回正；自动巡航时松手后慢慢回正
    if (this.mode === "auto" && !this.lookHeld && now - this.lookRelease > 1200) {
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

    // 到站取景：只在停下时算一次，飞行途中沿曲线前进
    const canFrame = this.view === "first" && !pc;
    if (canFrame && arrived) {
      const key = `${i}|${Math.round(this.vp.w)}x${Math.round(this.vp.h)}|${Math.round(this.safe.x)},${Math.round(this.safe.y)},${Math.round(this.safe.w)},${Math.round(this.safe.h)}|${this.compact}|${st.id}|${this.plan.routeId}`;
      if (key !== this.focusKey) {
        this.focusKey = key;
        this.frameStation(i, st, vfov);
      }
    } else if ((!arrived || !canFrame) && this.focusIdx !== -1 && this.frameK < 0.02) {
      this.setFocus(-1, null);
      this.focusKey = "";
    }
    const want = canFrame && arrived && this.hasFrame && this.focusIdx === i ? 1 : 0;
    if (this.snapFrame || this.reduced) this.frameK = want;
    else this.frameK = clamp(this.frameK + (want ? 1 : -1) * (dt / FRAME_T), 0, 1);
    this.snapFrame = false;
    if (this.frameK > 0 && this.hasFrame) {
      const e = ease(this.frameK);
      let fp = this.frameP;
      let fq = this.frameQ;
      if (this.reframe) {
        const r = clamp((now - this.reframe.t0) / 500, 0, 1);
        if (r >= 1) this.reframe = null;
        else {
          fp = this.reframe.p.clone().lerp(this.frameP, ease(r));
          fq = this.reframe.q.clone().slerp(this.frameQ, ease(r));
        }
      }
      eye.lerp(fp, e);
      target.slerp(fq, e);
    }
    const dimWant = want && this.focus ? 1 : 0;
    this.dimK = this.reduced ? dimWant : clamp(this.dimK + (dimWant ? 1 : -1) * dt * 2.5, 0, 1);

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
    cam.updateMatrixWorld(true);
    this.lastCam = cam;
    if (this.tunnel) {
      this.tunnel.visible = pc;
      this.tunnel.material.uniforms.uTime!.value = time;
      this.tunnel.material.uniforms.uMove!.value = this.reduced ? 0 : 1;
    }
    this.mapOrb.visible = false;
    this.focusRect = this.focus && this.focusIdx === i && !pc ? this.rectOf(cam, this.focus.pts ?? this.boxCorners(this.focus.box)) : null;
    this.layoutLabels(cam, p.world, st);
    const scene = pc ? host.scene : p.world === "mem" ? this.mem.scene : this.chip.scene;
    return { scene, camera: cam, render: () => this.draw(scene, cam, !pc) };
  };

  private frameMap(p: Pose, st: RideStation, aspect: number, time: number) {
    const host = this.host;
    const ov = host.overview();
    const cam = this.mapCam;
    cam.aspect = aspect;
    cam.fov = aspect < 0.8 ? 52 : 34;
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
    this.lastCam = cam;
    this.layoutLabels(cam, "pc", undefined);
    return { scene: host.scene, camera: cam, render: () => this.draw(host.scene, cam, false) };
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
    this.clearLabels();
    this.dimMat.dispose();
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
