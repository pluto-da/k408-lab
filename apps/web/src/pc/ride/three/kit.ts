// 内部场景的小工具：画字的平面、发光材质、地面网格、门洞。全部程序化生成，不加载模型文件。
import * as THREE from "three";

export const C = {
  bg: 0x07090d,
  membus: "#B07CFF",
  pcie: "#3CA8FF",
  dmi: "#2FD0B8",
  sata: "#FF9A3C",
  nic: "#4CE38A",
  power: "#FFC24A",
  alu: "#E8843A",
  cu: "#4678DC",
  l1: "#82D278",
  l2: "#28965A",
  l3: "#22AAAA",
  imc: "#965AC8",
  ok: "#3FBF7F",
  bad: "#E5534B",
  ink: "#E8EAF0",
  dim: "#858C9C",
};

/** 化身数据的界面语义色：画面里的文字板与讲解栏（ride.css 的 --ride-*）共用同一套 */
export const UI = {
  bg: "#0b0d12",
  plate: "rgba(20,24,33,0.88)",
  stroke: "rgba(255,255,255,0.12)",
  row: "rgba(255,255,255,0.035)",
  rowLine: "rgba(255,255,255,0.10)",
  ink: "#E8EAF0",
  ink2: "#A3A9B7",
  ink3: "#858C9C",
  accent: "#5B7CFF",
  accentSoft: "rgba(91,124,255,0.16)",
  tag: "#E0A43A",
  set: "#3FB5A0",
  off: "#5AA9E6",
  frame: "#9B8CFF",
  ok: "#3FBF7F",
  okSoft: "rgba(63,191,127,0.14)",
  bad: "#E5534B",
  badInk: "#F0716A",
};

/** 地址字段的语义色：标记 = 琥珀，组号 / 索引 = 青绿，偏移 = 天蓝，页框号 / 物理地址 = 紫 */
export const TONE: Record<string, string> = {
  vpn: UI.ink2,
  off: UI.off,
  tag: UI.tag,
  set: UI.set,
  frame: UI.frame,
  dir: UI.set,
  tbl: UI.set,
  data: UI.ink,
  plain: UI.ink,
};

export const FONT = `"PingFang SC","Hiragino Sans GB","Microsoft YaHei","Noto Sans CJK SC","WenQuanYi Micro Hei",system-ui,sans-serif`;
export const MONO = `"Geist Mono",ui-monospace,"SFMono-Regular",Menlo,Consolas,${FONT}`;

/** 画字的平面：canvas 贴图，内容变化时重画。焦点文字板可提高分辨率（setRes），小屏可换尺寸（resize） */
export class TextPlate {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  tex: THREE.CanvasTexture;
  readonly mesh: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
  w: number;
  h: number;
  worldW: number;
  /** 当前分辨率倍数 */
  res: number;
  readonly baseRes: number;
  private key = "";

  constructor(pxW: number, pxH: number, worldW: number, scale = 1) {
    this.w = pxW;
    this.h = pxH;
    this.worldW = worldW;
    this.res = scale;
    this.baseRes = scale;
    this.canvas = document.createElement("canvas");
    this.ctx = this.canvas.getContext("2d")!;
    this.tex = this.makeTex(scale);
    const mat = new THREE.MeshBasicMaterial({ map: this.tex, transparent: true, depthWrite: false, toneMapped: false, side: THREE.FrontSide });
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(worldW, (worldW * pxH) / pxW), mat);
  }

  private makeTex(scale: number) {
    this.canvas.width = Math.max(2, Math.round(this.w * scale));
    this.canvas.height = Math.max(2, Math.round(this.h * scale));
    this.ctx.setTransform(scale, 0, 0, scale, 0, 0);
    const tex = new THREE.CanvasTexture(this.canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    return tex;
  }

  /** 世界里的高度 */
  get worldH() {
    return (this.worldW * this.h) / this.w;
  }

  /** 换分辨率倍数（下次 draw 时重画） */
  setRes(scale: number) {
    const s = Math.round(Math.max(0.5, Math.min(3, scale)) * 4) / 4;
    if (s === this.res) return;
    this.res = s;
    this.tex.dispose();
    this.tex = this.makeTex(s);
    this.mesh.material.map = this.tex;
    this.mesh.material.needsUpdate = true;
    this.key = "";
  }

  /** 换画布尺寸（逻辑像素），世界宽度不变或指定新宽度 */
  resize(pxW: number, pxH: number, worldW = this.worldW) {
    if (pxW === this.w && pxH === this.h && worldW === this.worldW) return;
    this.w = pxW;
    this.h = pxH;
    this.worldW = worldW;
    this.tex.dispose();
    this.tex = this.makeTex(this.res);
    this.mesh.material.map = this.tex;
    this.mesh.material.needsUpdate = true;
    this.mesh.geometry.dispose();
    this.mesh.geometry = new THREE.PlaneGeometry(worldW, (worldW * pxH) / pxW);
    this.key = "";
  }

  /** key 相同则跳过重画 */
  draw(key: string, fn: (g: CanvasRenderingContext2D, w: number, h: number) => void) {
    if (key === this.key) return;
    this.key = key;
    const g = this.ctx;
    g.clearRect(0, 0, this.w, this.h);
    fn(g, this.w, this.h);
    this.tex.needsUpdate = true;
  }

  dispose() {
    this.tex.dispose();
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
  }
}

