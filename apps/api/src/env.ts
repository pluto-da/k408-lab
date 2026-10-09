import { z } from "zod";

const bool = z
  .enum(["true", "false", "1", "0", ""])
  .optional()
  .transform((v) => (v === undefined || v === "" ? undefined : v === "true" || v === "1"));

const schema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  HOST: z.string().default("0.0.0.0"),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().min(1, "缺少 DATABASE_URL"),
  JWT_SECRET: z.string().min(32, "JWT_SECRET 至少 32 个字符"),
  /** 站点域名；设置后 Cookie 默认带 Secure */
  DOMAIN: z.string().optional().default(""),
  COOKIE_SECURE: bool,
  TRUST_PROXY: bool,
  /** 每 IP 每分钟的登录/注册次数。单账号另有“连错 10 次锁 15 分钟”，这里放宽以免宿舍/校园网共用出口 IP 时误伤 */
  AUTH_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(60),
  AUTH_RATE_LIMIT_WINDOW: z.string().default("1 minute"),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),
});

export type Env = {
  NODE_ENV: "development" | "production" | "test";
  HOST: string;
  PORT: number;
  DATABASE_URL: string;
  JWT_SECRET: string;
  DOMAIN: string;
  cookieSecure: boolean;
  trustProxy: boolean;
  AUTH_RATE_LIMIT_MAX: number;
  AUTH_RATE_LIMIT_WINDOW: string;
  LOG_LEVEL: "fatal" | "error" | "warn" | "info" | "debug" | "trace" | "silent";
};

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const parsed = schema.safeParse(source);
  if (!parsed.success) {
    const msg = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    throw new Error(`环境变量配置错误：${msg}`);
  }
  const e = parsed.data;
  if (e.NODE_ENV === "production" && /change-me/i.test(e.JWT_SECRET)) {
    throw new Error("环境变量配置错误：JWT_SECRET 仍是 .env.example 里的示例值，请用 openssl rand -hex 32 生成");
  }
  const domain = e.DOMAIN.trim();
  return {
    NODE_ENV: e.NODE_ENV,
    HOST: e.HOST,
    PORT: e.PORT,
    DATABASE_URL: e.DATABASE_URL,
    JWT_SECRET: e.JWT_SECRET,
    DOMAIN: domain,
    cookieSecure: e.COOKIE_SECURE ?? (domain !== "" && e.NODE_ENV === "production"),
    trustProxy: e.TRUST_PROXY ?? e.NODE_ENV === "production",
    AUTH_RATE_LIMIT_MAX: e.AUTH_RATE_LIMIT_MAX,
    AUTH_RATE_LIMIT_WINDOW: e.AUTH_RATE_LIMIT_WINDOW,
    LOG_LEVEL: e.LOG_LEVEL,
  };
}
