/**
 * 登录失败计数（进程内存），按账号、按 IP 各用一个实例：
 * 按 IP 的请求限流挡不住“换 IP 撞同一个账号”，也挡不住“同一 IP 轮流试很多账号”，这里两个维度各加一道：
 * 窗口期内失败过多就暂时锁定；锁定解除后若再次被锁，锁定时长逐次翻倍（最长 maxLockMs），
 * 直到 decayMs 内没有再失败才恢复初始时长。
 * 单实例部署足够；多实例时应换成 Redis 等共享存储。
 */
export interface LoginGuardOptions {
  /** 窗口期内允许的最大失败次数 */
  maxFailures?: number;
  /** 统计窗口与锁定时长（毫秒） */
  windowMs?: number;
  /** 最多记录多少个账号，防止被大量随机账号撑爆内存 */
  maxEntries?: number;
  /** 逐次翻倍后的最长锁定时长（毫秒），默认 4 小时 */
  maxLockMs?: number;
  /** 多久没有再失败就忘掉之前被锁过几次（毫秒），默认 24 小时 */
  decayMs?: number;
  now?: () => number;
}

interface Entry {
  failures: number;
  /** 窗口开始时间 */
  since: number;
  /** 锁定到期时间（0 表示未锁定） */
  lockedUntil: number;
  /** 已被锁定过几次（用于逐次延长） */
  locks: number;
  /** 最近一次失败时间 */
  last: number;
}

export class LoginGuard {
  private readonly map = new Map<string, Entry>();
  private readonly maxFailures: number;
  private readonly windowMs: number;
  private readonly maxEntries: number;
  private readonly maxLockMs: number;
  private readonly decayMs: number;
  private readonly now: () => number;

  constructor(opts: LoginGuardOptions = {}) {
    this.maxFailures = opts.maxFailures ?? 10;
    this.windowMs = opts.windowMs ?? 15 * 60_000;
    this.maxEntries = opts.maxEntries ?? 50_000;
    this.maxLockMs = opts.maxLockMs ?? 4 * 3600_000;
    this.decayMs = opts.decayMs ?? 24 * 3600_000;
    this.now = opts.now ?? Date.now;
  }

  /** 账号当前被锁定时返回剩余毫秒数，否则返回 0 */
  lockedFor(account: string): number {
    const e = this.map.get(account);
    if (!e) return 0;
    const t = this.now();
    if (e.lockedUntil > t) return e.lockedUntil - t;
    if (t - e.since > this.windowMs && (e.locks === 0 || t - e.last > this.decayMs)) this.map.delete(account);
    return 0;
  }

  fail(account: string): void {
    const t = this.now();
    let e = this.map.get(account);
    if (!e || t - e.since > this.windowMs) {
      // 新窗口：沿用“被锁过几次”，除非已经很久没有失败
      const locks = e && t - e.last <= this.decayMs ? e.locks : 0;
      e = { failures: 0, since: t, lockedUntil: 0, locks, last: t };
      this.map.delete(account);
      this.map.set(account, e);
      this.prune(t);
    }
    e.failures += 1;
    e.last = t;
    if (e.failures >= this.maxFailures && e.lockedUntil <= t) {
      e.lockedUntil = t + Math.min(this.windowMs * 2 ** e.locks, this.maxLockMs);
      e.locks += 1;
    }
  }

  succeed(account: string): void {
    this.map.delete(account);
  }

  private prune(t: number): void {
    if (this.map.size <= this.maxEntries) return;
    for (const [k, e] of this.map) {
      if (e.lockedUntil <= t && t - e.since > this.windowMs && t - e.last > this.decayMs) this.map.delete(k);
    }
    // 仍然超限：按插入顺序丢掉最旧的记录
    while (this.map.size > this.maxEntries) {
      const oldest = this.map.keys().next().value;
      if (oldest === undefined) break;
      this.map.delete(oldest);
    }
  }
}
