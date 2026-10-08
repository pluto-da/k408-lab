import type { FastifyPluginAsync } from "fastify";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { burnPasswordCheck, hashPassword, verifyPassword } from "../lib/password";
import { conflict, HttpError } from "../lib/errors";
import { toPublicUser } from "../plugins/auth";
import { LoginGuard } from "../lib/login-guard";

const usernameSchema = z
  .string()
  .trim()
  .min(3, "用户名至少 3 个字符")
  .max(20, "用户名最多 20 个字符")
  .regex(/^[A-Za-z0-9_\u4e00-\u9fa5]+$/, "用户名只能包含字母、数字、下划线或汉字")
  .transform((s) => s.toLowerCase());
const emailSchema = z.string().trim().toLowerCase().email("邮箱格式不正确").max(120);
const passwordSchema = z.string().min(8, "密码至少 8 位").max(72, "密码最多 72 位");
export const nicknameSchema = z.string().trim().min(1, "昵称不能为空").max(20, "昵称最多 20 个字符");

/** 表单里留空的可选项按“未填写”处理 */
const blankToUndef = <T extends z.ZodTypeAny>(schema: T) =>
  z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? undefined : v), schema);

const registerSchema = z
  .object({
    username: blankToUndef(usernameSchema.optional()),
    email: blankToUndef(emailSchema.optional()),
    password: passwordSchema,
    nickname: blankToUndef(nicknameSchema.optional()),
  })
  .refine((v) => v.username || v.email, { message: "用户名和邮箱至少填写一个", path: ["username"] });

const loginSchema = z.object({
  account: z.string().trim().min(1, "请输入用户名或邮箱").max(120),
  password: z.string().min(1, "请输入密码").max(72),
});

const authRoutes: FastifyPluginAsync<{ rateMax: number; rateWindow: string; loginGuard?: LoginGuard }> = async (app, opts) => {
  const limited = { config: { rateLimit: { max: opts.rateMax, timeWindow: opts.rateWindow } } };
  const guard = opts.loginGuard ?? new LoginGuard();

  app.post("/register", limited, async (req, reply) => {
    const body = registerSchema.parse(req.body);
    const nickname = body.nickname ?? body.username ?? body.email!.split("@")[0]!.slice(0, 20);
    try {
      const user = await app.prisma.user.create({
        data: {
          username: body.username ?? null,
          email: body.email ?? null,
          passwordHash: await hashPassword(body.password),
          nickname,
        },
      });
      await app.issueSession(reply, user);
      return reply.code(201).send({ user: toPublicUser(user) });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        const target = String((e.meta as { target?: string[] } | undefined)?.target ?? "");
        throw conflict(target.includes("email") ? "该邮箱已注册" : "该用户名已被占用", "ACCOUNT_EXISTS");
      }
      throw e;
    }
  });

  app.post("/login", limited, async (req, reply) => {
    const { account, password } = loginSchema.parse(req.body);
    const key = account.toLowerCase();
    const wait = guard.lockedFor(key);
    if (wait > 0) {
      throw new HttpError(429, "ACCOUNT_LOCKED", `该账号密码错误次数过多，请 ${Math.ceil(wait / 60_000)} 分钟后再试`);
    }
    const user = await app.prisma.user.findUnique({ where: key.includes("@") ? { email: key } : { username: key } });
    if (!user) {
      await burnPasswordCheck(password);
      guard.fail(key);
      throw new HttpError(401, "BAD_CREDENTIALS", "账号或密码错误");
    }
    if (!(await verifyPassword(user.passwordHash, password))) {
      guard.fail(key);
      throw new HttpError(401, "BAD_CREDENTIALS", "账号或密码错误");
    }
    guard.succeed(key);
    await app.issueSession(reply, user);
    return { user: toPublicUser(user) };
  });

  app.post("/logout", async (_req, reply) => {
    app.clearSession(reply);
    return { ok: true };
  });

  // —— 手机号短信登录：接口预留，v1 未开放（见 src/lib/sms.ts）——
  const notYet = () => {
    throw new HttpError(501, "SMS_NOT_AVAILABLE", "手机号登录暂未开放，敬请期待");
  };
  app.post("/sms/send", limited, async () => notYet());
  app.post("/sms/login", limited, async () => notYet());

  app.get("/methods", async () => ({ password: true, sms: false }));
};
export default authRoutes;
