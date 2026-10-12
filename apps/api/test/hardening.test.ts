import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { LoginGuard } from "../src/lib/login-guard";
import { loadEnv } from "../src/env";
import { makeApp, registerUser, resetDb, type Ctx } from "./helpers";

describe("LoginGuard", () => {
  it("失败达到上限后锁定，窗口过后自动解锁，成功登录清零", () => {
    let t = 0;
    const g = new LoginGuard({ maxFailures: 3, windowMs: 1000, now: () => t });
    g.fail("a");
    g.fail("a");
    expect(g.lockedFor("a")).toBe(0);
    g.fail("a");
    expect(g.lockedFor("a")).toBe(1000);
    expect(g.lockedFor("b")).toBe(0);
    t = 1001;
    expect(g.lockedFor("a")).toBe(0);
    g.fail("c");
    g.fail("c");
    g.succeed("c");
    g.fail("c");
    expect(g.lockedFor("c")).toBe(0);
  });

  it("再次被锁时锁定时长逐次翻倍，有上限；长时间不再失败后恢复初始时长", () => {
    let t = 0;
    const g = new LoginGuard({ maxFailures: 2, windowMs: 1000, maxLockMs: 3000, decayMs: 10_000, now: () => t });
    g.fail("a");
    g.fail("a");
    expect(g.lockedFor("a")).toBe(1000);
    t = 1500;
    g.fail("a");
    g.fail("a");
    expect(g.lockedFor("a")).toBe(2000);
    t = 4000;
    g.fail("a");
    g.fail("a");
    expect(g.lockedFor("a")).toBe(3000);
    t = 30_000;
    g.fail("a");
    g.fail("a");
    expect(g.lockedFor("a")).toBe(1000);
  });

  it("记录数有上限", () => {
    const g = new LoginGuard({ maxEntries: 10 });
    for (let i = 0; i < 100; i++) g.fail(`u${i}`);
    expect((g as unknown as { map: Map<string, unknown> }).map.size).toBeLessThanOrEqual(10);
  });
});

describe("环境变量", () => {
  it("生产环境拒绝示例 JWT_SECRET", () => {
    const base = { NODE_ENV: "production", DATABASE_URL: "postgresql://x", JWT_SECRET: "change-me-to-a-long-random-string-at-least-32-chars" };
    expect(() => loadEnv(base)).toThrow(/JWT_SECRET/);
    expect(() => loadEnv({ ...base, JWT_SECRET: "a".repeat(64) })).not.toThrow();
  });
});

describe("接口加固", () => {
  let ctx: Ctx;
  beforeAll(async () => {
    ctx = await makeApp();
  });
  afterAll(async () => ctx.app.close());
  beforeEach(async () => resetDb(ctx.prisma));

  it("接口响应不可缓存", async () => {
    const res = await ctx.app.inject({ method: "GET", url: "/api/me" });
    expect(res.headers["cache-control"]).toBe("no-store");
    const nf = await ctx.app.inject({ method: "GET", url: "/api/nope" });
    expect(nf.statusCode).toBe(404);
    expect(nf.headers["cache-control"]).toBe("no-store");
  });

  it("同一账号连续输错密码后暂时锁定，不影响其他账号", async () => {
    const { username } = await registerUser(ctx.app, "victim");
    const other = await registerUser(ctx.app, "other");
    for (let i = 0; i < 10; i++) {
      const r = await ctx.app.inject({ method: "POST", url: "/api/auth/login", payload: { account: username, password: "wrong-password" } });
      expect(r.statusCode).toBe(401);
    }
    const locked = await ctx.app.inject({ method: "POST", url: "/api/auth/login", payload: { account: "VICTIM", password: "Lab408-pass" } });
    expect(locked.statusCode).toBe(429);
    expect(locked.json().error.code).toBe("ACCOUNT_LOCKED");
    const ok = await ctx.app.inject({ method: "POST", url: "/api/auth/login", payload: { account: other.username, password: "Lab408-pass" } });
    expect(ok.statusCode).toBe(200);
  });
});
