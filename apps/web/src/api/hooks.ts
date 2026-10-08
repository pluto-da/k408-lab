import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { PublicUser } from "@k408/shared";
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
