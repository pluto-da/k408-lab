import type { FastifyPluginAsync } from "fastify";
import type { Mistake, Prisma } from "@prisma/client";
import { z } from "zod";
import { SUBJECTS, type MistakeDto } from "@k408/shared";
import { badRequest, notFound } from "../lib/errors";
import { quizAnswer } from "../lib/ingest";

const listQuery = z.object({
  subject: z.enum(SUBJECTS).optional(),
  status: z.enum(["active", "mastered", "all"]).default("active"),
  source: z.enum(["quiz", "flow"]).optional(),
});
const idParams = z.object({ id: z.string().min(1).max(40) });
const patchBody = z.object({ mastered: z.boolean() });
const redoBody = z.object({ answer: z.union([z.number().int().min(0).max(20), z.string().max(300), z.array(z.string().max(100)).max(12)]) });

function toDto(m: Mistake): MistakeDto {
  const options = Array.isArray(m.options) ? (m.options as unknown[]).map(String) : [];
  const quiz = m.source === "quiz";
  return {
    id: m.id,
    source: m.source,
    subject: m.subject,
    questionId: m.questionId,
    flowId: m.flowId,
    stepIndex: m.stepIndex,
    stepType: m.stepType === "order" ? "order" : "single",
    prompt: m.prompt,
    promptIsHtml: quiz,
    options,
    optionsAreHtml: quiz,
    chosen: m.chosen,
    correctAnswer: m.correctAnswer,
    explanation: m.explanation,
    explanationIsHtml: quiz,
    wrongCount: m.wrongCount,
    mastered: m.mastered,
    masteredAt: m.masteredAt?.toISOString() ?? null,
    lastWrongAt: m.lastWrongAt.toISOString(),
    createdAt: m.createdAt.toISOString(),
  };
}

const norm = (s: string) => s.replace(/\s+/g, "").replace(/→/g, ">");

const mistakes: FastifyPluginAsync = async (app) => {
  app.get("/mistakes", async (req) => {
    const user = await app.requireUser(req);
    const q = listQuery.parse(req.query);
    const where: Prisma.MistakeWhereInput = { userId: user.id };
    if (q.subject) where.subject = q.subject;
    if (q.source) where.source = q.source;
    if (q.status !== "all") where.mastered = q.status === "mastered";
    const [items, grouped] = await Promise.all([
      app.prisma.mistake.findMany({ where, orderBy: [{ lastWrongAt: "desc" }], take: 300 }),
      app.prisma.mistake.groupBy({ by: ["subject", "mastered"], where: { userId: user.id }, _count: { _all: true } }),
    ]);
    const counts = Object.fromEntries(SUBJECTS.map((s) => [s, { active: 0, mastered: 0 }])) as Record<string, { active: number; mastered: number }>;
    for (const g of grouped) counts[g.subject]![g.mastered ? "mastered" : "active"] = g._count._all;
    return { items: items.map(toDto), counts };
  });

  async function own(userId: string, id: string) {
    const m = await app.prisma.mistake.findFirst({ where: { id, userId } });
    if (!m) throw notFound("错题不存在");
    return m;
  }

  app.patch("/mistakes/:id", async (req) => {
    const user = await app.requireUser(req);
    const { id } = idParams.parse(req.params);
    const { mastered } = patchBody.parse(req.body);
    await own(user.id, id);
    const m = await app.prisma.mistake.update({ where: { id }, data: { mastered, masteredAt: mastered ? new Date() : null } });
    return { item: toDto(m) };
  });

  app.delete("/mistakes/:id", async (req) => {
    const user = await app.requireUser(req);
    const { id } = idParams.parse(req.params);
    await own(user.id, id);
    await app.prisma.mistake.delete({ where: { id } });
    return { ok: true };
  });

  /** 重做：答对自动标记为已掌握；答错累计错误次数 */
  app.post("/mistakes/:id/redo", async (req) => {
    const user = await app.requireUser(req);
    const { id } = idParams.parse(req.params);
    const { answer } = redoBody.parse(req.body);
    const m = await own(user.id, id);
    let correct: boolean;
    if (m.source === "quiz") {
      if (typeof answer !== "number" || !m.questionId) throw badRequest("请选择一个选项");
      const r = await quizAnswer(app.prisma, user.id, m.questionId, answer);
      if (!r) throw notFound("题目已下线");
      correct = r.correct;
      // quizAnswer 答错时已累计 wrongCount
    } else {
      const given = Array.isArray(answer) ? answer.join(" → ") : String(answer);
      correct = norm(given) === norm(m.correctAnswer);
      if (!correct) await app.prisma.mistake.update({ where: { id }, data: { wrongCount: { increment: 1 }, lastWrongAt: new Date() } });
    }
    const updated = correct
      ? await app.prisma.mistake.update({ where: { id }, data: { mastered: true, masteredAt: new Date() } })
      : await app.prisma.mistake.findUniqueOrThrow({ where: { id } });
    return { correct, item: toDto(updated) };
  });
};
export default mistakes;
