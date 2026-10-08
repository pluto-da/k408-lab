import { z } from "zod";
import { FLOW_IDS, LAB_IDS, PART_IDS, QUIZ_IDS, SUBJECTS } from "./catalog";

const flowId = z.string().refine((v) => FLOW_IDS.includes(v), "未知的流程");

export const chapterViewedEvent = z.object({
  type: z.literal("chapter_viewed"),
  subject: z.enum(SUBJECTS),
  chapterNo: z.number().int().min(1).max(20),
});
export const partFocusedEvent = z.object({
  type: z.literal("part_focused"),
  partId: z.string().refine((v) => PART_IDS.includes(v), "未知的部件"),
});
export const labOpenedEvent = z.object({
  type: z.literal("lab_opened"),
  labId: z.string().refine((v) => LAB_IDS.includes(v), "未知的实验"),
});
export const quizAnsweredEvent = z.object({
  type: z.literal("quiz_answered"),
  questionId: z.string().refine((v) => QUIZ_IDS.includes(v), "未知的题目"),
  chosen: z.number().int().min(0).max(9),
  /** 客户端判定结果，仅作参考；服务端以题库答案为准 */
  correct: z.boolean().optional(),
});
/** 看了一遍流程自动演示 */
export const flowViewedEvent = z.object({
  type: z.literal("flow_viewed"),
  flowId,
});

export const labEventSchema = z.discriminatedUnion("type", [
  chapterViewedEvent,
  partFocusedEvent,
  labOpenedEvent,
  quizAnsweredEvent,
  flowViewedEvent,
]);
export type LabEvent = z.infer<typeof labEventSchema>;
export type LabEventType = LabEvent["type"];

/** 上报时附带的元数据：客户端事件 id（去重）与发生时间 */
export const envelopeSchema = z.object({
  eid: z.string().min(8).max(64).regex(/^[A-Za-z0-9_-]+$/),
  ts: z.number().int().positive().optional(),
});

export const eventBatchSchema = z.object({
  events: z.array(z.unknown()).min(1).max(100),
});
