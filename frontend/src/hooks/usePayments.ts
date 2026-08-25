import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";
import type { Invoice, Payment } from "@/types";

export interface PaymentRow extends Payment {
  invoice: Invoice;
}

export function usePayments() {
  return useQuery({
    queryKey: ["payments"],
    queryFn: async () => (await api.get<PaymentRow[]>("/payments")).data,
  });
}
