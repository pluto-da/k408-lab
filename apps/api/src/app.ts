import Fastify, { type FastifyInstance, type FastifyServerOptions } from "fastify";
import cookie from "@fastify/cookie";
import rateLimit from "@fastify/rate-limit";
import type { PrismaClient } from "@prisma/client";
import { ZodError } from "zod";
import type { Env } from "./env";
import { HttpError } from "./lib/errors";
import prismaPlugin from "./plugins/prisma";
import authPlugin from "./plugins/auth";
import healthRoutes from "./routes/health";
import authRoutes from "./routes/auth";
import meRoutes from "./routes/me";
import eventRoutes from "./routes/events";
import progressRoutes from "./routes/progress";
import mistakeRoutes from "./routes/mistakes";
import leaderboardRoutes from "./routes/leaderboard";
import questionRoutes from "./routes/questions";

export interface BuildOptions {
  env: Env;
  prisma: PrismaClient;
  /** 关闭 app 时是否断开 prisma（测试中共享连接时传 false） */
  ownsPrisma?: boolean;
  logger?: FastifyServerOptions["logger"];
}

const UNSAFE = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export async function buildApp(opts: BuildOptions): Promise<FastifyInstance> {
  const { env } = opts;
  const app = Fastify({
    logger: opts.logger ?? { level: env.LOG_LEVEL, redact: ["req.headers.cookie", "req.headers.authorization"] },
    trustProxy: env.trustProxy,
    bodyLimit: 256 * 1024,
  });

  await app.register(prismaPlugin, { client: opts.prisma, disconnectOnClose: opts.ownsPrisma ?? true });
  await app.register(cookie);
  await app.register(rateLimit, {
    global: true,
    max: 300,
    timeWindow: "1 minute",
    errorResponseBuilder: (_req, ctx) => ({
      statusCode: ctx.statusCode,
      error: { code: "RATE_LIMITED", message: `操作太频繁，请 ${Math.ceil(ctx.ttl / 1000)} 秒后再试` },
    }),
  });
  await app.register(authPlugin, { secret: env.JWT_SECRET, secure: env.cookieSecure });

  // 简单的跨站请求防护：带 Origin 的写请求必须与 Host 同源（Cookie 另有 SameSite=Lax）
  app.addHook("onRequest", async (req, reply) => {
    if (!UNSAFE.has(req.method)) return;
    const origin = req.headers.origin;
    if (!origin) return;
    let host: string;
    try {
      host = new URL(origin).host;
    } catch {
      host = "";
    }
    const expected = (req.headers["x-forwarded-host"] as string | undefined) ?? req.headers.host;
    if (!expected || host !== expected) {
      return reply.code(403).send({ error: { code: "BAD_ORIGIN", message: "请求来源不被允许" } });
    }
  });

  app.setErrorHandler((err, req, reply) => {
    if (err instanceof HttpError) {
      return reply.code(err.statusCode).send({ error: { code: err.code, message: err.message } });
    }
    if (err instanceof ZodError) {
      const first = err.issues[0];
      const field = first?.path.join(".");
      return reply.code(400).send({
        error: { code: "VALIDATION", message: first ? `${field ? field + "：" : ""}${first.message}` : "参数错误", issues: err.issues },
      });
    }
    const e = err as { statusCode?: number; message?: string };
    const status = e.statusCode ?? 500;
    if (status === 429) return reply.code(429).send(err);
    if (status >= 500) req.log.error(err);
    return reply.code(status).send({
      error: { code: status >= 500 ? "INTERNAL" : "REQUEST_ERROR", message: status >= 500 ? "服务器开小差了，请稍后再试" : (e.message ?? "请求错误") },
    });
  });

  app.setNotFoundHandler((_req, reply) => reply.code(404).send({ error: { code: "NOT_FOUND", message: "接口不存在" } }));

  await app.register(
    async (api) => {
      await api.register(healthRoutes);
      await api.register(authRoutes, { prefix: "/auth", rateMax: env.AUTH_RATE_LIMIT_MAX, rateWindow: env.AUTH_RATE_LIMIT_WINDOW });
      await api.register(meRoutes);
      await api.register(eventRoutes);
      await api.register(progressRoutes);
      await api.register(mistakeRoutes);
      await api.register(leaderboardRoutes);
      await api.register(questionRoutes);
    },
    { prefix: "/api" },
  );

  return app;
}
