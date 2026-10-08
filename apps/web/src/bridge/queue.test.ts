import { describe, expect, it } from "vitest";
import { EventQueue, normalize } from "./queue";

describe("事件队列", () => {
  it("只接受合法事件并补上 eid", () => {
    expect(normalize({ type: "lab_opened", labId: "sort" })).toMatchObject({ type: "lab_opened", labId: "sort" });
    expect(normalize({ type: "lab_opened", labId: "sort" })?.eid).toMatch(/^[A-Za-z0-9]{8,}$/);
    expect(normalize({ type: "lab_opened", labId: "nope" })).toBeNull();
    expect(normalize({ type: "flow_viewed", flowId: "life" })).not.toBeNull();
    expect(normalize({ type: "flow_viewed", flowId: "nope" })).toBeNull();
    expect(normalize({ type: "flow_finished", flowId: "life", stars: 3, mistakes: 0, timeMs: 5000 })).toBeNull();
    expect(normalize({ type: "flow_mistake", flowId: "life", stepIndex: 0, question: "?", chosen: "a", correct: "b" })).toBeNull();
    expect(normalize(null)).toBeNull();
  });

  it("持久化到 sessionStorage 并按 eid 确认", () => {
    const q = new EventQueue(sessionStorage);
    q.clear();
    const a = normalize({ type: "part_focused", partId: "cpu" })!;
    const b = normalize({ type: "quiz_answered", questionId: "q1", chosen: 1, correct: true })!;
    q.push(a);
    q.push(b);
    expect(new EventQueue(sessionStorage).size).toBe(2);
    q.ack(new Set([a.eid]));
    expect(q.peek(10).map((e) => e.eid)).toEqual([b.eid]);
    q.clear();
    expect(sessionStorage.getItem("k408.pendingEvents")).toBeNull();
  });
});
