import type { FastifyPluginAsync } from "fastify";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { burnPasswordCheck, hashPassword, verifyPassword, weakPasswordReason } from "../lib/password";
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

const authRoutes: FastifyPluginAsync<{ rateMax: number; rateWindow: string; registerMax?: number; loginGuard?: LoginGuard; ipGuard?: LoginGuard }> = async (app, opts) => {
  const limited = { config: { rateLimit: { max: opts.rateMax, timeWindow: opts.rateWindow } } };
  // 注册：同一 IP 每小时最多 registerMax 个（另受每分钟 rateMax 限制，取更严的一个）
  const registerLimited = { config: { rateLimit: { max: Math.min(opts.registerMax ?? 10, opts.rateMax * 60), timeWindow: "1 hour" } } };
  // 两个维度的连续失败锁定：同一账号 10 次 / 15 分钟；同一 IP 30 次 / 15 分钟（宿舍共用出口放宽）。再次被锁时长逐次翻倍
  const guard = opts.loginGuard ?? new LoginGuard();
  const ipGuard = opts.ipGuard ?? new LoginGuard({ maxFailures: 30 });

  app.post("/register", registerLimited, async (req, reply) => {
    const body = registerSchema.parse(req.body);
    const weak = weakPasswordReason(body.password, body.username, body.email);
    if (weak) throw new HttpError(400, "WEAK_PASSWORD", weak);
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
      req.log.warn({ evt: "login_locked", ip: req.ip }, "账号暂时锁定");
      throw new HttpError(429, "ACCOUNT_LOCKED", `该账号密码错误次数过多，请 ${Math.ceil(wait / 60_000)} 分钟后再试`);
    }
    const ipWait = ipGuard.lockedFor(req.ip);
    if (ipWait > 0) {
      req.log.warn({ evt: "login_ip_locked", ip: req.ip }, "IP 暂时锁定");
      throw new HttpError(429, "IP_LOCKED", `登录失败次数过多，请 ${Math.ceil(ipWait / 60_000)} 分钟后再试`);
    }
    const failed = () => {
      guard.fail(key);
      ipGuard.fail(req.ip);
      // 安全事件：认证失败（不记录账号原文与密码）
      req.log.warn({ evt: "login_failed", ip: req.ip }, "登录失败");
      return new HttpError(401, "BAD_CREDENTIALS", "账号或密码错误");
    };
    const user = await app.prisma.user.findUnique({ where: key.includes("@") ? { email: key } : { username: key } });
    if (!user) {
      await burnPasswordCheck(password);
      throw failed();
    }
    if (!(await verifyPassword(user.passwordHash, password))) throw failed();
    guard.succeed(key);
    await app.issueSession(reply, user);
    return { user: toPublicUser(user) };
  });

  app.post("/logout", async (_req, reply) => {
    app.clearSession(reply);
    return { ok: true };
  });

  /** 退出所有设备：tokenVersion +1，此前签发的所有会话（包括本机）立即失效 */
  app.post("/logout-all", limited, async (req, reply) => {
    const user = await app.requireUser(req);
    await app.prisma.user.update({ where: { id: user.id }, data: { tokenVersion: { increment: 1 } } });
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
