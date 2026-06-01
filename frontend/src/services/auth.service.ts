import api from "@/lib/api";
import type { TokenResponse, User } from "@/types";

export const authService = {
  register: (data: { name: string; email: string; password: string }) =>
    api.post<TokenResponse>("/auth/register", data).then((r) => r.data),

  login: (data: { email: string; password: string }) =>
    api.post<TokenResponse>("/auth/login", data).then((r) => r.data),

  me: () => api.get<User>("/auth/me").then((r) => r.data),
};
