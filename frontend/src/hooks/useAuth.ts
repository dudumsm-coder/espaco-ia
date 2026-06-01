"use client";
import { useUser, useClerk } from "@clerk/nextjs";
import { useQuery } from "@tanstack/react-query";
import { authService } from "@/services/auth.service";

export function useAuth() {
  const { user: clerkUser, isLoaded, isSignedIn } = useUser();
  const { signOut } = useClerk();

  const { data: dbUser } = useQuery({
    queryKey: ["me", clerkUser?.id],
    queryFn: authService.me,
    enabled: !!isSignedIn,
  });

  return {
    user: dbUser ?? null,
    clerkUser,
    isLoaded,
    isAuthenticated: !!isSignedIn,
    logout: () => signOut({ redirectUrl: "/" }),
  };
}
