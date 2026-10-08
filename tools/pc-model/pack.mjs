// Compress the exported GLBs (meshopt, quantised) + convert the textures they use to WebP,
// and write the manifest consumed by apps/web/src/pc.
// usage: node tools/pc-model/pack.mjs     (needs: npm install here, python3 with Pillow)
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const build = join(here, "build");
const web = join(here, "..", "..", "apps", "web", "src", "pc");
const out = join(web, "assets");
const gltfpack = join(here, "node_modules", ".bin", "gltfpack");
mkdirSync(out, { recursive: true });
for (const f of readdirSync(out)) rmSync(join(out, f));

const ext = JSON.parse(readFileSync(join(build, "meta", "exterior.json"), "utf8")).parts;
const mats = JSON.parse(readFileSync(join(build, "meta", "materials.json"), "utf8"));
const manifest = { exterior: {}, interior: {}, materials: {}, textures: {} };
let closed = 0;
let total = 0;
for (const f of readdirSync(join(build, "glb")).filter((f) => f.endsWith(".glb")).sort()) {
  const name = f.replace(/\.glb$/, "");
  const dst = join(out, `${name}.glb`);
  // -cc: meshopt compression; -kn/-km keep node + material names; -kv keep UVs (the viewer maps textures itself).
  // Positions / normals / UVs stay float: int16 positions and int8 normals crash some software GL drivers;
  // the baked AO colour is 8 bit. The server gzips/zstds the files on top (≈ 4.4 MB for the closed PC).
  execFileSync(gltfpack, ["-i", join(build, "glb", f), "-o", dst, "-cc", "-km", "-kn", "-kv", "-vpf", "-vtf", "-vnf", "-vc", "8"], { stdio: "pipe" });
  const bytes = statSync(dst).size;
  total += bytes;
  if (name.endsWith("_open")) {
    const part = name.slice(0, -5);
    const meta = JSON.parse(readFileSync(join(build, "meta", `${name}.json`), "utf8"));
    manifest.interior[part] = { ...meta, bytes };
  } else if (ext[name]) {
    manifest.exterior[name] = { ...ext[name], bytes };
    closed += bytes;
  }
  console.log(`${name.padEnd(12)} ${(bytes / 1024).toFixed(0).padStart(6)} KB`);
}

// textures referenced by materials (+ the tileable finish maps) -> WebP
const texSet = new Set(Object.values(mats).map((m) => m.tex).filter(Boolean));
for (const t of ["fin_brushed.png", "fin_powder.png", "fin_braid.png", "fin_mesh.png"]) texSet.add(t);
const list = [...texSet].sort();
const py = `
import sys, os
from PIL import Image
src, dst = sys.argv[1], sys.argv[2]
for name in sys.argv[3:]:
    im = Image.open(os.path.join(src, name))
    grey = name.startswith("fin_")
    im = im.convert("L" if grey else "RGB")
    w, h = im.size
    s = min(1.0, 2048 / max(w, h))
    if s < 1: im = im.resize((max(1, int(w * s)), max(1, int(h * s))), Image.LANCZOS)
    o = os.path.join(dst, name.replace(".png", ".webp"))
    im.save(o, "WEBP", quality=90 if not grey else 85, method=6)
    print(name, im.size, os.path.getsize(o) // 1024, "KB")
`;
execFileSync(process.env.PYTHON || "python3", ["-c", py, join(build, "tex"), out, ...list], { stdio: "inherit" });
let texBytes = 0;
for (const t of list) {
  const w = t.replace(".png", ".webp");
  const b = statSync(join(out, w)).size;
  texBytes += b;
  manifest.textures[t.replace(".png", "")] = b;
}
for (const [k, m] of Object.entries(mats)) {
  manifest.materials[k] = { ...m, tex: m.tex ? m.tex.replace(".png", "") : undefined };
}
writeFileSync(join(web, "manifest.json"), JSON.stringify(manifest, null, 1) + "\n");
console.log(`closed ${(closed / 1048576).toFixed(2)} MB  all meshes ${(total / 1048576).toFixed(2)} MB  textures ${(texBytes / 1048576).toFixed(2)} MB`);
