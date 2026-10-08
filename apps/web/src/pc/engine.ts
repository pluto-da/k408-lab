// 整机拆解 3D 场景（three.js + Spark）。只负责场景与交互，界面文字在 React 侧。
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { SparkRenderer, SplatMesh } from "@sparkjsdev/spark";
import manifestJson from "./manifest.json";
import { LINKS, PART_BY_ID, PARTS, type LinkDef, type PartId } from "./parts";

type Vec3 = [number, number, number];
interface PartMeta {
  count: number;
  bytes: number;
  origin: Vec3;
  bbox: [Vec3, Vec3];
  anchors: Record<string, Vec3>;
}
interface Manifest {
  exterior: Record<string, PartMeta>;
  interior: Record<string, PartMeta>;
}
const manifest = manifestJson as unknown as Manifest;

const assetUrls = import.meta.glob("./assets/*.sog", { query: "?url", import: "default", eager: true }) as Record<string, string>;
const urlOf = (name: string): string => {
  const u = assetUrls[`./assets/${name}.sog`];
  if (!u) throw new Error(`missing asset ${name}`);
  return u;
};

/**
 * Some interior scans were captured in a different orientation than the part sits in the case.
 * The board interior lies flat (thin along y); in the case it stands upright (thin along x):
 * case = R · interior with x' = -y, y' = -z, z' = x.
 */
const INTERIOR_ROT: Partial<Record<PartId, THREE.Matrix4>> = {
  board: new THREE.Matrix4().set(0, -1, 0, 0, 0, 0, -1, 0, 1, 0, 0, 0, 0, 0, 0, 1),
};

export type EngineState = "loading" | "intro" | "overview" | "extracting" | "open" | "closing";

export interface EngineCallbacks {
  onProgress?: (p: number) => void;
  onReady?: () => void;
  onState?: (s: EngineState, part: PartId | null) => void;
  onHover?: (part: PartId | null) => void;
  onInteriorProgress?: (p: number | null) => void;
  onError?: (msg: string) => void;
}

const CENTER = new THREE.Vector3(0, 0.25, 0);
const OVERVIEW_DIR = new THREE.Vector3(-1.0, 0.5, 0.95).normalize();
const MOUNTED: PartId[] = ["cpu", "ram", "ssd", "gpu", "nic"];

const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

interface Tween {
  t0: number;
  dur: number;
  fn: (k: number) => void;
  ease: (t: number) => number;
  done?: () => void;
  key?: string;
}

interface PartRT {
  id: PartId;
  meta: PartMeta;
  group: THREE.Group;
  mesh: SplatMesh | null;
  proxy: THREE.Mesh;
  base: THREE.Vector3;
  opacity: number;
  center: THREE.Vector3; // local bbox centre
  radius: number;
  interior?: { group: THREE.Group; mesh: SplatMesh; meta: PartMeta };
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
const GLASS_FS = /* glsl */ `
  varying vec2 vUv; uniform float uOpacity;
  void main(){
    float band = smoothstep(0.0, 0.18, vUv.x + vUv.y * 0.45 - 0.35) * (1.0 - smoothstep(0.18, 0.42, vUv.x + vUv.y * 0.45 - 0.35));
    float band2 = smoothstep(0.0, 0.05, vUv.x + vUv.y * 0.45 - 0.95) * (1.0 - smoothstep(0.05, 0.12, vUv.x + vUv.y * 0.45 - 0.95));
    float rim = smoothstep(0.985, 1.0, max(abs(vUv.x*2.0-1.0), abs(vUv.y*2.0-1.0)));
    float a = 0.035 + 0.07 * band + 0.05 * band2 + 0.18 * rim;
    gl_FragColor = vec4(vec3(0.75, 0.82, 0.92) * a * uOpacity, 1.0);
  }`;

export class PcEngine {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private controls: OrbitControls;
  private spark: SparkRenderer;
  private parts = new Map<PartId, PartRT>();
  private links: LinkRT[] = [];
  private tweens: Tween[] = [];
  private raycaster = new THREE.Raycaster();
  private glass!: THREE.Mesh;
  private glassMat!: THREE.ShaderMaterial;
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
  /** lightweight counters for diagnostics (window.__pcStats) */
  readonly stats = { frames: 0, dt: 0, dpr: 1 };

