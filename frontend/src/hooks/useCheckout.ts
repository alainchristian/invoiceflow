import { useMutation } from "@tanstack/react-query";
import api from "@/lib/api";

export function usePublicCheckout(token: string | undefined) {
  return useMutation({
    mutationFn: async (amount?: number) =>
      (await api.post<{ url: string }>(`/public/invoices/${token}/checkout`, amount ? { amount } : {})).data,
  });
}
