import type { FastifyPluginAsync } from "fastify";

const started = Date.now();

const health: FastifyPluginAsync = async (app) => {
  /** 存活探针：进程在就行 */
  app.get("/health/live", { config: { rateLimit: false } }, async () => ({ status: "ok" }));

  /** 就绪探针：检查数据库 */
  app.get("/health", { config: { rateLimit: false } }, async (_req, reply) => {
    try {
      await app.prisma.$queryRaw`SELECT 1`;
      return { status: "ok", db: "ok", uptimeSec: Math.round((Date.now() - started) / 1000), version: process.env.APP_VERSION ?? "1.0.0" };
    } catch {
      return reply.code(503).send({ status: "degraded", db: "down" });
    }
  });
};
export default health;
