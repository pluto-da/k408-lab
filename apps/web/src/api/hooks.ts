import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { MistakeDto, ProgressResponse, PublicUser, Subject } from "@k408/shared";
import { api } from "./client";
import { useAuth } from "../store/auth";

export function useMe() {
  const setUser = useAuth((s) => s.setUser);
  return useQuery({
    queryKey: ["me"],
    queryFn: async () => {
      try {
        const r = await api<{ user: PublicUser | null }>("/me");
        setUser(r.user);
        return r.user;
      } catch (e) {
        setUser(null);
        throw e;
      }
    },
    staleTime: 5 * 60_000,
    retry: 1,
  });
}

export function useLogin() {
  const qc = useQueryClient();
  const setUser = useAuth((s) => s.setUser);
  return useMutation({
    mutationFn: (v: { account: string; password: string }) => api<{ user: PublicUser }>("/auth/login", { body: v }),
    onSuccess: (r) => {
      setUser(r.user);
      qc.setQueryData(["me"], r.user);
      void qc.invalidateQueries({ predicate: (q) => q.queryKey[0] !== "me" });
    },
  });
}

export function useRegister() {
  const qc = useQueryClient();
  const setUser = useAuth((s) => s.setUser);
  return useMutation({
    mutationFn: (v: { username?: string; email?: string; password: string; nickname?: string }) =>
      api<{ user: PublicUser }>("/auth/register", { body: v }),
    onSuccess: (r) => {
      setUser(r.user);
      qc.setQueryData(["me"], r.user);
    },
  });
}

export function useLogout() {
  const qc = useQueryClient();
  const setUser = useAuth((s) => s.setUser);
  return useMutation({
    mutationFn: () => api<{ ok: true }>("/auth/logout", { method: "POST", body: {} }),
    onSuccess: () => {
      setUser(null);
      qc.clear();
      qc.setQueryData(["me"], null);
    },
  });
}

export function useUpdateProfile() {
  const qc = useQueryClient();
  const setUser = useAuth((s) => s.setUser);
  return useMutation({
    mutationFn: (v: { nickname: string }) => api<{ user: PublicUser }>("/me", { method: "PATCH", body: v }),
    onSuccess: (r) => {
      setUser(r.user);
      qc.setQueryData(["me"], r.user);
    },
  });
}

export function useProgress(enabled: boolean) {
  return useQuery({ queryKey: ["progress"], queryFn: () => api<ProgressResponse>("/progress"), enabled });
}

export type MistakeStatus = "active" | "mastered" | "all";
export interface MistakeFilter {
  subject?: Subject;
  status: MistakeStatus;
}
export interface MistakeList {
  items: MistakeDto[];
  counts: Record<Subject, { active: number; mastered: number }>;
}

export function useMistakes(f: MistakeFilter, enabled: boolean) {
  const qs = new URLSearchParams({ status: f.status });
  if (f.subject) qs.set("subject", f.subject);
  return useQuery({ queryKey: ["mistakes", f], queryFn: () => api<MistakeList>(`/mistakes?${qs}`), enabled });
}

export function useMistakeActions() {
  const qc = useQueryClient();
  const done = () => {
    void qc.invalidateQueries({ queryKey: ["mistakes"] });
    void qc.invalidateQueries({ queryKey: ["progress"] });
  };
  return {
    setMastered: useMutation({
      mutationFn: (v: { id: string; mastered: boolean }) =>
        api<{ item: MistakeDto }>(`/mistakes/${v.id}`, { method: "PATCH", body: { mastered: v.mastered } }),
      onSuccess: done,
    }),
    remove: useMutation({
      mutationFn: (id: string) => api<{ ok: true }>(`/mistakes/${id}`, { method: "DELETE" }),
      onSuccess: done,
    }),
    redo: useMutation({
      mutationFn: (v: { id: string; answer: number }) =>
        api<{ correct: boolean; item: MistakeDto }>(`/mistakes/${v.id}/redo`, { body: { answer: v.answer } }),
    }),
    refresh: done,
  };
}
