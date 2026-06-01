import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { User } from "@/types";

interface AuthState {
  user: User | null;
  access_token: string | null;
  refresh_token: string | null;
  setAuth: (user: User, access_token: string, refresh_token: string) => void;
  setUser: (user: User) => void;
  logout: () => void;
  isAuthenticated: () => boolean;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      access_token: null,
      refresh_token: null,

      setAuth: (user, access_token, refresh_token) => {
        localStorage.setItem("access_token", access_token);
        localStorage.setItem("refresh_token", refresh_token);
        set({ user, access_token, refresh_token });
      },

      setUser: (user) => set({ user }),

      logout: () => {
        localStorage.removeItem("access_token");
        localStorage.removeItem("refresh_token");
        set({ user: null, access_token: null, refresh_token: null });
      },

      isAuthenticated: () => !!get().access_token,
    }),
    { name: "espaco-ia-auth", partialize: (s) => ({ access_token: s.access_token, refresh_token: s.refresh_token, user: s.user }) }
  )
);
