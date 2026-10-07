import fp from "fastify-plugin";
import fastifyJwt from "@fastify/jwt";
import type { FastifyReply, FastifyRequest } from "fastify";
import type { User } from "@prisma/client";
import type { PublicUser } from "@k408/shared";
import { unauthorized } from "../lib/errors";

export const COOKIE_NAME = "k408_session";
const MAX_AGE_S = 30 * 24 * 3600;

declare module "@fastify/jwt" {
  interface FastifyJWT {
    payload: { sub: string; tv: number };
    user: { sub: string; tv: number };
  }
}

declare module "fastify" {
  interface FastifyInstance {
    requireUser: (req: FastifyRequest) => Promise<User>;
    optionalUser: (req: FastifyRequest) => Promise<User | null>;
    issueSession: (reply: FastifyReply, user: User) => Promise<void>;
    clearSession: (reply: FastifyReply) => void;
  }
}

export function toPublicUser(u: User): PublicUser {
  return { id: u.id, username: u.username, email: u.email, nickname: u.nickname, createdAt: u.createdAt.toISOString() };
}

export default fp<{ secret: string; secure: boolean }>(async (app, opts) => {
  await app.register(fastifyJwt, {
    secret: opts.secret,
    cookie: { cookieName: COOKIE_NAME, signed: false },
    sign: { expiresIn: `${MAX_AGE_S}s` },
  });

  async function optionalUser(req: FastifyRequest): Promise<User | null> {
    if (!req.cookies[COOKIE_NAME]) return null;
    try {
      const payload = await req.jwtVerify<{ sub: string; tv: number }>();
      const user = await app.prisma.user.findUnique({ where: { id: payload.sub } });
      if (!user || user.tokenVersion !== payload.tv) return null;
      return user;
    } catch {
      return null;
    }
  }

  app.decorate("optionalUser", optionalUser);
  app.decorate("requireUser", async (req: FastifyRequest) => {
    const u = await optionalUser(req);
    if (!u) throw unauthorized();
    return u;
  });
  app.decorate("issueSession", async (reply: FastifyReply, user: User) => {
    const token = await reply.jwtSign({ sub: user.id, tv: user.tokenVersion });
    reply.setCookie(COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: opts.secure,
      path: "/",
      maxAge: MAX_AGE_S,
    });
  });
  app.decorate("clearSession", (reply: FastifyReply) => {
    reply.clearCookie(COOKIE_NAME, { path: "/", httpOnly: true, sameSite: "lax", secure: opts.secure });
  });
});