  constructor(
    private container: HTMLElement,
    private overlay: HTMLElement,
    private cb: EngineCallbacks = {},
  ) {
    this.renderer = new THREE.WebGLRenderer({ antialias: false, alpha: false, powerPreference: "high-performance" });
    this.maxDpr = Math.min(window.devicePixelRatio || 1, 2);
    // ?dpr=1 caps the pixel ratio (used by automated screenshots / very slow devices)
    const forced = Number(new URLSearchParams(window.location.search).get("dpr"));
    if (forced > 0) this.maxDpr = Math.min(this.maxDpr, forced);
    this.dpr = Math.min(this.maxDpr, 1.5);
    this.renderer.setPixelRatio(this.dpr);
    this.renderer.setClearColor(0x0a0c10, 1);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(this.renderer.domElement);
    this.renderer.domElement.className = "pc-canvas";

    this.camera = new THREE.PerspectiveCamera(34, 1, 0.004, 20);
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

    this.spark = new SparkRenderer({ renderer: this.renderer });
    this.scene.add(this.spark);
    this.buildStage();

    this.calloutLayer = document.createElement("div");
    this.calloutLayer.className = "pc-callouts";
    this.svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    this.svg.setAttribute("class", "pc-leaders");
    overlay.appendChild(this.svg);
    overlay.appendChild(this.calloutLayer);

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
    const report = () => this.cb.onProgress?.(Math.min(0.97, (got / total) * 0.92));
    try {
      await Promise.all(
        names.map(async (id) => {
          const bytes = await fetchBytes(urlOf(id), (n) => {
            got += n;
            report();
          }, this.abort.signal);
          if (this.disposed) return;
          const mesh = new SplatMesh({ fileBytes: bytes, fileName: `${id}.sog` });
          await withTimeout(mesh.initialized, 60_000, id);
          if (this.disposed) return;
          mesh.opacity = 0;
          this.parts.get(id)!.mesh = mesh;
          this.parts.get(id)!.group.add(mesh);
        }),
      );
    } catch (e) {
      if (!this.disposed) this.cb.onError?.(e instanceof Error ? e.message : String(e));
      return;
    }
    if (this.disposed) return;
    this.cb.onProgress?.(1);
    this.cb.onReady?.();
    this.intro();
  }

  select(id: PartId | null) {
    if (this.state === "loading") return;
    if (id === this.selected) return;
    if (id === null) return this.back();
    if (this.selected) {
      this.back(() => this.select(id));
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
      const im = p.interior.mesh;
      const ig = p.interior.group;
      this.tween(0.45, (k) => {
        im.opacity = 1 - k;
        ig.scale.setScalar(1 - 0.08 * k);
      }, undefined, easeOut, "interior");
    }
    const carry = id === "board" ? MOUNTED : [];
    for (const q of this.parts.values()) this.fadePart(q, 1, 0.8);
    this.slide(id, 0, dur);
    for (const c of carry) this.slide(c, 0, dur, id);
    if (id === "case") this.moveGlass(0, dur);
    else this.fadeGlass(1, dur);
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
    if (this.state === "overview") this.flyTo(CENTER, OVERVIEW_DIR, this.overviewDistance(), 1.0);
    else if (this.selected) this.frameSelected(1.0);
  }

