import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { makeApp, postEvents, registerUser, resetDb, type Ctx } from "./helpers";

let ctx: Ctx;
beforeAll(async () => {
  ctx = await makeApp();
});
afterAll(async () => ctx.app.close());
beforeEach(async () => resetDb(ctx.prisma));

const flowMistake = {
  type: "flow_mistake",
  flowId: "pagefault",
  stepIndex: 4,
  stepType: "single",
  question: "此时进程状态？",
  chosen: "就绪",
  correct: "阻塞",
  explanation: "进程要等调页 I/O 完成，进入阻塞态",
  options: ["阻塞", "就绪"],
};

describe("错题本", () => {
  it("自测答错与闯关失误都进错题本，按科目筛选", async () => {
    const u = await registerUser(ctx.app);
    await postEvents(ctx.app, u.cookie, [
      { type: "quiz_answered", questionId: "q7", chosen: 0, correct: false },
      { type: "quiz_answered", questionId: "q3", chosen: 1, correct: true },
      flowMistake,
      { ...flowMistake, flowId: "web", question: "DNS 查询用？", chosen: "TCP 80", correct: "UDP 53", explanation: "DNS 查询一般用 UDP" },
    ]);
    const all = (await ctx.app.inject({ method: "GET", url: "/api/mistakes", headers: { cookie: u.cookie } })).json();
    expect(all.items).toHaveLength(3);
    expect(all.counts.cn.active).toBe(2);
    expect(all.counts.os.active).toBe(1);

    const cn = (await ctx.app.inject({ method: "GET", url: "/api/mistakes?subject=cn", headers: { cookie: u.cookie } })).json();
    expect(cn.items).toHaveLength(2);
    const quiz = cn.items.find((m: { source: string }) => m.source === "quiz");
    expect(quiz).toMatchObject({ questionId: "q7", chosen: "A. 64", correctAnswer: "C. 62", promptIsHtml: true });
    expect(quiz.options).toHaveLength(4);
    const os = (await ctx.app.inject({ method: "GET", url: "/api/mistakes?subject=os&source=flow", headers: { cookie: u.cookie } })).json();
    expect(os.items[0]).toMatchObject({ flowId: "pagefault", stepIndex: 4, chosen: "就绪", correctAnswer: "阻塞", promptIsHtml: false });
  });

  it("同一题再错累计次数并重新变为未掌握", async () => {
    const u = await registerUser(ctx.app);
    await postEvents(ctx.app, u.cookie, [flowMistake]);
    const first = (await ctx.app.inject({ method: "GET", url: "/api/mistakes", headers: { cookie: u.cookie } })).json().items[0];
    await ctx.app.inject({ method: "PATCH", url: `/api/mistakes/${first.id}`, headers: { cookie: u.cookie }, payload: { mastered: true } });
    await postEvents(ctx.app, u.cookie, [flowMistake]);
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
    const wrong = await ctx.app.inject({ method: "POST", url: `/api/mistakes/${m.id}/redo`, headers: { cookie: u.cookie }, payload: { answer: 2 } });
    expect(wrong.json()).toMatchObject({ correct: false, item: { mastered: false, wrongCount: 2 } });
    const right = await ctx.app.inject({ method: "POST", url: `/api/mistakes/${m.id}/redo`, headers: { cookie: u.cookie }, payload: { answer: 1 } });
    expect(right.json()).toMatchObject({ correct: true, item: { mastered: true } });
    const p = (await ctx.app.inject({ method: "GET", url: "/api/progress", headers: { cookie: u.cookie } })).json();
    expect(p.completedIds).toContain("quiz:q6");
  });

  it("重做：闯关题支持单选与排序题", async () => {
    const u = await registerUser(ctx.app);
    await postEvents(ctx.app, u.cookie, [
      flowMistake,
      { ...flowMistake, flowId: "web", stepType: "order", question: "TCP 三次握手：按顺序依次点", chosen: "SYN+ACK", correct: "SYN → SYN+ACK → ACK", options: ["SYN", "SYN+ACK", "ACK"] },
    ]);
    const items = (await ctx.app.inject({ method: "GET", url: "/api/mistakes", headers: { cookie: u.cookie } })).json().items as { id: string; stepType: string }[];
    const single = items.find((i) => i.stepType === "single")!;
    const order = items.find((i) => i.stepType === "order")!;
    const a = await ctx.app.inject({ method: "POST", url: `/api/mistakes/${single.id}/redo`, headers: { cookie: u.cookie }, payload: { answer: "阻塞" } });
    expect(a.json().correct).toBe(true);
    const b = await ctx.app.inject({ method: "POST", url: `/api/mistakes/${order.id}/redo`, headers: { cookie: u.cookie }, payload: { answer: ["SYN", "ACK", "SYN+ACK"] } });
    expect(b.json().correct).toBe(false);
    const c = await ctx.app.inject({ method: "POST", url: `/api/mistakes/${order.id}/redo`, headers: { cookie: u.cookie }, payload: { answer: ["SYN", "SYN+ACK", "ACK"] } });
    expect(c.json().correct).toBe(true);
  });

  it("不能操作别人的错题", async () => {
    const a = await registerUser(ctx.app);
    const b = await registerUser(ctx.app);
    await postEvents(ctx.app, a.cookie, [flowMistake]);
    const m = (await ctx.app.inject({ method: "GET", url: "/api/mistakes", headers: { cookie: a.cookie } })).json().items[0];
    const r = await ctx.app.inject({ method: "PATCH", url: `/api/mistakes/${m.id}`, headers: { cookie: b.cookie }, payload: { mastered: true } });
    expect(r.statusCode).toBe(404);
    const d = await ctx.app.inject({ method: "DELETE", url: `/api/mistakes/${m.id}`, headers: { cookie: b.cookie } });
    expect(d.statusCode).toBe(404);
    const ok = await ctx.app.inject({ method: "DELETE", url: `/api/mistakes/${m.id}`, headers: { cookie: a.cookie } });
    expect(ok.statusCode).toBe(200);
  });
});
