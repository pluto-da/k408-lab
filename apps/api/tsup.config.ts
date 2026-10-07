import { defineConfig } from "tsup";

export default defineConfig({
  entry: { server: "src/server.ts", seed: "prisma/seed.ts" },
  format: ["esm"],
  target: "node20",
  platform: "node",
  outDir: "dist",
  clean: true,
  sourcemap: true,
  // 共享包是 TS 源码，打进产物；其余依赖保持外部
  noExternal: ["@k408/shared"],
});
