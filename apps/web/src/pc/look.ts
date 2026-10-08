// 整机拆解：材质、影棚环境光与灯效。所有贴图都是本站文件，环境光在浏览器里即时生成。
import * as THREE from "three";

export interface MatDef {
  color: [number, number, number];
  metal: number;
  rough: number;
  tex?: string;
  tex_side?: string;
  emit?: number;
  kind?: "brushed" | "powder" | "glass" | "braid" | "rgb" | "pcb" | "rubber" | "mesh";
  coat?: number;
}

/** Shared uniforms for every material (灯效 + 烘焙 AO 强度). */
export const LOOK = {
  uTime: { value: 0 },
  uRgb: { value: 0 }, // 0 = studio, 1 = RGB ambient
  uRgbMode: { value: 0 }, // 0 rainbow flow, 1 solid colour, 2 breathing
  uRgbColor: { value: new THREE.Color("#7a5cff") },
  uAoStrength: { value: 1 },
};

const AO_VS_HEAD = /* glsl */ `
  attribute vec4 color;
  varying float vAoBake;
  varying vec3 vWPos;
`;
const AO_VS_MAIN = /* glsl */ `
  vAoBake = color.r;
  vWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
`;
const AO_FS_HEAD = /* glsl */ `
  varying float vAoBake;
  varying vec3 vWPos;
  uniform float uAoStrength;
  uniform float uTime;
  uniform float uRgb;
  uniform float uRgbMode;
  uniform vec3 uRgbColor;
  uniform float uHover;
  uniform float uFade;
  vec3 hue2rgb(float h) { vec3 k = clamp(abs(fract(h + vec3(0.0, 2.0/3.0, 1.0/3.0)) * 6.0 - 3.0) - 1.0, 0.0, 1.0); return k * k * (3.0 - 2.0 * k); }
`;
const AO_FS_APPLY = /* glsl */ `
  #include <aomap_fragment>
  {
    float aoB = mix(1.0, clamp(vAoBake, 0.0, 1.0), uAoStrength);
    float aoS = aoB * aoB;
    reflectedLight.indirectDiffuse *= aoB;
    reflectedLight.indirectSpecular *= mix(1.0, aoS, 0.9);
    reflectedLight.directDiffuse *= mix(1.0, aoB, 0.6);
    reflectedLight.directSpecular *= mix(1.0, aoS, 0.6);
  }
`;
const RGB_EMISSIVE = /* glsl */ `
  #include <emissivemap_fragment>
  {
    float flow = fract(vWPos.y * 2.2 + vWPos.z * 1.3 - uTime * 0.18);
    vec3 rainbow = hue2rgb(flow);
    float breathe = 0.55 + 0.45 * sin(uTime * 2.2);
    vec3 c = uRgbMode < 0.5 ? rainbow : uRgbColor * (uRgbMode > 1.5 ? breathe : 1.0);
    totalEmissiveRadiance = mix(vec3(0.12), c * 3.2, uRgb);
  }
`;

// Screen-door fade: parts fade in/out by discarding a dithered share of pixels, so materials stay opaque
// (no transparent <-> opaque switch, which would recompile every shader mid-animation and stall the frame).
const FADE_FS = /* glsl */ `
  #include <clipping_planes_fragment>
  if (uFade < 0.999) {
    float n = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));
    if (n >= uFade) discard;
  }
`;

function patch(mat: THREE.Material, rgb: boolean, hover: { value: number }) {
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, LOOK, { uHover: hover, uFade: { value: 1 } });
    sh.vertexShader = sh.vertexShader
      .replace("#include <common>", "#include <common>\n" + AO_VS_HEAD)
      .replace("#include <fog_vertex>", "#include <fog_vertex>\n" + AO_VS_MAIN);
    let fs = sh.fragmentShader
      .replace("#include <common>", "#include <common>\n" + AO_FS_HEAD)
      .replace("#include <clipping_planes_fragment>", FADE_FS)
      .replace("#include <aomap_fragment>", AO_FS_APPLY)
      .replace("#include <opaque_fragment>", "outgoingLight += diffuseColor.rgb * uHover * 0.12;\n#include <opaque_fragment>");
    if (rgb) fs = fs.replace("#include <emissivemap_fragment>", RGB_EMISSIVE);
    sh.fragmentShader = fs;
  };
  mat.customProgramCacheKey = () => (rgb ? "pc-rgb" : "pc-ao");
}

