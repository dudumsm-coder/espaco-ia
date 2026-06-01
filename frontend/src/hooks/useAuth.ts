"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/auth.store";
import { authService } from "@/services/auth.service";

export function useAuth() {
  const { user, setUser, logout, isAuthenticated } = useAuthStore();
  const router = useRouter();

  useEffect(() => {
    if (isAuthenticated() && !user) {
      authService.me().then(setUser).catch(() => {
        logout();
        router.push("/login");
      });
    }
  }, [isAuthenticated, user, setUser, logout, router]);

  return { user, logout, isAuthenticated: isAuthenticated() };
}
