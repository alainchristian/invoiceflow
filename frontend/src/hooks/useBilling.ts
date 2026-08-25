import { useMutation, useQuery } from "@tanstack/react-query";
import api from "@/lib/api";
import type { PlanId } from "@/lib/plans";

export interface BillingSummary {
  plan: PlanId;
  subscriptionStatus: string | null;
  currentPeriodEnd: string | null;
  hasStripeCustomer: boolean;
  hasActiveSubscription: boolean;
  usage: {
    invoicesThisMonth: number;
    invoiceCap: number | null;
    seatsUsed: number;
    seatCap: number | null;
  };
}

export function useBillingSummary() {
  return useQuery({
    queryKey: ["billing", "summary"],
    queryFn: async () => (await api.get<BillingSummary>("/billing")).data,
  });
}

export function useStartCheckout() {
  return useMutation({
    mutationFn: async (plan: "PROFESSIONAL" | "BUSINESS") =>
      (await api.post<{ url: string }>("/billing/checkout", { plan })).data,
  });
}

export function useOpenBillingPortal() {
  return useMutation({
    mutationFn: async () => (await api.post<{ url: string }>("/billing/portal")).data,
  });
}