  dispose() {
    this.disposed = true;
    this.abort.abort();
    this.renderer.setAnimationLoop(null);
    this.ro.disconnect();
    const el = this.renderer.domElement;
    el.removeEventListener("pointerdown", this.onDown);
    el.removeEventListener("pointerup", this.onUp);
    el.removeEventListener("pointermove", this.onMove);
    el.removeEventListener("pointerleave", this.onLeave);
    this.controls.removeEventListener("start", this.onControlStart);
    this.controls.dispose();
    for (const p of this.parts.values()) {
      p.mesh?.dispose();
      p.interior?.mesh.dispose();
    }
    this.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.geometry) m.geometry.dispose();
      const mat = m.material as THREE.Material | undefined;
      if (mat && "dispose" in mat) mat.dispose();
    });
    // Spark's sort worker rejects its in-flight request with "Worker terminate" when disposed mid-sort.
    // That promise is awaited inside Spark without a catch, so swallow exactly that rejection briefly.
    const swallow = (ev: PromiseRejectionEvent) => {
      if (ev.reason instanceof Error && ev.reason.message === "Worker terminate") ev.preventDefault();
    };
    window.addEventListener("unhandledrejection", swallow);
    setTimeout(() => window.removeEventListener("unhandledrejection", swallow), 5000);
    this.spark.dispose();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    el.remove();
    this.svg.remove();
    this.calloutLayer.remove();
  }

  // ---------------------------------------------------------------- scene setup
  private buildStage() {
    this.scene.background = new THREE.Color(0x0a0c10);
    // floor with radial falloff
    const floorMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: true,
      uniforms: {},
      vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
      fragmentShader: `varying vec2 vUv; void main(){ vec2 q = vUv*2.0-1.0; float r = length(q);
        float g = 1.0 - smoothstep(0.0, 1.0, r);
        float ring = exp(-pow((r-0.33)/0.004,2.0))*0.5 + exp(-pow((r-0.36)/0.002,2.0))*0.25;
        float sh = 1.0 - 0.75*exp(-pow(q.x/0.13,2.0)-pow(q.y/0.24,2.0));
        vec3 base = mix(vec3(0.039,0.047,0.063), vec3(0.11,0.125,0.15), g*g);
        vec3 c = base*sh + vec3(0.35,0.55,0.9)*ring*g;
        gl_FragColor = vec4(c, 1.0); }`,
    });
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 1.8), floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.0005;
    floor.renderOrder = -10;
    this.scene.add(floor);

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
      this.parts.set(def.id, {
        id: def.id,
        meta,
        group,
        mesh: null,
        proxy,
        base: group.position.clone(),
        opacity: 0,
        center,
        radius: size.length() / 2,
      });
    }
    // tempered glass (faint additive sheen, only from the outside)
    this.glassMat = new THREE.ShaderMaterial({
      uniforms: { uOpacity: { value: 0 } },
      vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
      fragmentShader: GLASS_FS,
      transparent: true,
      depthWrite: false,
      depthTest: false,
      blending: THREE.AdditiveBlending,
      side: THREE.FrontSide,
    });
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(0.434, 0.456), this.glassMat);
    glass.rotation.y = -Math.PI / 2;
    glass.position.set(-0.1056, 0.25, -0.006);
    glass.renderOrder = 900;
    this.glass = glass;
    this.scene.add(glass);

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
      setTimeout(() => this.fadePart(p, 1, id === "case" ? 1.2 : 0.8), (id === "case" ? 0 : 500 + i * 140));
    });
    this.tween(1.4, (k) => (this.glassMat.uniforms.uOpacity!.value = k), undefined, easeOut);
    this.flyTo(CENTER, OVERVIEW_DIR, this.overviewDistance(), 3.4, () => {
      this.controls.enabled = true;
      this.setState("overview", null);
    }, ease);
    // reveal lines after the camera settles
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
    this.dispatchProgress(id);
    const carry = id === "board" ? MOUNTED : [];
    for (const q of this.parts.values()) {
      if (q.id === id || carry.includes(q.id)) continue;
      this.fadePart(q, id === "case" ? 1 : 0.18, 0.7);
    }
    this.slide(id, 1, 0.95);
    for (const c of carry) this.slide(c, 1, 0.95, id);
    if (id === "case") {
      this.moveGlass(1, 0.95);
      this.flyTo(CENTER.clone().add(new THREE.Vector3(0, 0.0, 0.0)), new THREE.Vector3(...def.view).normalize(), this.overviewDistance() * 0.92, 1.1, () => {
        if (this.selected !== id) return;
        this.setState("open", id);
        this.showCallouts(id, false);
      });
      return;
    }
    this.fadeGlass(0, 0.6);
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
    // place the interior so its bbox centre coincides with the exploded part centre
    const ilo = v3(it.meta.bbox[0]);
    const ihi = v3(it.meta.bbox[1]);
    const ic = ilo.clone().add(ihi).multiplyScalar(0.5).applyQuaternion(it.group.quaternion);
    it.group.position.copy(center).sub(ic);
    it.group.visible = true;
    it.mesh.opacity = 0;
    it.group.scale.setScalar(0.92);
    this.fadePart(p, 0, 0.5);
    for (const c of carry) this.fadePart(this.parts.get(c)!, 0, 0.5);
    for (const q of this.parts.values()) if (q.id !== id && !carry.includes(q.id)) this.fadePart(q, 0, 0.6);
    this.tween(0.75, (k) => {
      it.mesh.opacity = k;
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
        const bytes = await fetchBytes(urlOf(`${id}_open`), (n) => {
          got += n;
          this.cb.onInteriorProgress?.(Math.min(0.99, got / meta.bytes));
        }, this.abort.signal);
        const mesh = new SplatMesh({ fileBytes: bytes, fileName: `${id}_open.sog` });
        await withTimeout(mesh.initialized, 60_000, id);
        const group = new THREE.Group();
        group.visible = false;
        const rot = INTERIOR_ROT[id];
        if (rot) group.quaternion.setFromRotationMatrix(rot);
        group.add(mesh);
        this.scene.add(group);
        p.interior = { group, mesh, meta };
        this.cb.onInteriorProgress?.(null);
      })();
      p.interiorPromise.catch(() => (p.interiorPromise = undefined));
    }
    await p.interiorPromise;
  }

  private dispatchProgress(id: PartId) {
    const pid = PART_BY_ID[id].progressId;
    if (!pid) return;
    window.dispatchEvent(new CustomEvent("lab:event", { detail: { type: "part_focused", partId: pid } }));
  }

  // ---------------------------------------------------------------- animation helpers
  private tween(dur: number, fn: (k: number) => void, done?: () => void, e = ease, key?: string) {
    if (key) this.tweens = this.tweens.filter((t) => t.key !== key);
    this.tweens.push({ t0: performance.now(), dur: dur * 1000, fn, done, ease: e, key });
  }

  private fadePart(p: PartRT, to: number, dur: number) {
    const from = p.opacity;
    if (p.mesh) p.mesh.visible = true;
    this.tween(dur, (k) => {
      p.opacity = from + (to - from) * k;
      if (p.mesh) p.mesh.opacity = p.opacity;
    }, () => {
      if (p.mesh) p.mesh.visible = p.opacity > 0.01;
    }, ease, "fade-" + p.id);
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

  private moveGlass(to: 0 | 1, dur: number) {
    const from = this.glass.position.x;
    const target = -0.1056 - 0.16 * to;
    const o0 = this.glassMat.uniforms.uOpacity!.value as number;
    this.tween(dur, (k) => {
      this.glass.position.x = from + (target - from) * k;
      this.glassMat.uniforms.uOpacity!.value = o0 + ((to ? 0 : 1) - o0) * k;
    }, undefined, ease, "glass");
  }

  private fadeGlass(to: number, dur: number) {
    const o0 = this.glassMat.uniforms.uOpacity!.value as number;
    this.tween(dur, (k) => (this.glassMat.uniforms.uOpacity!.value = o0 + (to - o0) * k), undefined, ease, "glass");
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

  private layoutCallouts() {
    if (!this.callouts.length) return;
    const el = this.renderer.domElement;
    const FW = el.clientWidth; // NDC spans the whole canvas (the panel inset is a view offset)
    const W = FW - this.inset; // usable area left of the panel
    const H = el.clientHeight;
    const v = new THREE.Vector3();
    const pts = this.callouts.map((c) => {
      v.copy(c.anchor).applyMatrix4(c.obj.matrixWorld).project(this.camera);
      return { c, x: (v.x * 0.5 + 0.5) * FW, y: (-v.y * 0.5 + 0.5) * H, behind: v.z > 1 };
    });
    const cx = pts.reduce((s, p) => s + p.x, 0) / pts.length;
    const minX = Math.min(...pts.map((p) => p.x));
    const maxX = Math.max(...pts.map((p) => p.x));
    const narrow = W < 640;
    const sides: Record<"l" | "r", typeof pts> = { l: [], r: [] };
    for (const p of pts) sides[p.x < cx ? "l" : "r"].push(p);
    // balance sides
    while (sides.l.length > sides.r.length + 1) {
      sides.l.sort((a, b) => b.x - a.x);
      sides.r.push(sides.l.shift()!);
    }
    while (sides.r.length > sides.l.length + 1) {
      sides.r.sort((a, b) => a.x - b.x);
      sides.l.push(sides.r.shift()!);
    }
    const gap = narrow ? 26 : 30;
    for (const side of ["l", "r"] as const) {
      const list = sides[side].sort((a, b) => a.y - b.y);
      const ys = list.map((p) => p.y);
      for (let i = 1; i < ys.length; i++) ys[i] = Math.max(ys[i]!, ys[i - 1]! + gap);
      const overflow = ys.length ? ys[ys.length - 1]! - (H - 110) : 0;
      if (overflow > 0) for (let i = 0; i < ys.length; i++) ys[i] = ys[i]! - overflow;
      for (let i = ys.length - 2; i >= 0; i--) ys[i] = Math.min(ys[i]!, ys[i + 1]! - gap);
      list.forEach((p, i) => {
        const y = Math.max(78, ys[i]!);
        const { el: lab, line, dot } = p.c;
        const lw = lab.offsetWidth;
        let lx: number;
        if (side === "l") lx = Math.max(10, Math.min(minX - 40, p.x - 60) - lw);
        else lx = Math.min(W - lw - 10, Math.max(maxX + 40, p.x + 60));
        const ex = side === "l" ? lx + lw : lx;
        lab.style.transform = `translate(${lx}px, ${y - 12}px)`;
        lab.style.opacity = p.behind ? "0" : String(this.calloutVis);
        const kx = side === "l" ? ex + 14 : ex - 14;
        line.setAttribute("points", `${p.x},${p.y} ${kx},${y} ${ex},${y}`);
        line.style.opacity = p.behind ? "0" : String(this.calloutVis);
        dot.setAttribute("cx", String(p.x));
        dot.setAttribute("cy", String(p.y));
        dot.style.opacity = p.behind ? "0" : String(this.calloutVis);
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
      if (this.state === "intro" || this.state === "overview") {
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
    this.renderer.render(this.scene, this.camera);
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
        if (p?.mesh) p.mesh.recolor = new THREE.Color(1, 1, 1);
      }
      this.hovered = id;
      if (id) {
        const p = this.parts.get(id);
        if (p?.mesh && id !== "case") p.mesh.recolor = new THREE.Color(1.22, 1.2, 1.12);
      }
      this.renderer.domElement.style.cursor = id ? "pointer" : "";
      this.cb.onHover?.(id);
    }
  };

  private onLeave = () => {
    if (this.hovered) {
      const p = this.parts.get(this.hovered);
      if (p?.mesh) p.mesh.recolor = new THREE.Color(1, 1, 1);
      this.hovered = null;
      this.cb.onHover?.(null);
    }
  };

  private onControlStart = () => {
    // user grabbed the camera: cancel any automatic camera move
    this.tweens = this.tweens.filter((t) => t.key !== "camera");
  };
}
