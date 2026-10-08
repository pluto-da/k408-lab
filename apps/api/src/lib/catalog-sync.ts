import { type PrismaClient, type Subject } from "@prisma/client";
import { CATALOG } from "@k408/shared";
import questions from "../../prisma/seed-questions.json";

interface SeedQuestion {
  id: string;
  subject: string;
  stem: string;
  options: string[];
  answer: number;
  explanation: string;
}

/** 幂等写入题库与进度条目；服务启动和 seed 都会调用 */
export async function syncCatalog(prisma: PrismaClient): Promise<{ items: number; questions: number }> {
  const qs = questions as SeedQuestion[];
  await prisma.$transaction([
    ...CATALOG.map((it, i) =>
      prisma.contentItem.upsert({
        where: { id: it.id },
        create: { id: it.id, kind: it.kind, subject: it.subject as Subject, title: it.title, sort: i },
        update: { kind: it.kind, subject: it.subject as Subject, title: it.title, sort: i },
      }),
    ),
    ...qs.map((q, i) =>
      prisma.question.upsert({
        where: { id: q.id },
        create: { id: q.id, subject: q.subject as Subject, stem: q.stem, options: q.options, answer: q.answer, explanation: q.explanation, sort: i },
        update: { subject: q.subject as Subject, stem: q.stem, options: q.options, answer: q.answer, explanation: q.explanation, sort: i },
      }),
    ),
  ]);
  return { items: CATALOG.length, questions: qs.length };
}
