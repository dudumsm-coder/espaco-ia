import api from "@/lib/api";
import type { User } from "@/types";

export const authService = {
  me: () => api.get<User>("/auth/me").then((r) => r.data),
};
