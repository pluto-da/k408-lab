import type { PrismaClient } from "@prisma/client";
import {
  CATALOG,
  SUBJECTS,
  SUBJECT_NAMES,
  type ItemKind,
  type ProgressResponse,
  type Subject,
} from "@k408/shared";

const KINDS: ItemKind[] = ["chapter", "lab", "flow", "part", "quiz"];
const pct = (d: number, t: number) => (t === 0 ? 0 : Math.round((d / t) * 100));

export async function computeProgress(prisma: PrismaClient, userId: string): Promise<ProgressResponse> {
  const records = await prisma.progressRecord.findMany({ where: { userId }, orderBy: { lastAt: "desc" } });
  const done = new Set(records.map((r) => r.itemId));
  const byId = new Map(CATALOG.map((c) => [c.id, c]));

  const subjects = SUBJECTS.map((s: Subject) => {
    const items = CATALOG.filter((c) => c.subject === s);
    const byKind = Object.fromEntries(
      KINDS.map((k) => {
        const ofKind = items.filter((i) => i.kind === k);
        return [k, { done: ofKind.filter((i) => done.has(i.id)).length, total: ofKind.length }];
      }),
    ) as Record<ItemKind, { done: number; total: number }>;
    const d = items.filter((i) => done.has(i.id)).length;
    return { subject: s, name: SUBJECT_NAMES[s], done: d, total: items.length, percent: pct(d, items.length), byKind };
  });

  const totalDone = CATALOG.filter((c) => done.has(c.id)).length;
  const recent = records
    .filter((r) => byId.has(r.itemId))
    .slice(0, 10)
    .map((r) => {
      const c = byId.get(r.itemId)!;
      return { itemId: r.itemId, title: c.title, kind: c.kind, subject: c.subject, lastAt: r.lastAt.toISOString() };
    });

  return {
    overall: { done: totalDone, total: CATALOG.length, percent: pct(totalDone, CATALOG.length) },
    subjects,
    recent,
    completedIds: [...done].filter((id) => byId.has(id)),
  };
}
