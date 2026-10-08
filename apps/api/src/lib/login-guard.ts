/**
 * 按账号统计登录失败次数（进程内存）。
 * 按 IP 的限流挡不住“换 IP 撞同一个账号”，这里再加一道：同一账号在窗口期内失败过多就暂时锁定。
 * 单实例部署足够；多实例时应换成 Redis 等共享存储。
 */
export interface LoginGuardOptions {
  /** 窗口期内允许的最大失败次数 */
  maxFailures?: number;
  /** 统计窗口与锁定时长（毫秒） */
  windowMs?: number;
  /** 最多记录多少个账号，防止被大量随机账号撑爆内存 */
  maxEntries?: number;
  now?: () => number;
}

interface Entry {
  failures: number;
  /** 窗口开始时间 */
  since: number;
  /** 锁定到期时间（0 表示未锁定） */
  lockedUntil: number;
}

export class LoginGuard {
  private readonly map = new Map<string, Entry>();
  private readonly maxFailures: number;
  private readonly windowMs: number;
  private readonly maxEntries: number;
  private readonly now: () => number;

  constructor(opts: LoginGuardOptions = {}) {
    this.maxFailures = opts.maxFailures ?? 10;
    this.windowMs = opts.windowMs ?? 15 * 60_000;
    this.maxEntries = opts.maxEntries ?? 50_000;
    this.now = opts.now ?? Date.now;
  }

  /** 账号当前被锁定时返回剩余毫秒数，否则返回 0 */
  lockedFor(account: string): number {
    const e = this.map.get(account);
    if (!e) return 0;
    const t = this.now();
    if (e.lockedUntil > t) return e.lockedUntil - t;
    if (t - e.since > this.windowMs) this.map.delete(account);
    return 0;
  }

  fail(account: string): void {
    const t = this.now();
    let e = this.map.get(account);
    if (!e || t - e.since > this.windowMs) {
      e = { failures: 0, since: t, lockedUntil: 0 };
      this.map.delete(account);
      this.map.set(account, e);
      this.prune(t);
    }
    e.failures += 1;
    if (e.failures >= this.maxFailures) e.lockedUntil = t + this.windowMs;
  }

  succeed(account: string): void {
    this.map.delete(account);
  }

  private prune(t: number): void {
    if (this.map.size <= this.maxEntries) return;
    for (const [k, e] of this.map) {
      if (e.lockedUntil <= t && t - e.since > this.windowMs) this.map.delete(k);
    }
    // 仍然超限：按插入顺序丢掉最旧的记录
    while (this.map.size > this.maxEntries) {
      const oldest = this.map.keys().next().value;
      if (oldest === undefined) break;
      this.map.delete(oldest);
    }
  }
}
