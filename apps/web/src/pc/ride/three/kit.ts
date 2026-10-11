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
  ok: "#4CE38A",
  bad: "#FF5A5A",
  ink: "#E9EAEE",
  dim: "#7C8290",
};

export const TONE: Record<string, string> = {
  vpn: C.membus,
  off: "#46D2FF",
  tag: C.power,
  set: C.nic,
  frame: C.alu,
  dir: C.pcie,
  tbl: C.dmi,
  data: "#F4F5F7",
  plain: "#F4F5F7",
};

export const FONT = `"PingFang SC","Hiragino Sans GB","Microsoft YaHei","Noto Sans CJK SC","WenQuanYi Micro Hei",system-ui,sans-serif`;
export const MONO = `"Geist Mono",ui-monospace,"SFMono-Regular",Menlo,Consolas,${FONT}`;

/** 画字的平面：canvas 贴图，内容变化时重画 */
export class TextPlate {
  readonly canvas: HTMLCanvasElement;
  readonly ctx: CanvasRenderingContext2D;
  readonly tex: THREE.CanvasTexture;
  readonly mesh: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
  readonly w: number;
  readonly h: number;
  private key = "";

  constructor(pxW: number, pxH: number, worldW: number, scale = 1) {
    this.w = pxW;
    this.h = pxH;
    this.canvas = document.createElement("canvas");
    this.canvas.width = Math.round(pxW * scale);
    this.canvas.height = Math.round(pxH * scale);
    this.ctx = this.canvas.getContext("2d")!;
    this.ctx.scale(scale, scale);
    this.tex = new THREE.CanvasTexture(this.canvas);
    this.tex.colorSpace = THREE.SRGBColorSpace;
    this.tex.anisotropy = 4;
    const mat = new THREE.MeshBasicMaterial({ map: this.tex, transparent: true, depthWrite: false, toneMapped: false, side: THREE.FrontSide });
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(worldW, (worldW * pxH) / pxW), mat);
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

export function rr(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

export function panelBg(g: CanvasRenderingContext2D, w: number, h: number, accent: string, alpha = 0.82) {
  rr(g, 2, 2, w - 4, h - 4, 18);
  g.fillStyle = `rgba(14,17,23,${alpha})`;
  g.fill();
  g.lineWidth = 2;
  g.strokeStyle = "rgba(255,255,255,0.14)";
  g.stroke();
  g.fillStyle = accent;
  g.fillRect(2, 18, 6, h - 36);
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
        gl_FragColor = vec4(uColor, (l*0.16 + l2*0.28) * fade); }`,
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
      g.fillStyle = this.state === "on" ? "rgba(20,26,22,0.92)" : "rgba(14,17,23,0.85)";
      g.fill();
      g.lineWidth = 3;
      g.strokeStyle = this.state === "off" ? "rgba(255,255,255,0.12)" : "#" + this.color.getHexString();
      g.stroke();
      text(g, t, w / 2, h / 2 + 1, 34, this.state === "off" ? "rgba(233,234,238,0.45)" : C.ink, 600, "center");
    });
  }

  set(state: "idle" | "on" | "off", time = 0) {
    if (state !== this.state) {
      this.state = state;
      this.drawLabel(this.text0);
    }
    const pulse = state === "on" ? 0.5 + 0.5 * Math.sin(time * 5) : 0;
    this.frame.material.opacity = state === "off" ? 0.18 : state === "on" ? 1 : 0.6;
    this.glow.material.opacity = state === "on" ? 0.18 + 0.2 * pulse : state === "off" ? 0.02 : 0.08;
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
  return new THREE.Points(geo, new THREE.PointsMaterial({ color, size: 0.05, transparent: true, opacity: 0.5, depthWrite: false, toneMapped: false }));
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
