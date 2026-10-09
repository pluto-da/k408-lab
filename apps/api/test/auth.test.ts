import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { cookieOf, makeApp, registerUser, resetDb, type Ctx } from "./helpers";

let ctx: Ctx;
beforeAll(async () => {
  ctx = await makeApp();
});
afterAll(async () => ctx.app.close());
beforeEach(async () => resetDb(ctx.prisma));

describe("健康检查", () => {
  it("返回 ok 且数据库可用", async () => {
    const res = await ctx.app.inject({ method: "GET", url: "/api/health" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ status: "ok", db: "ok" });
    const live = await ctx.app.inject({ method: "GET", url: "/api/health/live" });
    expect(live.statusCode).toBe(200);
  });
});

describe("账号", () => {
  it("用户名注册 → 会话 Cookie → /me", async () => {
    const res = await ctx.app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: { username: "Kaoyan_408", password: "password123", nickname: "小王" },
    });
    expect(res.statusCode).toBe(201);
    const setCookie = String(res.headers["set-cookie"]);
    expect(setCookie).toContain("HttpOnly");
    expect(setCookie).toContain("SameSite=Lax");
    const user = res.json().user;
    expect(user).toMatchObject({ username: "kaoyan_408", nickname: "小王", email: null });
    expect(user.passwordHash).toBeUndefined();

    const me = await ctx.app.inject({ method: "GET", url: "/api/me", headers: { cookie: cookieOf(res) } });
    expect(me.json().user.nickname).toBe("小王");
  });

  it("密码以 argon2id 存储", async () => {
    await ctx.app.inject({ method: "POST", url: "/api/auth/register", payload: { username: "hash_user", password: "password123" } });
    const u = await ctx.prisma.user.findUniqueOrThrow({ where: { username: "hash_user" } });
    expect(u.passwordHash.startsWith("$argon2id$")).toBe(true);
  });

  it("邮箱注册，可用邮箱或用户名登录", async () => {
    const reg = await ctx.app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: { username: "both", email: "Me@Example.com", password: "password123" },
    });
    expect(reg.statusCode).toBe(201);
    expect(reg.json().user.email).toBe("me@example.com");
    for (const account of ["me@example.com", "ME@example.com", "both", "BOTH"]) {
      const res = await ctx.app.inject({ method: "POST", url: "/api/auth/login", payload: { account, password: "password123" } });
      expect(res.statusCode, account).toBe(200);
    }
  });

  it("只用邮箱注册时昵称取邮箱前缀", async () => {
    const reg = await ctx.app.inject({ method: "POST", url: "/api/auth/register", payload: { email: "zhang@qq.com", password: "password123" } });
    expect(reg.statusCode).toBe(201);
    expect(reg.json().user).toMatchObject({ nickname: "zhang", username: null });
  });

  it("重复用户名 / 邮箱返回 409 中文提示", async () => {
    await ctx.app.inject({ method: "POST", url: "/api/auth/register", payload: { username: "dup", email: "d@x.cn", password: "password123" } });
    const a = await ctx.app.inject({ method: "POST", url: "/api/auth/register", payload: { username: "DUP", password: "password123" } });
    expect(a.statusCode).toBe(409);
    expect(a.json().error.message).toBe("该用户名已被占用");
    const b = await ctx.app.inject({ method: "POST", url: "/api/auth/register", payload: { email: "d@x.cn", password: "password123" } });
    expect(b.statusCode).toBe(409);
    expect(b.json().error.message).toBe("该邮箱已注册");
  });

  it("参数校验", async () => {
    const short = await ctx.app.inject({ method: "POST", url: "/api/auth/register", payload: { username: "abc", password: "123" } });
    expect(short.statusCode).toBe(400);
    expect(short.json().error.message).toContain("密码至少 8 位");
    const none = await ctx.app.inject({ method: "POST", url: "/api/auth/register", payload: { password: "password123" } });
    expect(none.statusCode).toBe(400);
    expect(none.json().error.message).toContain("至少填写一个");
    const bad = await ctx.app.inject({ method: "POST", url: "/api/auth/register", payload: { username: "a b!", password: "password123" } });
    expect(bad.statusCode).toBe(400);
    expect(bad.json().error.message).toContain("用户名只能包含");
    const blank = await ctx.app.inject({ method: "POST", url: "/api/auth/register", payload: { username: "blank_ok", email: "", nickname: "", password: "password123" } });
    expect(blank.statusCode).toBe(201);
    expect(blank.json().user.nickname).toBe("blank_ok");
  });

  it("错误密码 / 不存在账号统一返回 401", async () => {
    await ctx.app.inject({ method: "POST", url: "/api/auth/register", payload: { username: "pw", password: "password123" } });
    const wrong = await ctx.app.inject({ method: "POST", url: "/api/auth/login", payload: { account: "pw", password: "nope-nope" } });
    const ghost = await ctx.app.inject({ method: "POST", url: "/api/auth/login", payload: { account: "ghost", password: "nope-nope" } });
    expect(wrong.statusCode).toBe(401);
    expect(ghost.statusCode).toBe(401);
    expect(wrong.json().error.message).toBe(ghost.json().error.message);
  });

  it("退出登录清除 Cookie；伪造 token 无效", async () => {
    const res = await ctx.app.inject({ method: "POST", url: "/api/auth/register", payload: { username: "bye", password: "password123" } });
    const out = await ctx.app.inject({ method: "POST", url: "/api/auth/logout", headers: { cookie: cookieOf(res) } });
    expect(String(out.headers["set-cookie"])).toMatch(/k408_session=;/);
    const forged = await ctx.app.inject({ method: "GET", url: "/api/me", headers: { cookie: "k408_session=abc.def.ghi" } });
    expect(forged.json().user).toBeNull();
    const patch = await ctx.app.inject({ method: "PATCH", url: "/api/me", headers: { cookie: "k408_session=abc.def.ghi" }, payload: { nickname: "x" } });
    expect(patch.statusCode).toBe(401);
  });

  it("学习进度与错题本接口已移除", async () => {
    for (const url of ["/api/progress", "/api/mistakes", "/api/events"]) {
      const res = await ctx.app.inject({ method: url === "/api/events" ? "POST" : "GET", url, payload: url === "/api/events" ? { events: [] } : undefined });
      expect(res.statusCode).toBe(404);
    }
  });

  it("修改昵称", async () => {
    const res = await ctx.app.inject({ method: "POST", url: "/api/auth/register", payload: { username: "nick", password: "password123" } });
    const cookie = cookieOf(res);
    const p = await ctx.app.inject({ method: "PATCH", url: "/api/me", headers: { cookie }, payload: { nickname: "  上岸选手 " } });
    expect(p.statusCode).toBe(200);
    expect(p.json().user.nickname).toBe("上岸选手");
    const empty = await ctx.app.inject({ method: "PATCH", url: "/api/me", headers: { cookie }, payload: { nickname: " " } });
    expect(empty.statusCode).toBe(400);
  });

  it("跨站来源的写请求被拒绝", async () => {
    const res = await ctx.app.inject({
      method: "POST",
      url: "/api/auth/login",
      headers: { origin: "https://evil.example", host: "k408.example" },
      payload: { account: "x", password: "y" },
    });
    expect(res.statusCode).toBe(403);
    const same = await ctx.app.inject({
      method: "POST",
      url: "/api/auth/login",
      headers: { origin: "https://k408.example", host: "k408.example" },
      payload: { account: "x", password: "yyyyyyyy" },
    });
    expect(same.statusCode).toBe(401);
  });

  it("退出所有设备：旧会话全部失效，可重新登录", async () => {
    const { cookie, username } = await registerUser(ctx.app);
    const login = await ctx.app.inject({ method: "POST", url: "/api/auth/login", payload: { account: username, password: "password123" } });
    const other = cookieOf(login);
    const anon = await ctx.app.inject({ method: "POST", url: "/api/auth/logout-all", payload: {} });
    expect(anon.statusCode).toBe(401);
    const res = await ctx.app.inject({ method: "POST", url: "/api/auth/logout-all", headers: { cookie }, payload: {} });
    expect(res.statusCode).toBe(200);
    expect(String(res.headers["set-cookie"])).toMatch(/k408_session=;/);
    for (const c of [cookie, other]) {
      const me = await ctx.app.inject({ method: "GET", url: "/api/me", headers: { cookie: c } });
      expect(me.json().user).toBeNull();
    }
    const again = await ctx.app.inject({ method: "POST", url: "/api/auth/login", payload: { account: username, password: "password123" } });
    expect(again.statusCode).toBe(200);
    const me = await ctx.app.inject({ method: "GET", url: "/api/me", headers: { cookie: cookieOf(again) } });
    expect(me.json().user.username).toBe(username);
  });

  it("注销账号需要密码，注销后无法再登录，用户名可重新注册", async () => {
    const { cookie, username } = await registerUser(ctx.app);
    const wrong = await ctx.app.inject({ method: "DELETE", url: "/api/me", headers: { cookie }, payload: { password: "nope-nope" } });
    expect(wrong.statusCode).toBe(403);
    const anon = await ctx.app.inject({ method: "DELETE", url: "/api/me", payload: { password: "password123" } });
    expect(anon.statusCode).toBe(401);
    const ok = await ctx.app.inject({ method: "DELETE", url: "/api/me", headers: { cookie }, payload: { password: "password123" } });
    expect(ok.statusCode).toBe(200);
    expect((await ctx.prisma.user.count({ where: { username } }))).toBe(0);
    const me = await ctx.app.inject({ method: "GET", url: "/api/me", headers: { cookie } });
    expect(me.json().user).toBeNull();
    const login = await ctx.app.inject({ method: "POST", url: "/api/auth/login", payload: { account: username, password: "password123" } });
    expect(login.statusCode).toBe(401);
    await registerUser(ctx.app, username);
  });

  it("短信登录接口已预留但未开放", async () => {
    const res = await ctx.app.inject({ method: "POST", url: "/api/auth/sms/send", payload: { phone: "13800000000" } });
    expect(res.statusCode).toBe(501);
    const m = await ctx.app.inject({ method: "GET", url: "/api/auth/methods" });
    expect(m.json()).toEqual({ password: true, sms: false });
  });
});

describe("登录限流", () => {
  let limited: Ctx;
  beforeAll(async () => {
    limited = await makeApp({ AUTH_RATE_LIMIT_MAX: "3" });
  });
  afterAll(async () => limited.app.close());

  it("超过次数返回 429", async () => {
    const codes: number[] = [];
    for (let i = 0; i < 5; i++) {
      const r = await limited.app.inject({ method: "POST", url: "/api/auth/login", payload: { account: "nobody", password: "wrongpass" } });
      codes.push(r.statusCode);
    }
    expect(codes.slice(0, 3)).toEqual([401, 401, 401]);
    expect(codes[3]).toBe(429);
    const last = await limited.app.inject({ method: "POST", url: "/api/auth/login", payload: { account: "nobody", password: "wrongpass" } });
    expect(last.json().error.code).toBe("RATE_LIMITED");
  });
});
