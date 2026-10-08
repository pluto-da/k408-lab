import type { QueryClient } from "@tanstack/react-query";
import { api, ApiError } from "../api/client";
import { useAuth } from "../store/auth";
import { useSync } from "../store/sync";
import { EventQueue, normalize } from "./queue";

const BATCH = 50;

let queue: EventQueue | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;
let flushing = false;
let backoff = 1000;
let qc: QueryClient | null = null;

function update() {
  useSync.getState().set({ pending: queue?.size ?? 0 });
}

function schedule(ms: number) {
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => void flush(), ms);
}

export async function flush(opts: { keepalive?: boolean } = {}): Promise<void> {
  if (!queue || flushing || queue.size === 0) return;
  if (useAuth.getState().status !== "authed") return;
  flushing = true;
  try {
    while (queue.size > 0) {
      const batch = queue.peek(BATCH);
      await api<{ accepted: number; rejected: { index: number; reason: string }[] }>("/events", {
        body: { events: batch },
        keepalive: opts.keepalive,
      });
      // 被服务端拒绝的事件（数据不合规）也一并移出队列，不再重试
      queue.ack(new Set(batch.map((e) => e.eid)));
    }
    backoff = 1000;
    useSync.getState().set({ lastSyncedAt: Date.now(), lastError: null });
    void qc?.invalidateQueries({ queryKey: ["progress"] });
    void qc?.invalidateQueries({ queryKey: ["mistakes"] });
  } catch (e) {
    if (e instanceof ApiError && e.status === 401) {
      useAuth.getState().setUser(null);
    } else {
      useSync.getState().set({ lastError: e instanceof Error ? e.message : "同步失败" });
      backoff = Math.min(backoff * 2, 60_000);
      schedule(backoff);
    }
  } finally {
    flushing = false;
    update();
  }
}

function onLabEvent(ev: Event) {
  const e = normalize((ev as CustomEvent).detail);
  if (!e || !queue) return;
  queue.push(e);
  update();
  if (useAuth.getState().status !== "authed") return;
  schedule(1500);
}

/** 在应用启动时调用一次：监听 lab:event，登录态变化时补传 */
export function installLabBridge(client: QueryClient): () => void {
  if (queue) return () => {};
  qc = client;
  queue = new EventQueue();
  update();
  window.addEventListener("lab:event", onLabEvent);
  const unsub = useAuth.subscribe((s, prev) => {
    if (s.status === "authed" && prev.status !== "authed") void flush();
  });
  const onHide = () => {
    if (document.visibilityState === "hidden") void flush({ keepalive: true });
  };
  document.addEventListener("visibilitychange", onHide);
  return () => {
    window.removeEventListener("lab:event", onLabEvent);
    document.removeEventListener("visibilitychange", onHide);
    unsub();
    queue = null;
  };
}