/** 画面里的文字标签（屏幕空间，固定字号）：由 RideScene 投影到观察窗口，互相遮挡时隐藏次要的 */
export interface SceneLabel {
  text: string;
  pos: THREE.Vector3;
  color: string;
  /** 不显示（例如所在楼层没启用） */
  hidden?: boolean;
  /** 属于哪一站的焦点：站点 place 或 cue 名 */
  tag?: string;
}

export function rr(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

/** 文字板底：统一的深色玻璃屏（细描边、圆角，不再有彩色边条） */
export function panelBg(g: CanvasRenderingContext2D, w: number, h: number, alpha = 0.88) {
  rr(g, 2, 2, w - 4, h - 4, 18);
  g.fillStyle = `rgba(20,24,33,${alpha})`;
  g.fill();
  g.lineWidth = 2;
  g.strokeStyle = UI.stroke;
  g.stroke();
}

/** 表头右侧的状态徽章（命中 / 缺失）：文字 + 颜色，不单靠颜色 */
export function badge(g: CanvasRenderingContext2D, label: string, x: number, y: number, size: number, ok: boolean, align: "left" | "right" = "right") {
  g.font = `600 ${size}px ${FONT}`;
  const tw = g.measureText(label).width;
  const dot = size * 0.34;
  const padX = size * 0.55;
  const w = tw + padX * 2 + dot * 2 + size * 0.3;
  const h = size * 1.55;
  const x0 = align === "right" ? x - w : x;
  rr(g, x0, y - h / 2, w, h, h / 2);
  g.fillStyle = ok ? "rgba(63,191,127,0.16)" : "rgba(229,83,75,0.16)";
  g.fill();
  g.lineWidth = 2;
  g.strokeStyle = ok ? UI.ok : UI.bad;
  g.stroke();
  g.beginPath();
  g.arc(x0 + padX + dot, y, dot, 0, Math.PI * 2);
  g.fillStyle = ok ? UI.ok : UI.bad;
  g.fill();
  text(g, label, x0 + padX + dot * 2 + size * 0.3, y + 1, size, ok ? "#BFF0D4" : "#FFD1CE", 600);
  return w;
}

export function text(g: CanvasRenderingContext2D, s: string, x: number, y: number, size: number, color = C.ink, weight = 500, align: CanvasTextAlign = "left", font = FONT) {
  g.font = `${weight} ${size}px ${font}`;
  g.fillStyle = color;
  g.textAlign = align;
  g.textBaseline = "middle";
  g.fillText(s, x, y);
}

/** 发光的线框盒（部件在内部世界里的轮廓） */
export function glowBox(w: number, h: number, d: number, color: string, fill = 0.08): THREE.Group {
  const g = new THREE.Group();
  const box = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: fill, depthWrite: false, toneMapped: false }),
  );
  const edges = new THREE.LineSegments(
    new THREE.EdgesGeometry(box.geometry),
    new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.85, toneMapped: false }),
  );
  g.add(box, edges);
  g.userData.fill = box.material;
  g.userData.edge = edges.material;
  return g;
}

