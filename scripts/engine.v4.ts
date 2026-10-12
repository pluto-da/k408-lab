// 整机拆解 3D 场景。只负责场景与交互，界面文字在 React 侧。
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import manifestJson from "./manifest.json";
import { LINKS, PART_BY_ID, PARTS, type LinkDef, type PartId } from "./parts";
import { JOURNEY } from "./journey";
import { LOOK, TextureBank, buildGlass, buildStudioEnv, makeMaterial, type MatDef } from "./look";

type Vec3 = [number, number, number];
interface PartMeta {
  tris: number;
  bytes: number;
  origin: Vec3;
  bbox: [Vec3, Vec3];
  anchors: Record<string, Vec3>;
}
interface Manifest {
  exterior: Record<string, PartMeta>;
  interior: Record<string, PartMeta>;
  materials: Record<string, MatDef>;
  textures: Record<string, number>;
}
const manifest = manifestJson as unknown as Manifest;

const assetUrls = import.meta.glob("./assets/*.{glb,webp}", { query: "?url", import: "default", eager: true }) as Record<string, string>;
const urlOf = (file: string): string => {
  const u = assetUrls[`./assets/${file}`];
  if (!u) throw new Error(`missing asset ${file}`);
  return u;
};

/**
 * The board interior is modelled lying flat (thin along y); in the case it stands upright (thin along x):
 * case = R · interior with x' = -y, y' = -z, z' = x.
 */
const INTERIOR_ROT: Partial<Record<PartId, THREE.Matrix4>> = {
  board: new THREE.Matrix4().set(0, -1, 0, 0, 0, 0, -1, 0, 1, 0, 0, 0, 0, 0, 0, 1),
};

/** 爆炸视图：每个部件沿自己的方向拉开（米，k = 1 时） */
const EXPLODE_VIEW: Partial<Record<PartId, Vec3>> = {
  board: [-0.05, 0, 0],
  cpu: [-0.2, 0.07, 0.0],
  ram: [-0.16, 0.05, -0.04],
  ssd: [-0.13, 0.0, 0.05],
  gpu: [-0.27, -0.02, 0.02],
  nic: [-0.24, -0.07, 0.02],
  hdd: [-0.2, 0.0, -0.16],
  psu: [-0.22, 0.0, 0.1],
};

export type EngineState = "loading" | "intro" | "overview" | "extracting" | "open" | "closing" | "journey";
export type LightMode = "studio" | "rgb";

export interface EngineCallbacks {
  onProgress?: (p: number) => void;
  onReady?: () => void;
  onState?: (s: EngineState, part: PartId | null) => void;
  onHover?: (part: PartId | null) => void;
  onInteriorProgress?: (p: number | null) => void;
  onError?: (msg: string) => void;
  onJourney?: (step: number | null) => void;
}

const CENTER = new THREE.Vector3(0, 0.25, 0);
const OVERVIEW_DIR = new THREE.Vector3(-1.0, 0.42, 0.95).normalize();
const MOUNTED: PartId[] = ["cpu", "ram", "ssd", "gpu", "nic"];
const GLASS_X = -0.1062;

const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
const easeInOutSine = (t: number) => -(Math.cos(Math.PI * t) - 1) / 2;

interface Tween {
  t0: number;
  dur: number;
  fn: (k: number) => void;
  ease: (t: number) => number;
  done?: () => void;
  key?: string;
}

interface Model {
  root: THREE.Object3D;
  mats: THREE.MeshPhysicalMaterial[];
  hover: { value: number };
}

interface PartRT {
  id: PartId;
  meta: PartMeta;
  group: THREE.Group;
  model: Model | null;
  proxy: THREE.Mesh;
  base: THREE.Vector3;
  opacity: number;
  center: THREE.Vector3; // local bbox centre
  radius: number;
  interior?: { group: THREE.Group; model: Model; meta: PartMeta; opacity: number };
  interiorPromise?: Promise<void>;
}

interface LinkRT {
  def: LinkDef;
  core: THREE.Mesh;
  halo: THREE.Mesh;
  dots: THREE.Points;
  curve: THREE.CatmullRomCurve3 | null;
  mat: THREE.ShaderMaterial;
  haloMat: THREE.ShaderMaterial;
  dotMat: THREE.ShaderMaterial;
  vis: number; // 0..1 current
  label: HTMLDivElement;
  length: number;
}

async function fetchBytes(url: string, onBytes: (n: number) => void, signal: AbortSignal): Promise<Uint8Array> {
  const res = await fetch(url, { signal });
  if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let n = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    n += value.length;
    onBytes(value.length);
  }
  const out = new Uint8Array(n);
  let o = 0;
  for (const c of chunks) {
    out.set(c, o);
    o += c.length;
  }
  return out;
}

function withTimeout<T>(p: Promise<T>, ms: number, what: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`${what} timeout`)), ms);
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e: unknown) => {
        clearTimeout(t);
        reject(e instanceof Error ? e : new Error(String(e)));
      },
    );
  });
}

function v3(a: Vec3) {
  return new THREE.Vector3(a[0], a[1], a[2]);
}

export function webglAvailable(): boolean {
  try {
    const c = document.createElement("canvas");
    return !!c.getContext("webgl2");
  } catch {
    return false;
  }
}

const LINE_VS = /* glsl */ `
  varying vec2 vUv; varying vec3 vN; varying vec3 vV;
  void main(){ vUv = uv; vec4 mv = modelViewMatrix * vec4(position,1.0); vN = normalize(normalMatrix*normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix*mv; }`;
const LINE_FS = /* glsl */ `
  uniform vec3 uColor; uniform float uTime; uniform float uOpacity; uniform float uReveal; uniform float uLen; uniform float uBidir; uniform float uHalo;
  varying vec2 vUv; varying vec3 vN; varying vec3 vV;
  void main(){
    if (vUv.x > uReveal) discard;
    float edge = abs(dot(normalize(vN), normalize(vV)));
    float d = vUv.x * uLen / 0.035;
    float p1 = fract(d - uTime * 1.6);
    float pulse = smoothstep(0.0, 0.12, p1) * (1.0 - smoothstep(0.12, 0.55, p1));
    if (uBidir > 0.5) { float p2 = fract(d * 0.83 + uTime * 1.3 + 0.37); pulse = max(pulse, 0.8 * smoothstep(0.0, 0.1, p2) * (1.0 - smoothstep(0.1, 0.45, p2))); }
    float tip = smoothstep(uReveal - 0.04, uReveal, vUv.x) * step(uReveal, 0.999);
    float a;
    vec3 c;
    if (uHalo > 0.5) { a = pow(edge, 2.2) * (0.16 + 0.22 * pulse); c = uColor; }
    else { a = (0.35 + 0.65 * pow(edge, 0.8)) * (0.55 + 0.9 * pulse) + tip; c = mix(uColor, vec3(1.0), 0.35 * pulse + 0.4 * pow(edge, 4.0)); }
    gl_FragColor = vec4(c * a * uOpacity, 1.0);
  }`;
const DOT_VS = /* glsl */ `
  uniform float uSize; uniform float uPx;
  void main(){ vec4 mv = modelViewMatrix*vec4(position,1.0); gl_Position = projectionMatrix*mv; gl_PointSize = uSize * uPx / -mv.z; }`;
const DOT_FS = /* glsl */ `
  uniform vec3 uColor; uniform float uOpacity;
  void main(){ vec2 q = gl_PointCoord*2.0-1.0; float r = dot(q,q); if (r>1.0) discard; float a = exp(-r*4.0); gl_FragColor = vec4(mix(uColor, vec3(1.0), a*0.7) * a * uOpacity, 1.0); }`;

