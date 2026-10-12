import { inject } from "vitest";
import type { FastifyInstance, LightMyRequestResponse } from "fastify";
import { PrismaClient } from "@prisma/client";
import { buildApp } from "../src/app";
import { loadEnv } from "../src/env";

export interface Ctx {
  app: FastifyInstance;
  prisma: PrismaClient;
}

export async function makeApp(overrides: Record<string, string> = {}): Promise<Ctx> {
  const url = inject("databaseUrl");
  const env = loadEnv({
    NODE_ENV: "test",
    DATABASE_URL: url,
    JWT_SECRET: "test-secret-test-secret-test-secret-123",
    AUTH_RATE_LIMIT_MAX: "1000",
    REGISTER_RATE_LIMIT_MAX: "1000",
    LOG_LEVEL: "silent",
    ...overrides,
  });
  const prisma = new PrismaClient({ datasources: { db: { url } } });
  const app = await buildApp({ env, prisma, ownsPrisma: true, logger: false });
  await app.ready();
  return { app, prisma };
}

export async function resetDb(prisma: PrismaClient) {
  await prisma.$executeRawUnsafe(
    'TRUNCATE "User" RESTART IDENTITY CASCADE',
  );
}

export function cookieOf(res: LightMyRequestResponse): string {
  const raw = res.headers["set-cookie"];
  const list = Array.isArray(raw) ? raw : raw ? [raw] : [];
  const c = list.find((s) => s.startsWith("k408_session="));
  if (!c) throw new Error("响应中没有会话 Cookie");
  return c.split(";")[0]!;
}

let n = 0;
export async function registerUser(app: FastifyInstance, name?: string, nickname?: string) {
  const username = name ?? `user_${Date.now() % 100000}_${n++}`;
  const res = await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { username, password: "Lab408-pass", nickname: nickname ?? username },
  });
  if (res.statusCode !== 201) throw new Error(`注册失败 ${res.statusCode} ${res.body}`);
  const body = res.json() as { user: { id: string } };
  return { cookie: cookieOf(res), id: body.user.id, username };
}
