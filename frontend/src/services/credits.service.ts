import api from "@/lib/api";
import type { CreditPackage } from "@/types";

export const creditsService = {
  getBalance: () => api.get<{ credits: number }>("/credits/balance").then((r) => r.data),
  listPackages: () => api.get<CreditPackage[]>("/credits/packages").then((r) => r.data),
  createCheckout: (packageId: number) =>
    api.post<{ checkout_url: string }>(`/credits/checkout/${packageId}`).then((r) => r.data),
};
