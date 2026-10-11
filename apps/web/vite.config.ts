import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import type { Plugin } from "vite";

const BUILD_ID = process.env.BUILD_ID ?? new Date().toISOString().replace(/\D/g, "").slice(0, 12);

/** 站点根地址（如 https://k408.example.com）。设置后生成 sitemap.xml 并写进 robots.txt；未设置时只输出 robots.txt */
const SITE_URL = (process.env.SITE_URL ?? "").trim().replace(/\/+$/, "");
/** 可被搜索引擎收录的页面 */
const PUBLIC_ROUTES = ["/", "/lab", "/pc", "/terms", "/privacy"];

function seoFiles(): Plugin {
  return {
    name: "k408-seo-files",
    apply: "build",
    generateBundle() {
      const robots = ["User-agent: *", "Allow: /", "Disallow: /api/", "Disallow: /login", "Disallow: /register", "Disallow: /profile"];
      if (SITE_URL) {
        robots.push("", `Sitemap: ${SITE_URL}/sitemap.xml`);
        const today = new Date().toISOString().slice(0, 10);
        const urls = PUBLIC_ROUTES.map((r) => `  <url><loc>${SITE_URL}${r}</loc><lastmod>${today}</lastmod></url>`).join("\n");
        this.emitFile({
          type: "asset",
          fileName: "sitemap.xml",
          source: `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`,
        });
      }
      this.emitFile({ type: "asset", fileName: "robots.txt", source: robots.join("\n") + "\n" });
    },
  };
}

export default defineConfig({
  plugins: [react(), seoFiles()],
  // 整机拆解模块的压缩模型文件，作为带哈希的静态资源输出
  assetsInclude: ["**/*.sog"],
  define: {
    __BUILD_ID__: JSON.stringify(BUILD_ID),
    // 化身数据的自动检查接口：只在 RIDE_AUDIT=1 的测试构建里打开，生产构建中整段代码被摇树删除
    __RIDE_AUDIT__: JSON.stringify(process.env.RIDE_AUDIT === "1"),
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
