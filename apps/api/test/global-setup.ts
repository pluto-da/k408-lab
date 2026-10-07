import { execSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { GlobalSetupContext } from "vitest/node";

/**
 * 集成测试数据库：
 * - 设置了 TEST_DATABASE_URL（如 CI 中的 postgres:16 容器）就直接用；
 * - 否则用 embedded-postgres 在本机临时目录拉起一个真实的 PostgreSQL 16。
 * 然后执行 prisma migrate deploy，确保测试走的就是生产迁移脚本。
 */
export default async function setup({ provide }: GlobalSetupContext) {
  let url = process.env.TEST_DATABASE_URL;
  let teardown = async () => {};
  if (!url) {
    const { default: EmbeddedPostgres } = await import("embedded-postgres");
    const dir = mkdtempSync(join(tmpdir(), "k408-pg-"));
    const port = 15432 + Math.floor(Math.random() * 1000);
    const pg = new EmbeddedPostgres({ databaseDir: dir, user: "k408", password: "k408", port, persistent: false, onLog: () => {} });
    await pg.initialise();
    await pg.start();
    await pg.createDatabase("k408_test");
    url = `postgresql://k408:k408@127.0.0.1:${port}/k408_test`;
    teardown = async () => {
      await pg.stop();
      rmSync(dir, { recursive: true, force: true });
    };
  }
  execSync("pnpm exec prisma migrate deploy", { env: { ...process.env, DATABASE_URL: url }, stdio: "pipe" });
  provide("databaseUrl", url);
  return teardown;
}

declare module "vitest" {
  export interface ProvidedContext {
    databaseUrl: string;
  }
}