/** 地面：远处淡出的网格 */
export function gridFloor(size: number, color = "#6b7a99", y = 0): THREE.Mesh {
  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: { uColor: { value: new THREE.Color(color) } },
    vertexShader: `varying vec3 vW; void main(){ vec4 w = modelMatrix*vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix*viewMatrix*w; }`,
    fragmentShader: `varying vec3 vW; uniform vec3 uColor;
      void main(){ vec2 g = abs(fract(vW.xz*0.5 - 0.5) - 0.5) / fwidth(vW.xz*0.5);
        float l = 1.0 - min(min(g.x, g.y), 1.0);
        vec2 g2 = abs(fract(vW.xz*0.1 - 0.5) - 0.5) / fwidth(vW.xz*0.1);
        float l2 = 1.0 - min(min(g2.x, g2.y), 1.0);
        float d = length(cameraPosition.xz - vW.xz);
        float fade = exp(-d*0.045);
        gl_FragColor = vec4(uColor, (l*0.09 + l2*0.16) * fade); }`,
  });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(size, size), mat);
  m.rotation.x = -Math.PI / 2;
  m.position.y = y;
  m.renderOrder = -5;
  return m;
}

/** 发光的通道条（地面上的走线） */
export function lane(points: THREE.Vector3[], color: string, width = 0.5, opacity = 0.55): THREE.Mesh {
  const curve = new THREE.CatmullRomCurve3(points, false, "centripetal", 0.5);
  const n = Math.max(16, Math.round(curve.getLength() * 2));
  const pos: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  const up = new THREE.Vector3(0, 1, 0);
  const side = new THREE.Vector3();
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const p = curve.getPointAt(t);
    const tg = curve.getTangentAt(t);
    side.crossVectors(tg, up).normalize().multiplyScalar(width / 2);
    pos.push(p.x - side.x, p.y + 0.01, p.z - side.z, p.x + side.x, p.y + 0.01, p.z + side.z);
    uv.push(0, t * curve.getLength(), 1, t * curve.getLength());
    if (i < n) idx.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    uniforms: { uColor: { value: new THREE.Color(color) }, uTime: { value: 0 }, uOpacity: { value: opacity }, uMove: { value: 1 } },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
    fragmentShader: `varying vec2 vUv; uniform vec3 uColor; uniform float uTime; uniform float uOpacity; uniform float uMove;
      void main(){ float edge = smoothstep(0.0, 0.25, vUv.x) * smoothstep(1.0, 0.75, vUv.x);
        float core = 1.0 - smoothstep(0.0, 0.12, abs(vUv.x - 0.5));
        float dash = 0.5 + 0.5*sin(vUv.y*3.0 - uTime*4.0*uMove);
        gl_FragColor = vec4(uColor, uOpacity * (edge*0.35 + core*0.65) * (0.55 + 0.45*dash)); }`,
  });
  const m = new THREE.Mesh(geo, mat);
  m.renderOrder = -4;
  return m;
}

/** 岔路口的门洞：一个拱形框 + 上方写着条件 */
export class Gate {
  readonly group = new THREE.Group();
  private frame: THREE.Mesh<THREE.TubeGeometry, THREE.MeshBasicMaterial>;
  private glow: THREE.Mesh<THREE.TubeGeometry, THREE.MeshBasicMaterial>;
  readonly label: TextPlate;
  private color: THREE.Color;
  private state: "idle" | "on" | "off" = "idle";

  constructor(text0: string, color: string, scale = 1) {
    this.color = new THREE.Color(color);
    const w = 1.5;
    const h = 2.3;
    const pts = [new THREE.Vector3(-w / 2, 0, 0), new THREE.Vector3(-w / 2, h - 0.5, 0), new THREE.Vector3(0, h, 0), new THREE.Vector3(w / 2, h - 0.5, 0), new THREE.Vector3(w / 2, 0, 0)];
    const curve = new THREE.CatmullRomCurve3(pts, false, "centripetal", 0.5);
    this.frame = new THREE.Mesh(new THREE.TubeGeometry(curve, 40, 0.045, 6), new THREE.MeshBasicMaterial({ color: this.color, toneMapped: false, transparent: true }));
    this.glow = new THREE.Mesh(new THREE.TubeGeometry(curve, 40, 0.16, 8), new THREE.MeshBasicMaterial({ color: this.color, transparent: true, opacity: 0.12, depthWrite: false, toneMapped: false }));
    this.label = new TextPlate(560, 96, 2.6, scale);
    this.label.mesh.position.set(0, h + 0.45, 0);
    this.group.add(this.frame, this.glow, this.label.mesh);
    this.drawLabel(text0);
  }