export class TextureBank {
  private cache = new Map<string, Promise<THREE.Texture>>();
  private loader = new THREE.TextureLoader();
  constructor(
    private urlOf: (name: string) => string,
    private maxAniso: number,
  ) {}

  get(name: string, color: boolean, repeat = false): Promise<THREE.Texture> {
    const key = name + (repeat ? "@r" : "");
    let p = this.cache.get(key);
    if (!p) {
      p = this.loader.loadAsync(this.urlOf(name)).then((t) => {
        t.colorSpace = color ? THREE.SRGBColorSpace : THREE.NoColorSpace;
        t.anisotropy = this.maxAniso;
        t.flipY = false; // glTF UV convention
        if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
        else t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
        t.needsUpdate = true;
        return t;
      });
      this.cache.set(key, p);
    }
    return p;
  }

  dispose() {
    for (const p of this.cache.values()) void p.then((t) => t.dispose());
    this.cache.clear();
  }
}

const srgb = (c: [number, number, number]) => new THREE.Color().setRGB(c[0] / 255, c[1] / 255, c[2] / 255, THREE.SRGBColorSpace);

/** Builds one physically based material from the exported definition. */
export async function makeMaterial(name: string, d: MatDef | undefined, bank: TextureBank, hover: { value: number }): Promise<THREE.MeshPhysicalMaterial> {
  const def: MatDef = d ?? { color: [128, 128, 128], metal: 0, rough: 0.5 };
  const m = new THREE.MeshPhysicalMaterial({
    name,
    color: srgb(def.color),
    metalness: def.metal,
    roughness: def.rough,
  });
  const jobs: Promise<unknown>[] = [];
  if (def.tex) {
    jobs.push(bank.get(def.tex, true).then((t) => {
      m.map = t;
      m.color.set(0xffffff);
    }));
    // PCB textures carry their own solder-mask colour, labels are lacquered paper
  }
  if (def.coat) {
    m.clearcoat = def.coat;
    m.clearcoatRoughness = 0.12;
  }
  switch (def.kind) {
    case "brushed":
      jobs.push(bank.get("fin_brushed", false, true).then((t) => {
        m.bumpMap = t;
        m.bumpScale = 0.04;
        m.roughnessMap = t;
      }));
      m.roughness = Math.min(1, def.rough * 1.15);
      break;
    case "powder":
      jobs.push(bank.get("fin_powder", false, true).then((t) => {
        m.bumpMap = t;
        m.bumpScale = 0.025;
      }));
      break;
    case "braid":
      jobs.push(bank.get("fin_braid", false, true).then((t) => {
        m.bumpMap = t;
        m.bumpScale = 0.5;
        m.roughnessMap = t;
      }));
      m.sheen = 0.5;
      m.sheenRoughness = 0.5;
      m.sheenColor = new THREE.Color(0.35, 0.36, 0.42);
      break;
    case "mesh":
      jobs.push(bank.get("fin_mesh", false, true).then((t) => {
        m.map = t;
        m.bumpMap = t;
        m.bumpScale = 0.15;
      }));
      break;
    case "rubber":
      break;
    case "pcb":
      m.clearcoat = Math.max(m.clearcoat, 0.45);
      m.clearcoatRoughness = 0.18;
      break;
  }
  if (def.kind === "rgb") {
    m.emissive = new THREE.Color(1, 1, 1);
    m.emissiveIntensity = 1;
    m.roughness = 0.4;
    m.transmission = 0;
  } else if (def.emit) {
    m.emissive = srgb(def.color);
    m.emissiveIntensity = def.emit * 1.2;
  }
  m.envMapIntensity = def.metal > 0.5 ? 1.0 : 0.85;
  patch(m, def.kind === "rgb", hover);
  await Promise.all(jobs);
  return m;
}

