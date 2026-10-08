import type { Prisma, PrismaClient, Subject } from "@prisma/client";
import { envelopeSchema, itemId, labEventSchema, type LabEvent } from "@k408/shared";

export interface IngestResult {
  accepted: number;
  rejected: { index: number; reason: string }[];
}

async function touch(prisma: PrismaClient, userId: string, id: string, at: Date) {
  await prisma.progressRecord.upsert({
    where: { userId_itemId: { userId, itemId: id } },
    create: { userId, itemId: id, firstAt: at, lastAt: at },
    update: { count: { increment: 1 }, lastAt: at },
  });
}

async function recordQuizMistake(
  prisma: PrismaClient,
  userId: string,
  q: { id: string; subject: Subject; stem: string; options: Prisma.JsonValue; answer: number; explanation: string },
  chosen: number,
  at: Date,
) {
  const opts = Array.isArray(q.options) ? (q.options as string[]) : [];
  const chosenText = opts[chosen] ?? String(chosen);
  const letter = (i: number) => "ABCDEFGHIJ".charAt(i);
  await prisma.mistake.upsert({
    where: { userId_dedupeKey: { userId, dedupeKey: `quiz:${q.id}` } },
    create: {
      userId,
      subject: q.subject,
      dedupeKey: `quiz:${q.id}`,
      questionId: q.id,
      prompt: q.stem,
      options: opts,
      chosen: `${letter(chosen)}. ${chosenText}`,
      correctAnswer: `${letter(q.answer)}. ${opts[q.answer] ?? ""}`,
      explanation: q.explanation,
      lastWrongAt: at,
    },
    update: { chosen: `${letter(chosen)}. ${chosenText}`, wrongCount: { increment: 1 }, mastered: false, masteredAt: null, lastWrongAt: at },
  });
}

export async function quizAnswer(prisma: PrismaClient, userId: string, questionId: string, chosen: number, at = new Date()) {
  const q = await prisma.question.findUnique({ where: { id: questionId } });
  if (!q) return null;
  const correct = chosen === q.answer;
  await prisma.quizAnswer.create({ data: { userId, questionId, chosen, correct, createdAt: at } });
  if (correct) await touch(prisma, userId, itemId.quiz(q.id), at);
  else await recordQuizMistake(prisma, userId, q, chosen, at);
  return { correct, question: q };
}

async function applyEvent(prisma: PrismaClient, userId: string, ev: LabEvent, at: Date): Promise<string | null> {
  switch (ev.type) {
    case "chapter_viewed": {
      const id = itemId.chapter(ev.subject, ev.chapterNo);
      const exists = await prisma.contentItem.count({ where: { id } });
      if (!exists) return "未知的章节";
      await touch(prisma, userId, id, at);
      return null;
    }
    case "part_focused":
      await touch(prisma, userId, itemId.part(ev.partId), at);
      return null;
    case "lab_opened":
      await touch(prisma, userId, itemId.lab(ev.labId), at);
      return null;
    case "quiz_answered": {
      const r = await quizAnswer(prisma, userId, ev.questionId, ev.chosen, at);
      return r ? null : "未知的题目";
    }
    case "flow_viewed":
      await touch(prisma, userId, itemId.flow(ev.flowId), at);
      return null;
  }
}

export async function ingestEvents(prisma: PrismaClient, userId: string, raw: unknown[]): Promise<IngestResult> {
  const result: IngestResult = { accepted: 0, rejected: [] };
  const now = Date.now();
  for (const [index, item] of raw.entries()) {
    const env = envelopeSchema.safeParse(item);
    const ev = labEventSchema.safeParse(item);
    if (!env.success || !ev.success) {
      const issue = (ev.error ?? env.error)?.issues[0];
      result.rejected.push({ index, reason: issue ? `${issue.path.join(".")} ${issue.message}` : "格式错误" });
      continue;
    }
    // 客户端时间只在合理范围内采用（离线队列最多 7 天），否则以服务器时间为准
    const ts = env.data.ts;
    const at = new Date(ts && ts <= now + 60_000 && ts >= now - 7 * 86400_000 ? ts : now);
    const reason = await applyEvent(prisma, userId, ev.data, at);
    if (reason) result.rejected.push({ index, reason });
    else result.accepted++;
  }
  return result;
}