const PACKET_VS = /* glsl */ `
  uniform float uPx; attribute float aSize; attribute float aAlpha; varying float vA;
  void main(){ vec4 mv = modelViewMatrix*vec4(position,1.0); gl_Position = projectionMatrix*mv; gl_PointSize = aSize * uPx / -mv.z; vA = aAlpha; }`;
const PACKET_FS = /* glsl */ `
  uniform vec3 uColor; uniform float uOpacity; varying float vA;
  void main(){ vec2 q = gl_PointCoord*2.0-1.0; float r = dot(q,q); if (r>1.0) discard;
    float core = exp(-r*10.0); float glow = exp(-r*3.0)*0.55;
    gl_FragColor = vec4((uColor*glow + vec3(1.0)*core) * vA * uOpacity, 1.0); }`;

const TRAIL = 18;

export class PcEngine {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private controls: OrbitControls;
  private loader = new GLTFLoader();
  private bank: TextureBank;
  private env: THREE.Texture;
  private matCache = new Map<string, Promise<THREE.MeshPhysicalMaterial>>();
  private parts = new Map<PartId, PartRT>();
  private links: LinkRT[] = [];
  private tweens: Tween[] = [];
  private raycaster = new THREE.Raycaster();
  private glass!: ReturnType<typeof buildGlass>;
  private glassOpacity = 0;
  private glassSlide = 0;
  private key!: THREE.DirectionalLight;
  private rim!: THREE.DirectionalLight;
  private caseGlow!: THREE.PointLight;
  private composer: EffectComposer | null = null;
  private bloom: UnrealBloomPass | null = null;
  private lightMode: LightMode = "studio";
  private rgbMix = 0;
  private explodeK = 0;
  private abort = new AbortController();
  private clock = new THREE.Clock();
  private state: EngineState = "loading";
  private selected: PartId | null = null;
  private hovered: PartId | null = null;
  private highlightLink: string | null = null;
  private showAll = true;
  private inset = 0;
  private dpr = 1;
  private maxDpr = 2;
  private frameTimes: number[] = [];
  private lastDprChange = 0;
  private linksDirty = true;
  private disposed = false;
  private down: { x: number; y: number; t: number } | null = null;
  private calloutLayer: HTMLDivElement;
  private svg: SVGSVGElement;
  private callouts: { el: HTMLDivElement; line: SVGPolylineElement; dot: SVGCircleElement; anchor: THREE.Vector3; obj: THREE.Object3D }[] = [];
  private calloutVis = 0;
  private ro: ResizeObserver;
  // journey
  private packet!: THREE.Points;
  private packetMat!: THREE.ShaderMaterial;
  private packetLight!: THREE.PointLight;
  private packetCurve: THREE.CatmullRomCurve3 | null = null;
  private packetT = 0;
  private packetPulse = 0;
  private packetHistory: THREE.Vector3[] = [];
  private journeyStep = -1;
  private journeyTimer: ReturnType<typeof setTimeout> | null = null;
  private journeyBadge: HTMLDivElement;
  /** lightweight counters for diagnostics (window.__pcStats) */
  readonly stats = { frames: 0, dt: 0, dpr: 1 };

