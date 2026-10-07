import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

const BUILD_ID = process.env.BUILD_ID ?? new Date().toISOString().replace(/\D/g, "").slice(0, 12);

export default defineConfig({
  plugins: [react()],
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
    chunkSizeWarningLimit: 800,
  },
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.ts"],
  },
});
