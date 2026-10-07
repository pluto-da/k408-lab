import { Prisma, type PrismaClient } from "@prisma/client";
import type { LeaderboardResponse, LeaderboardRow } from "@k408/shared";
import { startOfWeekCN } from "./week";

interface RawRow {
  userId: string;
  nickname: string;
  stars: number;
  mistakes: number;
  timeMs: number;
  createdAt: Date;
  rank: bigint;
  rn: bigint;
  total: bigint;
}

export const TOP_N = 50;

/** 每人取最好成绩：星级降序 → 失误升序 → 用时升序（同成绩先达成者在前） */
export async function getLeaderboard(
  prisma: PrismaClient,
  flowId: string,
  period: "week" | "all",
  meId: string | null,
  now = new Date(),
): Promise<LeaderboardResponse> {
  const since = period === "week" ? startOfWeekCN(now) : null;
  const sinceSql = since ? Prisma.sql`AND r."createdAt" >= ${since}` : Prisma.empty;
  const rows = await prisma.$queryRaw<RawRow[]>`
    WITH best AS (
      SELECT DISTINCT ON (r."userId") r."userId", r.stars, r.mistakes, r."timeMs", r."createdAt"
      FROM "FlowRun" r
      WHERE r."flowId" = ${flowId} ${sinceSql}
      ORDER BY r."userId", r.stars DESC, r.mistakes ASC, r."timeMs" ASC, r."createdAt" ASC
    ), ranked AS (
      SELECT b.*,
        RANK() OVER (ORDER BY b.stars DESC, b.mistakes ASC, b."timeMs" ASC) AS rank,
        ROW_NUMBER() OVER (ORDER BY b.stars DESC, b.mistakes ASC, b."timeMs" ASC, b."createdAt" ASC) AS rn,
        COUNT(*) OVER () AS total
      FROM best b
    )
    SELECT ranked.*, u.nickname
    FROM ranked JOIN "User" u ON u.id = ranked."userId"
    WHERE ranked.rn <= ${TOP_N} OR ranked."userId" = ${meId ?? ""}
    ORDER BY ranked.rn`;

  const toRow = (r: RawRow): LeaderboardRow => ({
    rank: Number(r.rank),
    userId: r.userId,
    nickname: r.nickname,
    stars: r.stars,
    mistakes: r.mistakes,
    timeMs: r.timeMs,
    achievedAt: r.createdAt.toISOString(),
  });
  const top = rows.filter((r) => Number(r.rn) <= TOP_N).map(toRow);
  const mine = meId ? rows.find((r) => r.userId === meId) : undefined;
  return {
    flowId,
    period,
    since: since?.toISOString() ?? null,
    rows: top,
    me: mine ? toRow(mine) : null,
    totalPlayers: rows[0] ? Number(rows[0].total) : 0,
  };
}
