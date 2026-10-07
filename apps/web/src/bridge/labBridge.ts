import type { QueryClient } from "@tanstack/react-query";
import { flowById } from "@k408/shared";
import { api, ApiError } from "../api/client";
import { useAuth } from "../store/auth";
import { useSync } from "../store/sync";
import { EventQueue, normalize, type QueuedEvent } from "./queue";

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
      const res = await api<{ accepted: number; rejected: { index: number; reason: string }[] }>("/events", {
        body: { events: batch },
        keepalive: opts.keepalive,
      });
      // 被服务端拒绝的事件（数据不合规）也一并移出队列，不再重试
      queue.ack(new Set(batch.map((e) => e.eid)));
      announce(batch, res.rejected.map((r) => r.index));
    }
    backoff = 1000;
    useSync.getState().set({ lastSyncedAt: Date.now(), lastError: null });
    void qc?.invalidateQueries({ queryKey: ["progress"] });
    void qc?.invalidateQueries({ queryKey: ["mistakes"] });
    void qc?.invalidateQueries({ queryKey: ["leaderboard"] });
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

function announce(batch: QueuedEvent[], rejected: number[]) {
  const finished = batch.filter((e, i) => e.type === "flow_finished" && !rejected.includes(i));
  const last = finished[finished.length - 1];
  if (last && last.type === "flow_finished") {
    const name = flowById(last.flowId)?.title ?? "闯关";
    useSync.getState().notify(`「${name}」成绩已记录`, `/leaderboard?flow=${last.flowId}`, "看排行榜");
  }
}

function onLabEvent(ev: Event) {
  const e = normalize((ev as CustomEvent).detail);
  if (!e || !queue) return;
  queue.push(e);
  update();
  const authed = useAuth.getState().status === "authed";
  if (!authed) {
    if (e.type === "flow_finished") useSync.getState().notify("登录后可保存闯关成绩、进入排行榜", "/login?next=/lab", "去登录");
    return;
  }
  schedule(e.type === "flow_finished" ? 0 : 1500);
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
