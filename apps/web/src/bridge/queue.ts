import { labEventSchema, type LabEvent } from "@k408/shared";

export type QueuedEvent = LabEvent & { eid: string; ts: number };

const STORAGE_KEY = "k408.pendingEvents";
const MAX_QUEUE = 500;

function newEid(): string {
  const c = globalThis.crypto;
  if (c && "randomUUID" in c) return c.randomUUID().replace(/-/g, "");
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`;
}

/** 校验旧版模块发出的事件；不合法的直接丢弃 */
export function normalize(detail: unknown): QueuedEvent | null {
  if (!detail || typeof detail !== "object") return null;
  const parsed = labEventSchema.safeParse(detail);
  if (!parsed.success) return null;
  const tsRaw = (detail as { ts?: unknown }).ts;
  const ts = typeof tsRaw === "number" && Number.isFinite(tsRaw) ? Math.round(tsRaw) : Date.now();
  return { ...parsed.data, eid: newEid(), ts };
}

/**
 * 内存队列（同时镜像到 sessionStorage，离开实验室页面整页刷新后不丢）。
 * 未登录时事件留在队列里；登录后一次性补传。
 */
export class EventQueue {
  private items: QueuedEvent[] = [];

  constructor(private readonly storage: Storage | null = typeof sessionStorage === "undefined" ? null : sessionStorage) {
    try {
      const raw = this.storage?.getItem(STORAGE_KEY);
      if (raw) this.items = (JSON.parse(raw) as unknown[]).filter((x): x is QueuedEvent => !!x && typeof x === "object" && "eid" in x);
    } catch {
      this.items = [];
    }
  }

  get size(): number {
    return this.items.length;
  }

  push(e: QueuedEvent): void {
    this.items.push(e);
    if (this.items.length > MAX_QUEUE) this.items.splice(0, this.items.length - MAX_QUEUE);
    this.persist();
  }

  peek(n: number): QueuedEvent[] {
    return this.items.slice(0, n);
  }

  /** 删除已成功上报的事件 */
  ack(eids: Set<string>): void {
    this.items = this.items.filter((e) => !eids.has(e.eid));
    this.persist();
  }

  clear(): void {
    this.items = [];
    this.persist();
  }

  private persist(): void {
    try {
      if (this.items.length) this.storage?.setItem(STORAGE_KEY, JSON.stringify(this.items));
      else this.storage?.removeItem(STORAGE_KEY);
    } catch {
      /* 存储已满或被禁用时只保留内存队列 */
    }
  }
}
