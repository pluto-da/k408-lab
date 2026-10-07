import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globalSetup: ["./test/global-setup.ts"],
    include: ["test/**/*.test.ts"],
    // 所有测试文件共享一个数据库，串行执行避免互相清表
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 120_000,
  },
});
