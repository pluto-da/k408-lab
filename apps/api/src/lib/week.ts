const CN_OFFSET_MS = 8 * 3600 * 1000; // Asia/Shanghai，无夏令时

/** 本周一 00:00（北京时间）对应的 UTC 时刻 */
export function startOfWeekCN(now: Date = new Date()): Date {
  const local = new Date(now.getTime() + CN_OFFSET_MS);
  const dow = (local.getUTCDay() + 6) % 7; // 周一 = 0
  const monday = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate() - dow);
  return new Date(monday - CN_OFFSET_MS);
}