  constructor(
    private container: HTMLElement,
    private overlay: HTMLElement,
    private cb: EngineCallbacks = {},
  ) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: "high-performance" });
    this.maxDpr = Math.min(window.devicePixelRatio || 1, 2);
    // ?dpr=1 caps the pixel ratio (used by automated screenshots / very slow devices)
    const forced = Number(new URLSearchParams(window.location.search).get("dpr"));
    if (forced > 0) this.maxDpr = Math.min(this.maxDpr, forced);
    this.dpr = Math.min(this.maxDpr, 1.5);
    this.renderer.setPixelRatio(this.dpr);
    this.renderer.setClearColor(0x090a0d, 1);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.AgXToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    container.appendChild(this.renderer.domElement);
    this.renderer.domElement.className = "pc-canvas";
    this.loader.setMeshoptDecoder(MeshoptDecoder);
    this.bank = new TextureBank((n) => urlOf(`${n}.webp`), Math.min(8, this.renderer.capabilities.getMaxAnisotropy()));
    this.env = buildStudioEnv(this.renderer);
    this.scene.environment = this.env;

    this.camera = new THREE.PerspectiveCamera(32, 1, 0.004, 20);
    this.camera.position.copy(CENTER).addScaledVector(OVERVIEW_DIR, 1.3);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.target.copy(CENTER);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.rotateSpeed = 0.75;
    this.controls.zoomSpeed = 0.9;
    this.controls.minDistance = 0.05;
    this.controls.maxDistance = 2.2;
    this.controls.maxPolarAngle = Math.PI * 0.52;
    this.controls.screenSpacePanning = true;
    this.controls.enabled = false;

    this.buildStage();

    this.calloutLayer = document.createElement("div");
    this.calloutLayer.className = "pc-callouts";
    this.svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    this.svg.setAttribute("class", "pc-leaders");
    this.journeyBadge = document.createElement("div");
    this.journeyBadge.className = "pc-jbadge";
    overlay.appendChild(this.svg);
    overlay.appendChild(this.calloutLayer);
    overlay.appendChild(this.journeyBadge);

    const el = this.renderer.domElement;
    el.addEventListener("pointerdown", this.onDown);
    el.addEventListener("pointerup", this.onUp);
    el.addEventListener("pointermove", this.onMove);
    el.addEventListener("pointerleave", this.onLeave);
    this.controls.addEventListener("start", this.onControlStart);
    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(container);
    this.resize();
    this.renderer.setAnimationLoop(this.frame);
    (window as unknown as { __pcStats?: unknown }).__pcStats = this.stats;
    if (import.meta.env.DEV || new URLSearchParams(window.location.search).has("debug")) (window as unknown as { __pc?: unknown }).__pc = this;
  }

  // ---------------------------------------------------------------- public
  async load(): Promise<void> {
    const names = Object.keys(manifest.exterior) as PartId[];
    const total = names.reduce((s, n) => s + (manifest.exterior[n]?.bytes ?? 0), 0);
    let got = 0;
    const report = () => this.cb.onProgress?.(Math.min(0.97, (got / total) * 0.9));
    try {
      await Promise.all(
        names.map(async (id) => {
          const bytes = await fetchBytes(urlOf(`${id}.glb`), (n) => {
            got += n;
            report();
          }, this.abort.signal);
          if (this.disposed) return;
          const model = await withTimeout(this.buildModel(bytes, id), 60_000, id);
          if (this.disposed) return;
          const p = this.parts.get(id)!;
          p.model = model;
          this.setModelOpacity(model, 0);
          p.group.add(model.root);
        }),
      );
    } catch (e) {
      if (!this.disposed) this.cb.onError?.(e instanceof Error ? e.message : String(e));
      return;
    }
    if (this.disposed) return;
    // upload everything once before the intro so the first frames do not stutter
    try {
      await this.renderer.compileAsync(this.scene, this.camera);
    } catch {
      /* compile lazily on first draw instead */
    }
    if (this.disposed) return;
    this.cb.onProgress?.(1);
    this.cb.onReady?.();
    this.intro();
  }

  select(id: PartId | null) {
    if (this.state === "loading" || this.state === "journey") return;
    if (id === this.selected) return;
    if (id === null) return this.back();
    if (this.selected) {
      this.back(() => this.select(id));
      return;
    }
    if (this.explodeK > 0) {
      this.setExplode(0, 0.6);
      setTimeout(() => void this.open(id), 620);
      return;
    }
    void this.open(id);
  }

  back(after?: () => void) {
    const id = this.selected;
    if (!id) return after?.();
    this.setState("closing", id);
    this.clearCallouts();
    const p = this.parts.get(id)!;
    const dur = 0.9;
    if (p.interior) {
      const it = p.interior;
      this.tween(0.45, (k) => {
        it.opacity = 1 - k;
        this.setModelOpacity(it.model, it.opacity);
        it.group.scale.setScalar(1 - 0.08 * k);
      }, undefined, easeOut, "interior");
    }
    const carry = id === "board" ? MOUNTED : [];
    for (const q of this.parts.values()) this.fadePart(q, 1, 0.8);
    this.slide(id, 0, dur);
    for (const c of carry) this.slide(c, 0, dur, id);
    this.glassTo(1, 0, dur);
    this.flyTo(CENTER, OVERVIEW_DIR, this.overviewDistance(), 1.1, () => {
      if (p.interior) p.interior.group.visible = false;
      this.selected = null;
      this.setState("overview", null);
      after?.();
    });
  }

  setShowAll(v: boolean) {
    this.showAll = v;
  }

  setHighlightLink(id: string | null) {
    this.highlightLink = id;
  }

  /** 右侧面板占用的宽度（像素），用于让模型避开面板居中 */
  setInset(px: number) {
    this.inset = px;
    this.resize();
  }

  resetView() {
    if (this.state === "overview") this.flyTo(CENTER, OVERVIEW_DIR, this.overviewDistance() * (1 + this.explodeK * 0.25), 1.0);
    else if (this.selected) this.frameSelected(1.0);
  }

  /** 灯效：影棚（干净的产品照）或 RGB 氛围灯 */
  setLightMode(mode: LightMode, rgbMode = 0, color?: string) {
    this.lightMode = mode;
    LOOK.uRgbMode.value = rgbMode;
    if (color) LOOK.uRgbColor.value.set(color);
    if (mode === "rgb" && !this.composer) this.buildComposer();
    const from = this.rgbMix;
    const to = mode === "rgb" ? 1 : 0;
    this.tween(0.9, (k) => (this.rgbMix = from + (to - from) * k), undefined, ease, "light");
  }

  /** 爆炸视图：0 = 组装好，1 = 全部拉开 */
  setExplode(k: number, dur = 0) {
    if (this.state !== "overview" && this.state !== "intro") return;
    const from = this.explodeK;
    const apply = (t: number) => {
      this.explodeK = from + (k - from) * t;
      for (const p of this.parts.values()) {
        const off = EXPLODE_VIEW[p.id];
        if (!off) continue;
        p.group.position.copy(p.base).add(new THREE.Vector3(...off).multiplyScalar(this.explodeK));
      }
      this.glassSlide = Math.min(1, this.explodeK * 1.6);
      this.linksDirty = true;
    };
    if (dur > 0) this.tween(dur, apply, undefined, ease, "explode");
    else apply(1);
  }

  /** 「一次数据的旅程」：从第 i 步开始自动播放 */
  startJourney(i = 0) {
    if (this.state === "loading" || this.state === "intro") return;
    const go = () => {
      if (this.explodeK > 0) this.setExplode(0, 0.6);
      this.setState("journey", null);
      this.controls.enabled = true;
      this.journeyGo(i);
    };
    if (this.selected) this.back(go);
    else go();
  }

  journeyGo(i: number) {
    if (this.state !== "journey") return;
    if (this.journeyTimer) clearTimeout(this.journeyTimer);
    if (i < 0) i = 0;
    if (i >= JOURNEY.length) return this.stopJourney();
    this.journeyStep = i;
    this.cb.onJourney?.(i);
    const step = JOURNEY[i]!;
    const pts = step.path.map(([part, key]) => this.worldAnchor(part, key)).filter((v): v is THREE.Vector3 => !!v);
    if (!pts.length) return;
    this.highlightLink = step.link ?? "__none";
    this.glassTo(0.06, 0, 0.8); // 旅程中玻璃几乎淡出，免得反光挡住数据包
    const box = new THREE.Box3().setFromPoints(pts);
    const c = box.getCenter(new THREE.Vector3());
    const r = Math.max(0.05, box.getSize(new THREE.Vector3()).length() / 2);
    // the caption card covers the lower third: aim a little below the path so it sits in the upper part of the view
    const dist = this.fitDistance(Math.max(r * 1.35, 0.36 * step.zoom));
    const aim = c.clone().add(new THREE.Vector3(0, -dist * 0.12, 0));
    this.flyTo(aim, new THREE.Vector3(...step.view).normalize(), dist, 1.5);
    const color = new THREE.Color(step.color);
    this.packetMat.uniforms.uColor!.value = color;
    this.packetLight.color.copy(color);
    this.journeyBadge.style.setProperty("--c", step.color);
    this.journeyBadge.textContent = step.badge ?? "";
    this.journeyBadge.dataset.on = "0";
    if (pts.length > 1) {
      const path = pts.map((p) => p.clone().add(new THREE.Vector3(-0.012, 0, 0)));
      this.packetCurve = new THREE.CatmullRomCurve3(path, false, "centripetal", 0.5);
    } else {
      this.packetCurve = new THREE.CatmullRomCurve3([pts[0]!.clone().add(new THREE.Vector3(-0.012, 0, 0)), pts[0]!.clone().add(new THREE.Vector3(-0.0121, 0, 0))]);
    }
    this.packetHistory = [];
    this.packetT = 0;
    this.packetPulse = 0;
    const single = pts.length === 1;
    setTimeout(() => {
      if (this.state !== "journey" || this.journeyStep !== i) return;
      this.tween(single ? 0.6 : step.dur * 0.7, (k) => (this.packetT = k), () => {
        this.journeyBadge.dataset.on = step.badge ? "1" : "0";
        if (single || step.badge) this.tween(1.6, (k) => (this.packetPulse = k), undefined, (t) => t, "pulse");
      }, easeInOutSine, "packet");
    }, 900);
    this.journeyTimer = setTimeout(() => this.journeyGo(i + 1), (step.dur + 1.9) * 1000);
  }

  stopJourney() {
    if (this.journeyTimer) clearTimeout(this.journeyTimer);
    this.journeyTimer = null;
    if (this.state !== "journey") return;
    this.journeyStep = -1;
    this.packetCurve = null;
    this.highlightLink = null;
    this.journeyBadge.dataset.on = "0";
    this.glassTo(1, 0, 0.8);
    this.cb.onJourney?.(null);
    this.flyTo(CENTER, OVERVIEW_DIR, this.overviewDistance(), 1.4, () => this.setState("overview", null));
  }

  pauseJourney() {
    if (this.journeyTimer) clearTimeout(this.journeyTimer);
    this.journeyTimer = null;
  }

  dispose() {
    this.disposed = true;
    this.abort.abort();
    if (this.journeyTimer) clearTimeout(this.journeyTimer);
    this.renderer.setAnimationLoop(null);
    this.ro.disconnect();
    const el = this.renderer.domElement;
    el.removeEventListener("pointerdown", this.onDown);
    el.removeEventListener("pointerup", this.onUp);
    el.removeEventListener("pointermove", this.onMove);
    el.removeEventListener("pointerleave", this.onLeave);
    this.controls.removeEventListener("start", this.onControlStart);
    this.controls.dispose();
    this.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.geometry) m.geometry.dispose();
      const mat = m.material as THREE.Material | THREE.Material[] | undefined;
      if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
      else if (mat && "dispose" in mat) mat.dispose();
    });
    this.bank.dispose();
    this.env.dispose();
    this.composer?.dispose();
    this.bloom?.dispose();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    el.remove();
    this.svg.remove();
    this.calloutLayer.remove();
    this.journeyBadge.remove();
  }

  // ---------------------------------------------------------------- models
  private material(name: string): Promise<THREE.MeshPhysicalMaterial> {
    let p = this.matCache.get(name);
    if (!p) {
      p = makeMaterial(name, manifest.materials[name], this.bank, { value: 0 });
      this.matCache.set(name, p);
    }
    return p;
  }

  /** Parses a packed GLB and swaps every material for this part's own copy of the studio material. */
  private async buildModel(bytes: Uint8Array, label: string): Promise<Model> {
    const buf = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
    const gltf = await this.loader.parseAsync(buf, "");
    const hover = { value: 0 };
    const own = new Map<string, THREE.MeshPhysicalMaterial>();
    const meshes: THREE.Mesh[] = [];
    gltf.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) meshes.push(m);
    });
    for (const m of meshes) {
      const src = m.material as THREE.Material;
      const name = src.name || "_default";
      let mat = own.get(name);
      if (!mat) {
        const base = await this.material(name);
        mat = base.clone();
        mat.onBeforeCompile = base.onBeforeCompile;
        mat.customProgramCacheKey = base.customProgramCacheKey;
        // the clone keeps the shared look uniforms but gets this part's hover uniform
        const ob = base.onBeforeCompile;
        mat.onBeforeCompile = (sh, r) => {
          ob.call(mat, sh, r);
          sh.uniforms.uHover = hover;
        };
        own.set(name, mat);
      }
      src.dispose();
      m.material = mat;
      const g = m.geometry;
      if (!g.getAttribute("color")) {
        const n = g.getAttribute("position").count;
        g.setAttribute("color", new THREE.BufferAttribute(new Float32Array(n * 4).fill(1), 4));
      }
      m.frustumCulled = true;
    }
    gltf.scene.name = label;
    return { root: gltf.scene, mats: [...own.values()], hover };
  }

  private setModelOpacity(model: Model, o: number) {
    for (const m of model.mats) {
      const t = o < 0.999;
      if (m.transparent !== t) {
        m.transparent = t;
        m.needsUpdate = true;
      }
      m.opacity = o;
      m.depthWrite = o > 0.55;
    }
    model.root.visible = o > 0.01;
  }

  // ---------------------------------------------------------------- scene setup
  private buildStage() {
    this.scene.background = new THREE.Color(0x090a0d);
    // the floor fades into the backdrop colour, so there is no visible horizon
    // seamless studio floor: soft pool of light + contact shadow under the case
    const floorMat = new THREE.ShaderMaterial({
      uniforms: { uRgb: LOOK.uRgb, uTint: { value: LOOK.uRgbColor.value }, uTime: LOOK.uTime },
      vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
      fragmentShader: `varying vec2 vUv; uniform float uRgb; uniform vec3 uTint; uniform float uTime;
        void main(){ vec2 q = (vUv*2.0-1.0)*1.5; float r = length(q*vec2(1.0,1.15));
        float pool = 1.0 - smoothstep(0.0, 1.05, r);
        vec3 base = mix(vec3(0.0027,0.0030,0.0040), vec3(0.15,0.155,0.165), pow(pool, 2.2));
        float sx = q.x/0.135, sz = q.y/0.29;
        float contact = exp(-pow(max(abs(sx),abs(sz)*0.95),6.0)*1.2);
        float soft = exp(-(sx*sx*0.55 + sz*sz*0.55));
        float sh = 1.0 - 0.92*contact - 0.35*soft;
        vec3 glow = uTint * exp(-(sx*sx + sz*sz)*0.5) * 0.10 * uRgb;
        gl_FragColor = vec4(base*clamp(sh,0.0,1.0) + glow, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        }`,
    });
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(3, 3), floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.0004;
    floor.renderOrder = -10;
    this.scene.add(floor);

    // direct lights complement the studio environment: warm key + cool rim
    this.key = new THREE.DirectionalLight(0xfff4e8, 1.6);
    this.key.position.set(-1.2, 1.8, 1.3);
    this.rim = new THREE.DirectionalLight(0xdfe9ff, 0.9);
    this.rim.position.set(0.8, 1.0, -1.6);
    this.caseGlow = new THREE.PointLight(0x7a5cff, 0, 0.6, 1.6);
    this.caseGlow.position.set(-0.03, 0.27, 0.0);
    this.scene.add(this.key, this.rim, this.caseGlow);

    // parts: groups + pick proxies
    for (const def of PARTS) {
      const meta = manifest.exterior[def.id];
      if (!meta) continue;
      const group = new THREE.Group();
      group.position.copy(v3(meta.origin));
      this.scene.add(group);
      const lo = v3(meta.bbox[0]);
      const hi = v3(meta.bbox[1]);
      const size = hi.clone().sub(lo);
      const center = lo.clone().add(hi).multiplyScalar(0.5);
      const proxy = new THREE.Mesh(new THREE.BoxGeometry(size.x, size.y, size.z), new THREE.MeshBasicMaterial());
      proxy.position.copy(center);
      proxy.visible = false;
      proxy.userData.part = def.id;
      group.add(proxy);
      this.parts.set(def.id, { id: def.id, meta, group, model: null, proxy, base: group.position.clone(), opacity: 0, center, radius: size.length() / 2 });
    }
    // tempered glass side panel
    this.glass = buildGlass(0.43, 0.452, this.env);
    this.glass.group.rotation.y = -Math.PI / 2;
    this.glass.group.position.set(GLASS_X, 0.25, -0.006);
    this.glass.setOpacity(0);
    this.scene.add(this.glass.group);

    // data packet for the journey
    const pg = new THREE.BufferGeometry();
    pg.setAttribute("position", new THREE.BufferAttribute(new Float32Array(TRAIL * 3), 3));
    const sizes = new Float32Array(TRAIL);
    const alphas = new Float32Array(TRAIL);
    for (let i = 0; i < TRAIL; i++) {
      sizes[i] = i === 0 ? 0.022 : 0.012 * (1 - i / TRAIL) + 0.002;
      alphas[i] = i === 0 ? 1 : 0.7 * (1 - i / TRAIL);
    }
    pg.setAttribute("aSize", new THREE.BufferAttribute(sizes, 1));
    pg.setAttribute("aAlpha", new THREE.BufferAttribute(alphas, 1));
    this.packetMat = new THREE.ShaderMaterial({
      uniforms: { uColor: { value: new THREE.Color(1, 1, 1) }, uOpacity: { value: 0 }, uPx: { value: 1000 } },
      vertexShader: PACKET_VS,
      fragmentShader: PACKET_FS,
      transparent: true,
      depthWrite: false,
      depthTest: false,
      blending: THREE.AdditiveBlending,
    });
    this.packet = new THREE.Points(pg, this.packetMat);
    this.packet.frustumCulled = false;
    this.packet.renderOrder = 1003;
    this.packetLight = new THREE.PointLight(0xffffff, 0, 0.12, 1.5);
    this.scene.add(this.packet, this.packetLight);

    // connection lines
    const pxScale = () => this.renderer.domElement.height / (2 * Math.tan((this.camera.fov * Math.PI) / 360));
    for (const def of LINKS) {
      const color = new THREE.Color(def.color);
      const mk = (halo: boolean) =>
        new THREE.ShaderMaterial({
          uniforms: {
            uColor: { value: color },
            uTime: { value: 0 },
            uOpacity: { value: 0 },
            uReveal: { value: 0 },
            uLen: { value: 0.3 },
            uBidir: { value: def.bidir ? 1 : 0 },
            uHalo: { value: halo ? 1 : 0 },
          },
          vertexShader: LINE_VS,
          fragmentShader: LINE_FS,
          transparent: true,
          depthWrite: false,
          depthTest: false,
          blending: THREE.AdditiveBlending,
        });
      const mat = mk(false);
      const haloMat = mk(true);
      const core = new THREE.Mesh(new THREE.BufferGeometry(), mat);
      const halo = new THREE.Mesh(new THREE.BufferGeometry(), haloMat);
      core.renderOrder = 1001;
      halo.renderOrder = 1000;
      core.frustumCulled = halo.frustumCulled = false;
      const dotMat = new THREE.ShaderMaterial({
        uniforms: { uColor: { value: color }, uOpacity: { value: 0 }, uSize: { value: 0.006 }, uPx: { value: pxScale() } },
        vertexShader: DOT_VS,
        fragmentShader: DOT_FS,
        transparent: true,
        depthWrite: false,
        depthTest: false,
        blending: THREE.AdditiveBlending,
      });
      const n = 5;
      const dg = new THREE.BufferGeometry();
      dg.setAttribute("position", new THREE.BufferAttribute(new Float32Array(n * 3), 3));
      const dots = new THREE.Points(dg, dotMat);
      dots.renderOrder = 1002;
      dots.frustumCulled = false;
      this.scene.add(halo, core, dots);
      const label = document.createElement("div");
      label.className = "pc-linklabel";
      label.style.setProperty("--c", def.color);
      label.textContent = def.label;
      this.overlay.appendChild(label);
      this.links.push({ def, core, halo, dots, curve: null, mat, haloMat, dotMat, vis: 0, label, length: 0.3 });
    }

  }

  private buildComposer() {
    const size = this.renderer.getDrawingBufferSize(new THREE.Vector2());
    const rt = new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.HalfFloatType, samples: 4 });
    this.composer = new EffectComposer(this.renderer, rt);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(size.x / 2, size.y / 2), 0.55, 0.5, 0.92);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());
    this.resize();
  }

  private worldAnchor(part: PartId, key: string, out = new THREE.Vector3()): THREE.Vector3 | null {
    const p = this.parts.get(part);
    const a = p?.meta.anchors[key];
    if (!p || !a) return null;
    return out.set(a[0], a[1], a[2]).add(p.group.position);
  }

  private rebuildLinks() {
    for (const L of this.links) {
      const pts: THREE.Vector3[] = [];
      for (const [part, key] of L.def.points) {
        const w = this.worldAnchor(part, key);
        if (w) pts.push(w);
      }
      if (pts.length < 2) continue;
      // lift the path off the board toward the glass, add gentle midpoints
      const lift = L.def.lift ?? 0;
      const path: THREE.Vector3[] = [];
      for (let i = 0; i < pts.length; i++) {
        const p = pts[i]!.clone();
        if (i > 0 && i < pts.length - 1) p.x -= lift;
        if (i > 0) {
          const a = path[path.length - 1]!;
          const m = a.clone().lerp(p, 0.5);
          m.x -= lift * 0.9 + 0.006;
          path.push(m);
        }
        path.push(p);
      }
      const curve = new THREE.CatmullRomCurve3(path, false, "centripetal", 0.5);
      L.curve = curve;
      L.length = curve.getLength();
      const r = 0.0013;
      L.core.geometry.dispose();
      L.halo.geometry.dispose();
      const seg = Math.max(24, Math.round(L.length / 0.006));
      L.core.geometry = new THREE.TubeGeometry(curve, seg, r, 6, false);
      L.halo.geometry = new THREE.TubeGeometry(curve, seg, r * 3.2, 8, false);
      L.mat.uniforms.uLen!.value = L.length;
      L.haloMat.uniforms.uLen!.value = L.length;
    }
    this.linksDirty = false;
  }


  // ---------------------------------------------------------------- flow
  private setState(s: EngineState, part: PartId | null) {
    this.state = s;
    this.cb.onState?.(s, part);
  }

  private intro() {
    this.setState("intro", null);
    const startDir = new THREE.Vector3(0.55, 0.12, 1.0).normalize();
    this.camera.position.copy(CENTER).addScaledVector(startDir, 2.1);
    this.controls.target.copy(CENTER);
    this.camera.lookAt(CENTER);
    const order: PartId[] = ["case", "psu", "hdd", "board", "gpu", "nic", "cpu", "ram", "ssd"];
    order.forEach((id, i) => {
      const p = this.parts.get(id);
      if (!p) return;
      setTimeout(() => this.fadePart(p, 1, id === "case" ? 1.2 : 0.8), id === "case" ? 0 : 500 + i * 140);
    });
    this.glassTo(1, 0, 1.4);
    this.flyTo(CENTER, OVERVIEW_DIR, this.overviewDistance(), 3.4, () => {
      this.controls.enabled = true;
      this.setState("overview", null);
    }, ease);
    setTimeout(() => {
      if (this.disposed) return;
      this.tween(1.6, (k) => {
        for (const L of this.links) {
          L.mat.uniforms.uReveal!.value = k;
          L.haloMat.uniforms.uReveal!.value = k;
        }
      }, undefined, easeOut);
    }, 2600);
  }

  private async open(id: PartId) {
    const def = PART_BY_ID[id];
    const p = this.parts.get(id)!;
    this.selected = id;
    this.setState("extracting", id);
    const carry = id === "board" ? MOUNTED : [];
    for (const q of this.parts.values()) {
      if (q.id === id || carry.includes(q.id)) continue;
      this.fadePart(q, id === "case" ? 1 : 0.18, 0.7);
    }
    this.slide(id, 1, 0.95);
    for (const c of carry) this.slide(c, 1, 0.95, id);
    if (id === "case") {
      this.glassTo(0, 1, 0.95);
      this.flyTo(CENTER.clone(), new THREE.Vector3(...def.view).normalize(), this.overviewDistance() * 0.92, 1.1, () => {
        if (this.selected !== id) return;
        this.setState("open", id);
        this.showCallouts(id, false);
      });
      return;
    }
    this.glassTo(0, 0, 0.6);
    const exploded = p.base.clone().add(new THREE.Vector3(...def.explode));
    const center = exploded.clone().add(p.center);
    this.flyTo(center, new THREE.Vector3(...def.view).normalize(), this.fitDistance(p.radius * 1.05), 1.0);
    const wait = new Promise<void>((r) => setTimeout(r, 1000));
    try {
      await Promise.all([this.ensureInterior(id), wait]);
    } catch (e) {
      this.cb.onError?.(e instanceof Error ? e.message : String(e));
      this.cb.onInteriorProgress?.(null);
      return;
    }
    if (this.selected !== id || this.disposed) return;
    const it = p.interior!;
    const ilo = v3(it.meta.bbox[0]);
    const ihi = v3(it.meta.bbox[1]);
    const ic = ilo.clone().add(ihi).multiplyScalar(0.5).applyQuaternion(it.group.quaternion);
    it.group.position.copy(center).sub(ic);
    it.group.visible = true;
    it.opacity = 0;
    this.setModelOpacity(it.model, 0);
    it.group.scale.setScalar(0.92);
    this.fadePart(p, 0, 0.5);
    for (const c of carry) this.fadePart(this.parts.get(c)!, 0, 0.5);
    for (const q of this.parts.values()) if (q.id !== id && !carry.includes(q.id)) this.fadePart(q, 0, 0.6);
    this.tween(0.75, (k) => {
      it.opacity = k;
      this.setModelOpacity(it.model, k);
      it.group.scale.setScalar(0.92 + 0.08 * k);
    }, undefined, easeOut, "interior");
    const ir = ihi.clone().sub(ilo).length() / 2;
    this.flyTo(center, new THREE.Vector3(...def.view).normalize(), this.fitDistance(ir * 0.98), 1.1, () => {
      if (this.selected !== id) return;
      this.setState("open", id);
      this.showCallouts(id, true);
    });
  }

  private frameSelected(dur: number) {
    const id = this.selected;
    if (!id) return;
    const def = PART_BY_ID[id];
    const p = this.parts.get(id)!;
    if (id === "case") {
      this.flyTo(CENTER, new THREE.Vector3(...def.view).normalize(), this.overviewDistance() * 0.92, dur);
      return;
    }
    if (p.interior && p.interior.group.visible) {
      const lo = v3(p.interior.meta.bbox[0]);
      const hi = v3(p.interior.meta.bbox[1]);
      const c = lo.clone().add(hi).multiplyScalar(0.5).applyQuaternion(p.interior.group.quaternion).add(p.interior.group.position);
      this.flyTo(c, new THREE.Vector3(...def.view).normalize(), this.fitDistance((hi.clone().sub(lo).length() / 2) * 0.98), dur);
    }
  }

  private async ensureInterior(id: PartId) {
    const p = this.parts.get(id)!;
    if (p.interior) return;
    if (!p.interiorPromise) {
      const meta = manifest.interior[id];
      if (!meta) throw new Error(`missing interior ${id}`);
      p.interiorPromise = (async () => {
        let got = 0;
        this.cb.onInteriorProgress?.(0);
        const bytes = await fetchBytes(urlOf(`${id}_open.glb`), (n) => {
          got += n;
          this.cb.onInteriorProgress?.(Math.min(0.99, got / meta.bytes));
        }, this.abort.signal);
        const model = await withTimeout(this.buildModel(bytes, `${id}_open`), 60_000, id);
        const group = new THREE.Group();
        group.visible = false;
        const rot = INTERIOR_ROT[id];
        if (rot) group.quaternion.setFromRotationMatrix(rot);
        group.add(model.root);
        this.scene.add(group);
        group.visible = true;
        try {
          await this.renderer.compileAsync(group, this.camera, this.scene);
        } catch {
          /* compile on first draw */
        }
        group.visible = false;
        p.interior = { group, model, meta, opacity: 0 };
        this.cb.onInteriorProgress?.(null);
      })();
      p.interiorPromise.catch(() => (p.interiorPromise = undefined));
    }
    await p.interiorPromise;
  }

  // ---------------------------------------------------------------- animation helpers
  private tween(dur: number, fn: (k: number) => void, done?: () => void, e = ease, key?: string) {
    if (key) this.tweens = this.tweens.filter((t) => t.key !== key);
    this.tweens.push({ t0: performance.now(), dur: dur * 1000, fn, done, ease: e, key });
  }

  private fadePart(p: PartRT, to: number, dur: number) {
    const from = p.opacity;
    this.tween(dur, (k) => {
      p.opacity = from + (to - from) * k;
      if (p.model) this.setModelOpacity(p.model, p.opacity);
    }, undefined, ease, "fade-" + p.id);
  }

  private slide(id: PartId, to: 0 | 1, dur: number, as?: PartId) {
    const p = this.parts.get(id)!;
    const off = new THREE.Vector3(...PART_BY_ID[as ?? id].explode);
    const from = p.group.position.clone();
    const target = p.base.clone().addScaledVector(off, to);
    this.tween(dur, (k) => {
      p.group.position.lerpVectors(from, target, k);
      this.linksDirty = true;
    }, undefined, ease, "slide-" + id);
  }

  /** glass opacity + how far it is slid out (case opened / exploded view) */
  private glassTo(opacity: number, slide: number, dur: number) {
    const o0 = this.glassOpacity;
    const s0 = this.glassSlide;
    this.tween(dur, (k) => {
      this.glassOpacity = o0 + (opacity - o0) * k;
      this.glassSlide = s0 + (slide - s0) * k;
    }, undefined, ease, "glass");
  }

  private overviewDistance() {
    return this.fitDistance(0.36);
  }

  private fitDistance(radius: number) {
    const el = this.renderer.domElement;
    const w = Math.max(1, el.clientWidth - this.inset);
    const h = Math.max(1, el.clientHeight);
    const vf = (this.camera.fov * Math.PI) / 180;
    const hf = 2 * Math.atan(Math.tan(vf / 2) * (w / h));
    const f = Math.min(vf, hf);
    return radius / Math.sin(f / 2);
  }

  private flyTo(target: THREE.Vector3, dir: THREE.Vector3, dist: number, dur: number, done?: () => void, e = ease) {
    const t0 = this.controls.target.clone();
    const off0 = this.camera.position.clone().sub(t0);
    const s0 = new THREE.Spherical().setFromVector3(off0);
    const s1 = new THREE.Spherical().setFromVector3(dir.clone().multiplyScalar(dist));
    let dTheta = s1.theta - s0.theta;
    if (dTheta > Math.PI) dTheta -= Math.PI * 2;
    if (dTheta < -Math.PI) dTheta += Math.PI * 2;
    const s = new THREE.Spherical();
    const enabled = this.controls.enabled;
    this.controls.enabled = false;
    this.tween(dur, (k) => {
      this.controls.target.lerpVectors(t0, target, k);
      s.radius = s0.radius + (s1.radius - s0.radius) * k;
      s.phi = s0.phi + (s1.phi - s0.phi) * k;
      s.theta = s0.theta + dTheta * k;
      this.camera.position.setFromSpherical(s).add(this.controls.target);
      this.camera.lookAt(this.controls.target);
    }, () => {
      this.controls.enabled = enabled || this.state !== "loading";
      if (this.state === "intro") this.controls.enabled = true;
      done?.();
    }, e, "camera");
  }


  // ---------------------------------------------------------------- callouts
  private showCallouts(id: PartId, interior: boolean) {
    this.clearCallouts();
    const def = PART_BY_ID[id];
    const p = this.parts.get(id)!;
    const meta = interior ? p.interior?.meta : p.meta;
    const obj = interior ? p.interior?.group : p.group;
    if (!meta || !obj) return;
    for (const c of def.callouts) {
      const a = meta.anchors[c.anchor];
      if (!a) continue;
      const el = document.createElement("div");
      el.className = "pc-callout";
      el.style.setProperty("--c", c.color ?? "#e8e8ea");
      el.textContent = c.label;
      this.calloutLayer.appendChild(el);
      const line = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
      line.setAttribute("class", "pc-leader");
      line.style.setProperty("--c", c.color ?? "#e8e8ea");
      const dot = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      dot.setAttribute("r", "3.5");
      dot.setAttribute("class", "pc-leader-dot");
      dot.style.setProperty("--c", c.color ?? "#e8e8ea");
      this.svg.appendChild(line);
      this.svg.appendChild(dot);
      this.callouts.push({ el, line, dot, anchor: v3(a), obj });
    }
    this.calloutVis = 0;
    this.tween(0.5, (k) => (this.calloutVis = k), undefined, easeOut, "callouts");
  }

  private clearCallouts() {
    for (const c of this.callouts) {
      c.el.remove();
      c.line.remove();
      c.dot.remove();
    }
    this.callouts = [];
  }

  /**
   * Labels sit in two columns (left / right of the part). Within a column they keep the vertical order of
   * their anchors, so leader lines never cross; they are spread to a minimum gap and kept clear of the
   * header (top) and the part buttons (bottom).
   */
  private layoutCallouts() {
    if (!this.callouts.length) return;
    const el = this.renderer.domElement;
    const FW = el.clientWidth;
    const W = FW - this.inset;
    const H = el.clientHeight;
    const v = new THREE.Vector3();
    const pts = this.callouts.map((c) => {
      v.copy(c.anchor).applyMatrix4(c.obj.matrixWorld).project(this.camera);
      return { c, x: (v.x * 0.5 + 0.5) * FW, y: (-v.y * 0.5 + 0.5) * H, behind: v.z > 1 };
    });
    const sorted = [...pts].sort((a, b) => a.x - b.x);
    const half = Math.ceil(sorted.length / 2);
    const sides = { l: sorted.slice(0, half), r: sorted.slice(half) };
    const minX = Math.min(...pts.map((p) => p.x));
    const maxX = Math.max(...pts.map((p) => p.x));
    const narrow = W < 640;
    const gap = narrow ? 26 : 30;
    const top = 84;
    const bottom = H - (narrow ? 160 : 150);
    for (const side of ["l", "r"] as const) {
      const list = sides[side].sort((a, b) => a.y - b.y);
      const ys = list.map((p) => Math.min(bottom, Math.max(top, p.y)));
      for (let i = 1; i < ys.length; i++) ys[i] = Math.max(ys[i]!, ys[i - 1]! + gap);
      const overflow = ys.length ? ys[ys.length - 1]! - bottom : 0;
      if (overflow > 0) for (let i = 0; i < ys.length; i++) ys[i] = ys[i]! - overflow;
      for (let i = ys.length - 2; i >= 0; i--) ys[i] = Math.min(ys[i]!, ys[i + 1]! - gap);
      const widths = list.map((p) => p.c.el.offsetWidth);
      const colW = Math.max(0, ...widths);
      // column edge nearest the part
      const edge = side === "l" ? Math.max(10 + colW, minX - 36) : Math.min(W - 10 - colW, maxX + 36);
      list.forEach((p, i) => {
        const y = Math.max(top, ys[i]!);
        const { el: lab, line, dot } = p.c;
        const lw = widths[i]!;
        const lx = side === "l" ? edge - lw : edge;
        const ex = side === "l" ? edge : edge;
        lab.style.transform = `translate(${lx}px, ${y - 12}px)`;
        const op = p.behind ? "0" : String(this.calloutVis);
        lab.style.opacity = op;
        const kx = side === "l" ? ex + 12 : ex - 12;
        line.setAttribute("points", `${p.x},${p.y} ${kx},${y} ${ex},${y}`);
        line.style.opacity = op;
        dot.setAttribute("cx", String(p.x));
        dot.setAttribute("cy", String(p.y));
        dot.style.opacity = op;
      });
    }
  }

  // ---------------------------------------------------------------- per-frame
  private updateLinks(time: number, dt: number) {
    if (this.linksDirty) this.rebuildLinks();
    const sel = this.selected;
    const hov = this.hovered;
    const el = this.renderer.domElement;
    const W = el.clientWidth;
    const H = el.clientHeight;
    const v = new THREE.Vector3();
    for (const L of this.links) {
      let target = 0;
      let labelOn = false;
      if (this.state === "journey") {
        const related = this.highlightLink === L.def.id;
        target = related ? 1 : 0.06;
        labelOn = related;
      } else if (this.state === "intro" || this.state === "overview") {
        const related = (hov && L.def.parts.includes(hov)) || this.highlightLink === L.def.id;
        target = this.showAll ? (hov || this.highlightLink ? (related ? 1 : 0.25) : 0.85) : related ? 1 : 0;
        labelOn = !!related;
      } else if (this.state === "extracting" && sel) {
        target = L.def.parts.includes(sel) ? 1 : this.showAll ? 0.12 : 0;
        labelOn = L.def.parts.includes(sel);
      }
      L.vis += (target - L.vis) * Math.min(1, dt * 6);
      L.mat.uniforms.uOpacity!.value = L.vis;
      L.haloMat.uniforms.uOpacity!.value = L.vis;
      L.dotMat.uniforms.uOpacity!.value = L.vis;
      L.mat.uniforms.uTime!.value = time;
      L.haloMat.uniforms.uTime!.value = time;
      L.dotMat.uniforms.uPx!.value = el.height / (2 * Math.tan((this.camera.fov * Math.PI) / 360));
      const visible = L.vis > 0.01 && !!L.curve;
      L.core.visible = L.halo.visible = L.dots.visible = visible;
      if (visible && L.curve) {
        const pos = L.dots.geometry.getAttribute("position") as THREE.BufferAttribute;
        const n = pos.count;
        const reveal = L.mat.uniforms.uReveal!.value as number;
        const speed = 0.09 / Math.max(0.05, L.length);
        for (let i = 0; i < n; i++) {
          let t = (time * speed + i / n) % 1;
          if (L.def.bidir && i % 2) t = 1 - t;
          t = Math.min(t, reveal);
          L.curve.getPointAt(t, v);
          pos.setXYZ(i, v.x, v.y, v.z);
        }
        pos.needsUpdate = true;
      }
      // label at the curve midpoint
      const show = visible && labelOn && L.vis > 0.3;
      if (show && L.curve) {
        L.curve.getPointAt(0.5, v).project(this.camera);
        const x = (v.x * 0.5 + 0.5) * W;
        const y = (-v.y * 0.5 + 0.5) * H;
        L.label.style.transform = `translate(${x}px, ${y}px) translate(-50%, -140%)`;
        L.label.style.opacity = String(Math.min(1, L.vis));
      } else {
        L.label.style.opacity = "0";
      }
    }
  }


  private updatePacket(dt: number) {
    const on = this.state === "journey" && !!this.packetCurve;
    const target = on ? 1 : 0;
    const u = this.packetMat.uniforms;
    u.uOpacity!.value += (target - (u.uOpacity!.value as number)) * Math.min(1, dt * 5);
    u.uPx!.value = this.renderer.domElement.height / (2 * Math.tan((this.camera.fov * Math.PI) / 360));
    this.packet.visible = (u.uOpacity!.value as number) > 0.01;
    this.packetLight.intensity = (u.uOpacity!.value as number) * (0.25 + 0.2 * Math.sin(this.clock.elapsedTime * 6));
    if (!this.packetCurve) return;
    const head = this.packetCurve.getPointAt(Math.min(1, Math.max(0, this.packetT)));
    this.packetHistory.unshift(head.clone());
    if (this.packetHistory.length > TRAIL) this.packetHistory.length = TRAIL;
    const pos = this.packet.geometry.getAttribute("position") as THREE.BufferAttribute;
    const size = this.packet.geometry.getAttribute("aSize") as THREE.BufferAttribute;
    for (let i = 0; i < TRAIL; i++) {
      const p = this.packetHistory[Math.min(i, this.packetHistory.length - 1)]!;
      pos.setXYZ(i, p.x, p.y, p.z);
    }
    // pulse: the head swells and rings while the CPU / cache works on it
    const pulse = this.packetPulse > 0 && this.packetPulse < 1 ? Math.sin(this.packetPulse * Math.PI * 6) * 0.5 + 0.5 : 0;
    size.setX(0, 0.022 + 0.018 * pulse);
    size.needsUpdate = true;
    pos.needsUpdate = true;
    this.packetLight.position.copy(head);
    if (this.journeyBadge.dataset.on === "1") {
      const v = head.clone().project(this.camera);
      const el = this.renderer.domElement;
      this.journeyBadge.style.transform = `translate(${(v.x * 0.5 + 0.5) * el.clientWidth}px, ${(-v.y * 0.5 + 0.5) * el.clientHeight}px) translate(-50%, -190%)`;
    }
  }

  private updateLook(time: number) {
    LOOK.uTime.value = time;
    const k = this.rgbMix;
    LOOK.uRgb.value = k;
    this.scene.environmentIntensity = 1 - 0.62 * k;
    this.key.intensity = 1.6 * (1 - 0.75 * k);
    this.rim.intensity = 0.9 * (1 - 0.5 * k);
    let glow = LOOK.uRgbColor.value.clone();
    if (LOOK.uRgbMode.value < 0.5) glow = new THREE.Color().setHSL((time * 0.18) % 1, 0.8, 0.55);
    this.caseGlow.color.copy(glow);
    this.caseGlow.intensity = 0.35 * k * (LOOK.uRgbMode.value > 1.5 ? 0.55 + 0.45 * Math.sin(time * 2.2) : 1);
    if (this.bloom) this.bloom.strength = 0.6 * k;
    this.glass.setOpacity(this.glassOpacity);
    this.glass.group.position.x = GLASS_X - 0.3 * this.glassSlide;
  }

  private adaptQuality(dt: number) {
    this.frameTimes.push(dt);
    if (this.frameTimes.length < 40) return;
    const avg = this.frameTimes.reduce((a, b) => a + b, 0) / this.frameTimes.length;
    this.frameTimes = [];
    const now = performance.now();
    if (now - this.lastDprChange < 1500) return;
    let next = this.dpr;
    if (avg > 0.028 && this.dpr > 1) next = Math.max(1, this.dpr - 0.25);
    else if (avg < 0.014 && this.dpr < this.maxDpr) next = Math.min(this.maxDpr, this.dpr + 0.25);
    if (next !== this.dpr) {
      this.dpr = next;
      this.lastDprChange = now;
      this.renderer.setPixelRatio(next);
      this.resize();
    }
  }


  private frame = () => {
    const dt = Math.min(0.1, this.clock.getDelta());
    const time = this.clock.elapsedTime;
    const now = performance.now();
    const running = this.tweens;
    this.tweens = [];
    const keep: Tween[] = [];
    for (const t of running) {
      const k = Math.min(1, (now - t.t0) / t.dur);
      t.fn(t.ease(k));
      if (k < 1) keep.push(t);
      else t.done?.();
    }
    this.tweens = keep.concat(this.tweens);
    if (this.controls.enabled) this.controls.update();
    this.clampTarget();
    this.updateLinks(time, dt);
    this.updatePacket(dt);
    this.updateLook(time);
    if (this.composer && this.rgbMix > 0.001) this.composer.render(dt);
    else this.renderer.render(this.scene, this.camera);
    this.layoutCallouts();
    if (this.state !== "loading") this.adaptQuality(dt);
    this.stats.frames++;
    this.stats.dt = dt;
    this.stats.dpr = this.dpr;
  };

  private clampTarget() {
    const t = this.controls.target;
    const lim = 0.6;
    t.x = THREE.MathUtils.clamp(t.x, -lim, lim);
    t.y = THREE.MathUtils.clamp(t.y, 0, 0.7);
    t.z = THREE.MathUtils.clamp(t.z, -lim, lim);
  }

  private resize() {
    const el = this.container;
    const w = Math.max(1, el.clientWidth);
    const h = Math.max(1, el.clientHeight);
    this.renderer.setSize(w, h, false);
    this.renderer.domElement.style.width = `${w}px`;
    this.renderer.domElement.style.height = `${h}px`;
    this.composer?.setPixelRatio(this.dpr);
    this.composer?.setSize(w, h);
    this.camera.aspect = w / h;
    if (this.inset > 0 && w - this.inset > 200) {
      this.camera.setViewOffset(w, h, this.inset / 2, 0, w, h);
    } else {
      this.camera.clearViewOffset();
    }
    this.camera.updateProjectionMatrix();
    this.svg.setAttribute("width", String(w));
    this.svg.setAttribute("height", String(h));
  }

  // ---------------------------------------------------------------- input
  private pick(clientX: number, clientY: number): PartId | null {
    const el = this.renderer.domElement;
    const r = el.getBoundingClientRect();
    const ndc = new THREE.Vector2(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
    this.raycaster.setFromCamera(ndc, this.camera);
    const proxies: THREE.Object3D[] = [];
    for (const p of this.parts.values()) if (p.opacity > 0.5 || this.state === "overview") proxies.push(p.proxy);
    const hits = this.raycaster.intersectObjects(proxies, false);
    const nonCase = hits.filter((h) => h.object.userData.part !== "case" && h.object.userData.part !== "board");
    if (nonCase.length) return nonCase[0]!.object.userData.part as PartId;
    const board = hits.find((h) => h.object.userData.part === "board");
    if (board) return "board";
    return hits.length ? (hits[0]!.object.userData.part as PartId) : null;
  }

  private onDown = (e: PointerEvent) => {
    this.down = { x: e.clientX, y: e.clientY, t: performance.now() };
  };

  private onUp = (e: PointerEvent) => {
    const d = this.down;
    this.down = null;
    if (!d) return;
    const moved = Math.hypot(e.clientX - d.x, e.clientY - d.y);
    if (moved > 8 || performance.now() - d.t > 600) return;
    if (this.state === "overview") {
      const id = this.pick(e.clientX, e.clientY);
      if (id) this.select(id);
    } else if (this.state === "open" || this.state === "extracting") {
      // tap on empty space returns; tap on the part itself does nothing
      const id = this.pick(e.clientX, e.clientY);
      if (!id && this.selected !== "case") this.back();
    }
  };


  private onMove = (e: PointerEvent) => {
    if (e.pointerType !== "mouse" || this.state !== "overview" || e.buttons) return;
    const id = this.pick(e.clientX, e.clientY);
    if (id !== this.hovered) {
      if (this.hovered) {
        const p = this.parts.get(this.hovered);
        if (p?.model) p.model.hover.value = 0;
      }
      this.hovered = id;
      if (id) {
        const p = this.parts.get(id);
        if (p?.model && id !== "case") p.model.hover.value = 1;
      }
      this.renderer.domElement.style.cursor = id ? "pointer" : "";
      this.cb.onHover?.(id);
    }
  };

  private onLeave = () => {
    if (this.hovered) {
      const p = this.parts.get(this.hovered);
      if (p?.model) p.model.hover.value = 0;
      this.hovered = null;
      this.cb.onHover?.(null);
    }
  };

  private onControlStart = () => {
    // user grabbed the camera: cancel any automatic camera move
    this.tweens = this.tweens.filter((t) => t.key !== "camera");
  };
}
