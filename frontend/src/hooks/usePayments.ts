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

export async function downloadPaymentsCsv() {
  const response = await api.get("/payments/export.csv", { responseType: "blob" });
  const url = window.URL.createObjectURL(new Blob([response.data], { type: "text/csv" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `payments-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  window.URL.revokeObjectURL(url);
}
