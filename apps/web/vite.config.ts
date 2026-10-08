import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

const BUILD_ID = process.env.BUILD_ID ?? new Date().toISOString().replace(/\D/g, "").slice(0, 12);

export default defineConfig({
  plugins: [react()],
  // 整机拆解模块的压缩模型文件，作为带哈希的静态资源输出
  assetsInclude: ["**/*.sog"],
  define: {
    __BUILD_ID__: JSON.stringify(BUILD_ID),
  },
  server: {
    port: 5173,
    proxy: {
      "/api": { target: process.env.API_PROXY ?? "http://localhost:3000", changeOrigin: false },
    },
  },
  build: {
    target: "es2020",
    sourcemap: false,
    // 整机拆解的 3D 依赖（只在 /pc 懒加载）：单独成块便于缓存；spark 内嵌 wasm，体积天然偏大
    chunkSizeWarningLimit: 2600,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules/three/")) return "three";
          if (id.includes("@sparkjsdev/spark")) return "spark";
          return undefined;
        },
      },
    },
  },
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.ts"],
  },
});
