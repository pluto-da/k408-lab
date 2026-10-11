import { defineConfig } from "tsup";

export default defineConfig({
  entry: { server: "src/server.ts" },
  format: ["esm"],
  target: "node20",
  platform: "node",
  outDir: "dist",
  clean: true,
  sourcemap: false, // 不产出 source map：生产镜像里不带源码映射
  // 共享包是 TS 源码，打进产物；其余依赖保持外部
  noExternal: ["@k408/shared"],
});
