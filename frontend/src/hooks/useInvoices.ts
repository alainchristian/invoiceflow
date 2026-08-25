import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";
import type { Invoice, Payment } from "@/types";

export interface InvoiceListParams {
  status?: string;
  search?: string;
  page?: number;
}

export function useInvoices(params: InvoiceListParams = {}) {
  return useQuery({
    queryKey: ["invoices", params],
    queryFn: async () =>
      (await api.get<{ invoices: Invoice[]; total: number; page: number; pageSize: number }>("/invoices", {
        params,
      })).data,
  });
}

export function useInvoice(id: string | undefined) {
  return useQuery({
    queryKey: ["invoices", id],
    queryFn: async () => (await api.get<Invoice>(`/invoices/${id}`)).data,
    enabled: !!id,
  });
}

export interface InvoiceFormItem {
  description: string;
  quantity: number;
  unitPrice: number;
  taxRate?: number;
  discount?: number;
  timeEntryId?: string;
}

export interface InvoiceFormValues {
  customerId: string;
  issueDate?: string;
  dueDate: string;
  currency?: string;
  poNumber?: string;
  notes?: string;
  terms?: string;
  invoiceDiscountType?: "FLAT" | "PERCENT";
  invoiceDiscountValue?: number;
  depositAmount?: number | null;
  items: InvoiceFormItem[];
}

function invalidateInvoiceQueries(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ["invoices"] });
  qc.invalidateQueries({ queryKey: ["dashboard"] });
  qc.invalidateQueries({ queryKey: ["customers"] });
}

export function useCreateInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: InvoiceFormValues) => (await api.post<Invoice>("/invoices", data)).data,
    onSuccess: () => invalidateInvoiceQueries(qc),
  });
}

export function useUpdateInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: InvoiceFormValues }) =>
      (await api.put<Invoice>(`/invoices/${id}`, data)).data,
    onSuccess: () => invalidateInvoiceQueries(qc),
  });
}

export function useDeleteInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => api.delete(`/invoices/${id}`),
    onSuccess: () => invalidateInvoiceQueries(qc),
  });
}

export function useDuplicateInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => (await api.post<Invoice>(`/invoices/${id}/duplicate`)).data,
    onSuccess: () => invalidateInvoiceQueries(qc),
  });
}

export function useSendInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => (await api.post<Invoice>(`/invoices/${id}/send`)).data,
    onSuccess: () => invalidateInvoiceQueries(qc),
  });
}

export function useSendReminder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) =>
      (await api.post<{ invoice: Invoice; notifiedCount: number }>(`/invoices/${id}/remind`)).data,
    onSuccess: () => {
      invalidateInvoiceQueries(qc);
      qc.invalidateQueries({ queryKey: ["notifications"] });
    },
  });
}

export function useUpdateInvoiceStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) =>
      (await api.patch<Invoice>(`/invoices/${id}/status`, { status })).data,
    onSuccess: () => invalidateInvoiceQueries(qc),
  });
}

export function useRecordPayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      amount,
      method,
      notes,
    }: {
      id: string;
      amount: number;
      method: string;
      notes?: string;
    }) => (await api.post(`/invoices/${id}/payments`, { amount, method, notes })).data,
    onSuccess: () => invalidateInvoiceQueries(qc),
  });
}

export function useRecordRefund() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, amount, reason }: { id: string; amount: number; reason?: string }) =>
      (await api.post<{ payment: Payment; invoice: Invoice }>(`/invoices/${id}/refunds`, { amount, reason })).data,
    onSuccess: () => invalidateInvoiceQueries(qc),
  });
}

export function publicInvoicePdfUrl(token: string) {
  return `${import.meta.env.VITE_API_URL || "http://localhost:4000/api"}/public/invoices/${token}/pdf`;
}

// The authed PDF endpoint requires an Authorization + X-Organization-Id
// header, which a plain <a href> can't send -- so we fetch it as a blob
// (picking up those headers via the shared axios interceptor) and trigger
// the download manually instead of linking to the URL directly.
export async function downloadInvoicePdf(id: string, number: string) {
  const response = await api.get(`/invoices/${id}/pdf`, { responseType: "blob" });
  const url = window.URL.createObjectURL(new Blob([response.data], { type: "application/pdf" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `invoice-${number}.pdf`;
  link.click();
  window.URL.revokeObjectURL(url);
}

export async function downloadInvoicesCsv(params: InvoiceListParams = {}) {
  const response = await api.get("/invoices/export.csv", { params, responseType: "blob" });
  const url = window.URL.createObjectURL(new Blob([response.data], { type: "text/csv" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `invoices-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  window.URL.revokeObjectURL(url);
}
