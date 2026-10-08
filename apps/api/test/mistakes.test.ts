import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { makeApp, postEvents, registerUser, resetDb, type Ctx } from "./helpers";

let ctx: Ctx;
beforeAll(async () => {
  ctx = await makeApp();
});
afterAll(async () => ctx.app.close());
beforeEach(async () => resetDb(ctx.prisma));

const wrongQ7 = { type: "quiz_answered", questionId: "q7", chosen: 0, correct: false };

describe("错题本", () => {
  it("自测答错进错题本，答对不进；按科目筛选", async () => {
    const u = await registerUser(ctx.app);
    await postEvents(ctx.app, u.cookie, [
      wrongQ7,
      { type: "quiz_answered", questionId: "q3", chosen: 1, correct: true },
      { type: "quiz_answered", questionId: "q5", chosen: 0 },
    ]);
    const all = (await ctx.app.inject({ method: "GET", url: "/api/mistakes", headers: { cookie: u.cookie } })).json();
    expect(all.items).toHaveLength(2);
    expect(all.counts.cn.active).toBe(1);
    expect(all.counts.os.active).toBe(1);
    expect(all.counts.co.active).toBe(0);

    const cn = (await ctx.app.inject({ method: "GET", url: "/api/mistakes?subject=cn", headers: { cookie: u.cookie } })).json();
    expect(cn.items).toHaveLength(1);
    expect(cn.items[0]).toMatchObject({ questionId: "q7", chosen: "A. 64", correctAnswer: "C. 62" });
    expect(cn.items[0].options).toHaveLength(4);
    expect(cn.items[0]).not.toHaveProperty("source");
    expect(cn.items[0]).not.toHaveProperty("flowId");
  });

  it("流程失误事件已不再接受", async () => {
    const u = await registerUser(ctx.app);
    const res = await postEvents(ctx.app, u.cookie, [
      { type: "flow_mistake", flowId: "pagefault", stepIndex: 4, question: "此时进程状态？", chosen: "就绪", correct: "阻塞" },
    ]);
    expect(res.json()).toMatchObject({ accepted: 0 });
    expect(await ctx.prisma.mistake.count({ where: { userId: u.id } })).toBe(0);
  });

  it("同一题再错累计次数并重新变为未掌握", async () => {
    const u = await registerUser(ctx.app);
    await postEvents(ctx.app, u.cookie, [wrongQ7]);
    const first = (await ctx.app.inject({ method: "GET", url: "/api/mistakes", headers: { cookie: u.cookie } })).json().items[0];
    await ctx.app.inject({ method: "PATCH", url: `/api/mistakes/${first.id}`, headers: { cookie: u.cookie }, payload: { mastered: true } });
    await postEvents(ctx.app, u.cookie, [wrongQ7]);
    const after = (await ctx.app.inject({ method: "GET", url: "/api/mistakes?status=all", headers: { cookie: u.cookie } })).json().items;
    expect(after).toHaveLength(1);
    expect(after[0]).toMatchObject({ wrongCount: 2, mastered: false });
  });

  it("标记已掌握 / 取消；已掌握列表", async () => {
    const u = await registerUser(ctx.app);
    await postEvents(ctx.app, u.cookie, [{ type: "quiz_answered", questionId: "q5", chosen: 0 }]);
    const m = (await ctx.app.inject({ method: "GET", url: "/api/mistakes", headers: { cookie: u.cookie } })).json().items[0];
    const r = await ctx.app.inject({ method: "PATCH", url: `/api/mistakes/${m.id}`, headers: { cookie: u.cookie }, payload: { mastered: true } });
    expect(r.json().item.mastered).toBe(true);
    expect((await ctx.app.inject({ method: "GET", url: "/api/mistakes", headers: { cookie: u.cookie } })).json().items).toHaveLength(0);
    expect((await ctx.app.inject({ method: "GET", url: "/api/mistakes?status=mastered", headers: { cookie: u.cookie } })).json().items).toHaveLength(1);
  });

  it("重做：自测题服务端判分，答对自动掌握并计入进度", async () => {
    const u = await registerUser(ctx.app);
    await postEvents(ctx.app, u.cookie, [{ type: "quiz_answered", questionId: "q6", chosen: 0 }]);
    const m = (await ctx.app.inject({ method: "GET", url: "/api/mistakes", headers: { cookie: u.cookie } })).json().items[0];
    const bad = await ctx.app.inject({ method: "POST", url: `/api/mistakes/${m.id}/redo`, headers: { cookie: u.cookie }, payload: { answer: "阻塞" } });
    expect(bad.statusCode).toBe(400);
    const wrong = await ctx.app.inject({ method: "POST", url: `/api/mistakes/${m.id}/redo`, headers: { cookie: u.cookie }, payload: { answer: 2 } });
    expect(wrong.json()).toMatchObject({ correct: false, item: { mastered: false, wrongCount: 2 } });
    const right = await ctx.app.inject({ method: "POST", url: `/api/mistakes/${m.id}/redo`, headers: { cookie: u.cookie }, payload: { answer: 1 } });
    expect(right.json()).toMatchObject({ correct: true, item: { mastered: true } });
    const p = (await ctx.app.inject({ method: "GET", url: "/api/progress", headers: { cookie: u.cookie } })).json();
    expect(p.completedIds).toContain("quiz:q6");
  });

  it("不能操作别人的错题", async () => {
    const a = await registerUser(ctx.app);
    const b = await registerUser(ctx.app);
    await postEvents(ctx.app, a.cookie, [wrongQ7]);
    const m = (await ctx.app.inject({ method: "GET", url: "/api/mistakes", headers: { cookie: a.cookie } })).json().items[0];
    const r = await ctx.app.inject({ method: "PATCH", url: `/api/mistakes/${m.id}`, headers: { cookie: b.cookie }, payload: { mastered: true } });
    expect(r.statusCode).toBe(404);
    const d = await ctx.app.inject({ method: "DELETE", url: `/api/mistakes/${m.id}`, headers: { cookie: b.cookie } });
    expect(d.statusCode).toBe(404);
    const ok = await ctx.app.inject({ method: "DELETE", url: `/api/mistakes/${m.id}`, headers: { cookie: a.cookie } });
    expect(ok.statusCode).toBe(200);
  });
});
