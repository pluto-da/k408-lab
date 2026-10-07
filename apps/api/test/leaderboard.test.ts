import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { makeApp, postEvents, registerUser, resetDb, type Ctx } from "./helpers";
import { startOfWeekCN } from "../src/lib/week";

let ctx: Ctx;
beforeAll(async () => {
  ctx = await makeApp();
});
afterAll(async () => ctx.app.close());
beforeEach(async () => resetDb(ctx.prisma));

const finish = (stars: number, mistakes: number, timeMs: number, flowId = "life") => ({ type: "flow_finished", flowId, stars, mistakes, timeMs });

describe("排行榜", () => {
  it("每人取最好成绩：星级降序、失误升序、用时升序；附带自己的名次", async () => {
    const a = await registerUser(ctx.app, "alice", "阿丽");
    const b = await registerUser(ctx.app, "bob", "小波");
    const c = await registerUser(ctx.app, "carol", "卡萝");
    const d = await registerUser(ctx.app, "dave", "大卫");
    await postEvents(ctx.app, a.cookie, [finish(1, 5, 20000), finish(2, 1, 90000), finish(2, 2, 30000)]);
    await postEvents(ctx.app, b.cookie, [finish(3, 0, 120000)]);
    await postEvents(ctx.app, c.cookie, [finish(2, 1, 80000)]);
    await postEvents(ctx.app, d.cookie, [finish(3, 0, 60000, "web")]); // 别的流程不算

    const res = await ctx.app.inject({ method: "GET", url: "/api/leaderboard/life?period=all", headers: { cookie: a.cookie } });
    const body = res.json();
    expect(body.rows.map((r: { nickname: string }) => r.nickname)).toEqual(["小波", "卡萝", "阿丽"]);
    expect(body.rows[2]).toMatchObject({ rank: 3, stars: 2, mistakes: 1, timeMs: 90000 });
    expect(body.me).toMatchObject({ rank: 3, userId: a.id });
    expect(body.totalPlayers).toBe(3);

    const anon = (await ctx.app.inject({ method: "GET", url: "/api/leaderboard/life?period=all" })).json();
    expect(anon.me).toBeNull();
    const notPlayed = (await ctx.app.inject({ method: "GET", url: "/api/leaderboard/life?period=all", headers: { cookie: d.cookie } })).json();
    expect(notPlayed.me).toBeNull();
  });

  it("本周榜只统计北京时间本周一 0 点以后的成绩", async () => {
    const a = await registerUser(ctx.app, "old_timer", "老玩家");
    const b = await registerUser(ctx.app, "newbie", "新玩家");
    const lastWeek = startOfWeekCN().getTime() - 3600_000;
    await ctx.app.inject({
      method: "POST",
      url: "/api/events",
      headers: { cookie: a.cookie },
      payload: { events: [{ eid: "old-run-0001", ts: Math.max(lastWeek, Date.now() - 6 * 86400_000), ...finish(3, 0, 10000) }] },
    });
    // 若本周一不到 1 小时前且时间戳被钳制，仍需保证旧成绩落在上周：直接改库
    await ctx.prisma.flowRun.updateMany({ where: { userId: a.id }, data: { createdAt: new Date(lastWeek) } });
    await postEvents(ctx.app, b.cookie, [finish(1, 3, 99000)]);

    const week = (await ctx.app.inject({ method: "GET", url: "/api/leaderboard/life?period=week" })).json();
    expect(week.rows.map((r: { nickname: string }) => r.nickname)).toEqual(["新玩家"]);
    const all = (await ctx.app.inject({ method: "GET", url: "/api/leaderboard/life?period=all" })).json();
    expect(all.rows.map((r: { nickname: string }) => r.nickname)).toEqual(["老玩家", "新玩家"]);
  });

  it("只返回前 50 名，但自己在 50 名外也能看到名次", async () => {
    const users = [];
    for (let i = 0; i < 52; i++) users.push(await registerUser(ctx.app, `player_${i}`, `玩家${i}`));
    for (const [i, u] of users.entries()) await postEvents(ctx.app, u.cookie, [finish(3, 0, 10000 + i * 1000)]);
    const last = users[51]!;
    const body = (await ctx.app.inject({ method: "GET", url: "/api/leaderboard/life?period=all", headers: { cookie: last.cookie } })).json();
    expect(body.rows).toHaveLength(50);
    expect(body.me.rank).toBe(52);
    expect(body.totalPlayers).toBe(52);
  });

  it("未知流程 404/400", async () => {
    const r = await ctx.app.inject({ method: "GET", url: "/api/leaderboard/nope" });
    expect(r.statusCode).toBe(400);
    const flows = (await ctx.app.inject({ method: "GET", url: "/api/flows" })).json();
    expect(flows.flows.map((f: { id: string }) => f.id)).toEqual(["life", "pagefault", "web"]);
  });

  it("本周起点计算（北京时间周一 00:00）", () => {
    // 2026-10-08 是周四；北京时间周一 2026-10-05 00:00 = UTC 2026-10-04 16:00
    expect(startOfWeekCN(new Date("2026-10-08T03:00:00Z")).toISOString()).toBe("2026-10-04T16:00:00.000Z");
    // 北京时间周一 00:30 仍属于当周
    expect(startOfWeekCN(new Date("2026-10-04T16:30:00Z")).toISOString()).toBe("2026-10-04T16:00:00.000Z");
    // 北京时间周日 23:59 属于上周
    expect(startOfWeekCN(new Date("2026-10-04T15:59:00Z")).toISOString()).toBe("2026-09-27T16:00:00.000Z");
  });
});

describe("题库", () => {
  it("返回 8 道题且不含答案", async () => {
    const body = (await ctx.app.inject({ method: "GET", url: "/api/questions" })).json();
    expect(body.items).toHaveLength(8);
    expect(body.items[0].answer).toBeUndefined();
  });
});
