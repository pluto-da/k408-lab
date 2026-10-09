import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { loadEnv } from "./env";
import { createPrisma } from "./db";
import { buildApp } from "./app";

/** 本地开发时读取仓库根目录的 .env（Docker 部署由 compose 注入环境变量） */
function loadDotEnv() {
  if (process.env.NODE_ENV === "production") return;
  const file = fileURLToPath(new URL("../../../.env", import.meta.url));
  if (existsSync(file)) process.loadEnvFile(file);
}

async function main() {
  loadDotEnv();
  const env = loadEnv();
  const prisma = createPrisma();
  const app = await buildApp({ env, prisma });
  const close = async (signal: string) => {
    app.log.info(`收到 ${signal}，正在关闭`);
    await app.close();
    process.exit(0);
  };
  process.on("SIGTERM", () => void close("SIGTERM"));
  process.on("SIGINT", () => void close("SIGINT"));
  await app.listen({ host: env.HOST, port: env.PORT });
}

main().catch((e: unknown) => {
  console.error(e);
  process.exit(1);
});
