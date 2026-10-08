import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { makeApp, postEvents, registerUser, resetDb, type Ctx } from "./helpers";

let ctx: Ctx;
beforeAll(async () => {
  ctx = await makeApp();
});
afterAll(async () => ctx.app.close());
beforeEach(async () => resetDb(ctx.prisma));

describe("学习事件与进度", () => {
  it("未登录上报返回 401", async () => {
    const res = await ctx.app.inject({ method: "POST", url: "/api/events", payload: { events: [{ eid: "abcdefgh1", type: "lab_opened", labId: "sort" }] } });
    expect(res.statusCode).toBe(401);
  });

  it("各类事件计入对应科目进度", async () => {
    const u = await registerUser(ctx.app);
    const res = await postEvents(ctx.app, u.cookie, [
      { type: "chapter_viewed", subject: "ds", chapterNo: 1 },
      { type: "chapter_viewed", subject: "ds", chapterNo: 1 }, // 重复不重复计数
      { type: "chapter_viewed", subject: "ds", chapterNo: 2 },
      { type: "lab_opened", labId: "sort" },
      { type: "part_focused", partId: "ds" },
      { type: "part_focused", partId: "cpu" },
      { type: "quiz_answered", questionId: "q1", chosen: 1, correct: true },
      { type: "quiz_answered", questionId: "q2", chosen: 0, correct: true }, // 客户端说对，服务端判错
      { type: "flow_viewed", flowId: "pagefault" },
    ]);
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ accepted: 9, rejected: [] });

    const p = await ctx.app.inject({ method: "GET", url: "/api/progress", headers: { cookie: u.cookie } });
    const body = p.json();
    const ds = body.subjects.find((s: { subject: string }) => s.subject === "ds");
    // 数据结构：8 章 + 3 实验 + 1 部件 + 2 自测 = 14；完成 章1、章2、sort、ds 部件、q1 = 5
    expect(ds.total).toBe(14);
    expect(ds.done).toBe(5);
    expect(ds.percent).toBe(36);
    expect(ds.byKind.quiz).toEqual({ done: 1, total: 2 });
    const os = body.subjects.find((s: { subject: string }) => s.subject === "os");
    expect(os.byKind.flow).toEqual({ done: 1, total: 1 });
    const co = body.subjects.find((s: { subject: string }) => s.subject === "co");
    expect(co.byKind.part.done).toBe(1);
    expect(body.overall.total).toBe(56);
    expect(body.overall.done).toBe(7);
    expect(body.recent.length).toBeGreaterThan(0);
    expect(body.subjects.map((s: { name: string }) => s.name)).toEqual(["数据结构", "计算机组成原理", "操作系统", "计算机网络"]);
  });

  it("非法事件被逐条拒绝，不影响同批其他事件", async () => {
    const u = await registerUser(ctx.app);
    const res = await postEvents(ctx.app, u.cookie, [
      { type: "lab_opened", labId: "nope" },
      { type: "chapter_viewed", subject: "ds", chapterNo: 19 },
      { type: "flow_viewed", flowId: "nope" },
      { type: "flow_finished", flowId: "life", stars: 3, mistakes: 0, timeMs: 30000 }, // 已移除的事件类型
      { type: "what", foo: 1 },
      { type: "lab_opened", labId: "banker" },
    ]);
    const body = res.json();
    expect(body.accepted).toBe(1);
    expect(body.rejected.map((r: { index: number }) => r.index)).toEqual([0, 1, 2, 3, 4]);
    expect(body.rejected[2].reason).toContain("未知的流程");
  });

  it("流程演示重复观看只计一次进度", async () => {
    const u = await registerUser(ctx.app);
    await postEvents(ctx.app, u.cookie, [
      { type: "flow_viewed", flowId: "web" },
      { type: "flow_viewed", flowId: "web" },
    ]);
    const p = (await ctx.app.inject({ method: "GET", url: "/api/progress", headers: { cookie: u.cookie } })).json();
    const cn = p.subjects.find((s: { subject: string }) => s.subject === "cn");
    expect(cn.byKind.flow).toEqual({ done: 1, total: 1 });
    expect(p.completedIds.filter((id: string) => id === "flow:web")).toHaveLength(1);
  });

  it("排行榜与闯关接口已移除", async () => {
    expect((await ctx.app.inject({ method: "GET", url: "/api/leaderboard/life" })).statusCode).toBe(404);
    expect((await ctx.app.inject({ method: "GET", url: "/api/flows" })).statusCode).toBe(404);
  });

  it("批量上限 100 条", async () => {
    const u = await registerUser(ctx.app);
    const events = Array.from({ length: 101 }, (_, i) => ({ eid: `bulk-${i}-xxxx`, type: "lab_opened", labId: "sort" }));
    const res = await ctx.app.inject({ method: "POST", url: "/api/events", headers: { cookie: u.cookie }, payload: { events } });
    expect(res.statusCode).toBe(400);
  });
});
