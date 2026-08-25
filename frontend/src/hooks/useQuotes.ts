import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";
import type { Invoice, Quote } from "@/types";

export interface QuoteListParams {
  status?: string;
  search?: string;
  page?: number;
}

export function useQuotes(params: QuoteListParams = {}) {
  return useQuery({
    queryKey: ["quotes", params],
    queryFn: async () =>
      (await api.get<{ quotes: Quote[]; total: number; page: number; pageSize: number }>("/quotes", {
        params,
      })).data,
  });
}

export function useQuote(id: string | undefined) {
  return useQuery({
    queryKey: ["quotes", id],
    queryFn: async () => (await api.get<Quote>(`/quotes/${id}`)).data,
    enabled: !!id,
  });
}

export interface QuoteFormItem {
  description: string;
  quantity: number;
  unitPrice: number;
  taxRate?: number;
  discount?: number;
}

export interface QuoteFormValues {
  customerId: string;
  issueDate?: string;
  expiryDate?: string;
  currency?: string;
  poNumber?: string;
  notes?: string;
  terms?: string;
  invoiceDiscountType?: "FLAT" | "PERCENT";
  invoiceDiscountValue?: number;
  items: QuoteFormItem[];
}

function invalidateQuoteQueries(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ["quotes"] });
  qc.invalidateQueries({ queryKey: ["dashboard"] });
  qc.invalidateQueries({ queryKey: ["customers"] });
}

export function useCreateQuote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: QuoteFormValues) => (await api.post<Quote>("/quotes", data)).data,
    onSuccess: () => invalidateQuoteQueries(qc),
  });
}

export function useUpdateQuote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: QuoteFormValues }) =>
      (await api.put<Quote>(`/quotes/${id}`, data)).data,
    onSuccess: () => invalidateQuoteQueries(qc),
  });
}

export function useDeleteQuote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => api.delete(`/quotes/${id}`),
    onSuccess: () => invalidateQuoteQueries(qc),
  });
}

export function useDuplicateQuote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => (await api.post<Quote>(`/quotes/${id}/duplicate`)).data,
    onSuccess: () => invalidateQuoteQueries(qc),
  });
}

export function useSendQuote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => (await api.post<Quote>(`/quotes/${id}/send`)).data,
    onSuccess: () => invalidateQuoteQueries(qc),
  });
}

export function useUpdateQuoteStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) =>
      (await api.patch<Quote>(`/quotes/${id}/status`, { status })).data,
    onSuccess: () => invalidateQuoteQueries(qc),
  });
}

export function useConvertQuote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) =>
      (await api.post<{ quote: Quote; invoice: Invoice }>(`/quotes/${id}/convert`)).data,
    onSuccess: () => {
      invalidateQuoteQueries(qc);
      qc.invalidateQueries({ queryKey: ["invoices"] });
    },
  });
}

export function publicQuotePdfUrl(token: string) {
  return `${import.meta.env.VITE_API_URL || "http://localhost:4000/api"}/public/quotes/${token}/pdf`;
}

// The authed PDF endpoint requires an Authorization + X-Organization-Id
// header, which a plain <a href> can't send -- so we fetch it as a blob
// (picking up those headers via the shared axios interceptor) and trigger
// the download manually instead of linking to the URL directly.
export async function downloadQuotePdf(id: string, number: string) {
  const response = await api.get(`/quotes/${id}/pdf`, { responseType: "blob" });
  const url = window.URL.createObjectURL(new Blob([response.data], { type: "application/pdf" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `quote-${number}.pdf`;
  link.click();
  window.URL.revokeObjectURL(url);
}
