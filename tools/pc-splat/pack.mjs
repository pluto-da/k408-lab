// Compress baked PLYs to SOG and write the manifest consumed by apps/web/src/pc.
// usage: node tools/pc-splat/pack.mjs
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const build = join(here, "build");
const out = join(here, "..", "..", "apps", "web", "src", "pc", "assets");
const bin = join(here, "node_modules", ".bin", "splat-transform");
mkdirSync(out, { recursive: true });

const ext = JSON.parse(readFileSync(join(build, "meta", "exterior.json"), "utf8")).parts;
const manifest = { exterior: {}, interior: {} };
const manifestOnly = process.argv.includes("--manifest-only");
const plys = readdirSync(join(build, "ply")).filter((f) => f.endsWith(".ply"));
if (!manifestOnly) for (const f of readdirSync(out)) if (f.endsWith(".sog")) rmSync(join(out, f));
let total = 0;
for (const f of plys) {
  const name = f.replace(/\.ply$/, "");
  const dst = join(out, `${name}.sog`);
  if (!manifestOnly) execFileSync(bin, ["-q", "-w", "-g", "cpu", join(build, "ply", f), dst], { stdio: "inherit" });
  const bytes = statSync(dst).size;
  total += bytes;
  if (name.endsWith("_open")) {
    const part = name.slice(0, -5);
    const meta = JSON.parse(readFileSync(join(build, "meta", `${name}.json`), "utf8"));
    manifest.interior[part] = { ...meta, bytes };
  } else if (ext[name]) {
    manifest.exterior[name] = { ...ext[name], bytes };
  }
  console.log(`${name.padEnd(12)} ${String(manifest.exterior[name]?.count ?? manifest.interior[name.replace("_open", "")]?.count).padStart(8)} splats  ${(bytes / 1024).toFixed(0).padStart(6)} KB`);
}
writeFileSync(join(here, "..", "..", "apps", "web", "src", "pc", "manifest.json"), JSON.stringify(manifest, null, 1) + "\n");
console.log(`total ${(total / 1048576).toFixed(2)} MB`);
if (!existsSync(bin)) process.exit(1);