  private text0 = "";
  private drawLabel(t: string) {
    this.text0 = t;
    this.label.draw(`${t}|${this.state}`, (g, w, h) => {
      rr(g, 2, 2, w - 4, h - 4, 16);
      g.fillStyle = "rgba(20,24,33,0.9)";
      g.fill();
      g.lineWidth = 3;
      g.strokeStyle = this.state === "off" ? "rgba(255,255,255,0.12)" : "#" + this.color.getHexString();
      g.stroke();
      text(g, t, w / 2, h / 2 + 1, 34, this.state === "off" ? "rgba(232,234,240,0.45)" : C.ink, 600, "center");
    });
  }

  /** 岔路门洞只在相关站显示 */
  show(v: boolean) {
    this.group.visible = v;
  }

  set(state: "idle" | "on" | "off", time = 0) {
    if (state !== this.state) {
      this.state = state;
      this.drawLabel(this.text0);
    }
    const pulse = state === "on" ? 0.5 + 0.5 * Math.sin(time * 3) : 0;
    this.frame.material.opacity = state === "off" ? 0.18 : state === "on" ? 1 : 0.6;
    this.glow.material.opacity = state === "on" ? 0.12 + 0.08 * pulse : state === "off" ? 0.02 : 0.06;
    this.label.mesh.material.opacity = state === "off" ? 0.5 : 1;
  }

  dispose() {
    this.label.dispose();
    this.frame.geometry.dispose();
    this.frame.material.dispose();
    this.glow.geometry.dispose();
    this.glow.material.dispose();
  }
}

/** 浮在空中的细小光点，增加纵深 */
export function dust(count: number, box: THREE.Box3, color = "#8aa6ff"): THREE.Points {
  const pos = new Float32Array(count * 3);
  const s = box.getSize(new THREE.Vector3());
  for (let i = 0; i < count; i++) {
    pos[i * 3] = box.min.x + Math.random() * s.x;
    pos[i * 3 + 1] = box.min.y + Math.random() * s.y;
    pos[i * 3 + 2] = box.min.z + Math.random() * s.z;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  return new THREE.Points(geo, new THREE.PointsMaterial({ color, size: 0.04, transparent: true, opacity: 0.14, depthWrite: false, toneMapped: false }));
}

export function disposeTree(o: THREE.Object3D) {
  o.traverse((x) => {
    const m = x as THREE.Mesh;
    m.geometry?.dispose();
    const mat = m.material as THREE.Material | THREE.Material[] | undefined;
    if (Array.isArray(mat)) mat.forEach((y) => y.dispose());
    else mat?.dispose();
  });
}

/** 一站的焦点：取景、全亮绘制、字号检查都以它为准 */
export interface FocusSpec {
  /** 焦点物体（压暗背景后再全亮画一遍） */
  objects: THREE.Object3D[];
  /** 取景用的世界包围盒 */
  box: THREE.Box3;
  /** 取景与遮挡检查用的轮廓点（文字板用四个角，比包围盒更贴合）；不给时用包围盒的 8 个角 */
  pts?: THREE.Vector3[];
  /** 焦点上必须看清的最小字：世界高度与所在位置 */
  font: { size: number; at: THREE.Vector3 } | null;
  /** 首选观察方向（从相机指向焦点） */
  dir: THREE.Vector3;
  /** 焦点文字板（按屏幕像素提高分辨率） */
  plates: TextPlate[];
  /** 焦点在观察窗口里最多占的面积比例（小物体放大太多会显得笨重） */
  maxArea?: number;
}

/** 文字板上某个逻辑字号对应的世界高度 */
export const worldFont = (p: TextPlate, px: number) => (px * p.worldW) / p.w;

/** 平面文字板在世界里的四个角 */
export function planeCorners(m: THREE.Mesh): THREE.Vector3[] {
  m.updateMatrixWorld(true);
  const g = m.geometry as THREE.PlaneGeometry;
  const w = g.parameters.width / 2;
  const h = g.parameters.height / 2;
  return [
    [-w, -h],
    [w, -h],
    [w, h],
    [-w, h],
  ].map(([x, y]) => m.localToWorld(new THREE.Vector3(x, y, 0)));
}
