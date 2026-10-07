import { create } from "zustand";
import type { PublicUser } from "@k408/shared";

type Status = "loading" | "anon" | "authed";

interface AuthState {
  status: Status;
  user: PublicUser | null;
  setUser: (u: PublicUser | null) => void;
}

export const useAuth = create<AuthState>((set) => ({
  status: "loading",
  user: null,
  setUser: (user) => set({ user, status: user ? "authed" : "anon" }),
}));
