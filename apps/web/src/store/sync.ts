import { create } from "zustand";

/** 学习事件同步状态：用于页头的小徽标和闯关结束提示 */
interface SyncState {
  pending: number;
  lastSyncedAt: number | null;
  lastError: string | null;
  notice: { id: number; text: string; to?: string; toLabel?: string } | null;
  set: (p: Partial<Omit<SyncState, "set" | "notify">>) => void;
  notify: (text: string, to?: string, toLabel?: string) => void;
}

let nid = 0;
export const useSync = create<SyncState>((set) => ({
  pending: 0,
  lastSyncedAt: null,
  lastError: null,
  notice: null,
  set: (p) => set(p),
  notify: (text, to, toLabel) => set({ notice: { id: ++nid, text, to, toLabel } }),
}));