/**
 * A product-photography studio, generated in the browser: dark cyclorama with a large soft key
 * (top-left-front), two tall strip lights behind the subject (rim highlights on metal and glass edges),
 * a gentle fill and a warm floor bounce. Pre-filtered once into an environment map.
 */
export function buildStudioEnv(renderer: THREE.WebGLRenderer): THREE.Texture {
  const scene = new THREE.Scene();
  const room = new THREE.Mesh(
    new THREE.SphereGeometry(10, 48, 24),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      vertexShader: `varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
      fragmentShader: `varying vec3 vP; void main(){ vec3 d = normalize(vP);
        float up = d.y*0.5+0.5;
        vec3 c = mix(vec3(0.020,0.021,0.024), vec3(0.075,0.078,0.088), smoothstep(0.35, 1.0, up));
        c += vec3(0.05,0.045,0.04) * smoothstep(0.45, 0.0, up) * 0.6;
        gl_FragColor = vec4(c, 1.0); }`,
    }),
  );
  scene.add(room);
  const panel = (w: number, h: number, pos: THREE.Vector3, intensity: number, tint = new THREE.Color(1, 1, 1)) => {
    const mat = new THREE.MeshBasicMaterial({ color: tint.clone().multiplyScalar(intensity), side: THREE.DoubleSide });
    const p = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
    p.position.copy(pos);
    p.lookAt(0, 0.4, 0);
    scene.add(p);
  };
  panel(5.0, 3.2, new THREE.Vector3(-4.2, 6.0, 4.5), 9.0, new THREE.Color(1.0, 0.98, 0.95)); // key softbox
  panel(0.7, 7.0, new THREE.Vector3(-5.5, 2.5, -5.0), 14.0); // rim strip L
  panel(0.7, 7.0, new THREE.Vector3(5.8, 2.5, -4.6), 12.0, new THREE.Color(0.92, 0.96, 1.0)); // rim strip R
  panel(6.0, 2.4, new THREE.Vector3(6.5, 2.2, 3.5), 1.6, new THREE.Color(0.9, 0.95, 1.0)); // fill
  panel(8.0, 8.0, new THREE.Vector3(0, 9.5, 0), 1.2); // overhead scrim
  const pmrem = new THREE.PMREMGenerator(renderer);
  const rt = pmrem.fromScene(scene, 0.035);
  pmrem.dispose();
  scene.traverse((o) => {
    const m = o as THREE.Mesh;
    m.geometry?.dispose();
    (m.material as THREE.Material | undefined)?.dispose();
  });
  return rt.texture;
}

/** Light glass: dark tint layer + additive reflection layer (fresnel picks up the studio strips). */
export function buildGlass(w: number, h: number, env: THREE.Texture): { group: THREE.Group; setOpacity: (o: number) => void } {
  const group = new THREE.Group();
  // tint: darker toward the edges (like real tempered glass seen at an angle)
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const g = c.getContext("2d")!;
  const grd = g.createRadialGradient(32, 32, 6, 32, 32, 46);
  grd.addColorStop(0, "#5a5a5a");
  grd.addColorStop(1, "#c8c8c8");
  g.fillStyle = grd;
  g.fillRect(0, 0, 64, 64);
  const alpha = new THREE.CanvasTexture(c);
  const tint = new THREE.MeshBasicMaterial({
    color: new THREE.Color(0.02, 0.025, 0.03),
    transparent: true,
    opacity: 0.32,
    alphaMap: alpha,
    depthWrite: false,
  });
  const refl = new THREE.MeshPhysicalMaterial({
    color: 0x000000,
    metalness: 0,
    roughness: 0.03,
    envMap: env,
    envMapIntensity: 2.8,
    clearcoat: 1,
    clearcoatRoughness: 0.02,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const geo = new THREE.PlaneGeometry(w, h);
  const a = new THREE.Mesh(geo, tint);
  const b = new THREE.Mesh(geo, refl);
  a.renderOrder = 900;
  b.renderOrder = 901;
  group.add(a, b);
  const setOpacity = (o: number) => {
    tint.opacity = 0.32 * o;
    refl.opacity = o;
    refl.envMapIntensity = 2.8 * o;
    group.visible = o > 0.005;
  };
  return { group, setOpacity };
}
