import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";
import type { Invoice, RecurringInvoice } from "@/types";

export interface RecurringInvoiceListParams {
  status?: string;
  customerId?: string;
}

export function useRecurringInvoices(params: RecurringInvoiceListParams = {}) {
  return useQuery({
    queryKey: ["recurring-invoices", params],
    queryFn: async () =>
      (await api.get<{ schedules: RecurringInvoice[] }>("/recurring-invoices", { params })).data,
  });
}

export function useRecurringInvoice(id: string | undefined) {
  return useQuery({
    queryKey: ["recurring-invoices", id],
    queryFn: async () => (await api.get<RecurringInvoice>(`/recurring-invoices/${id}`)).data,
    enabled: !!id,
  });
}

export interface RecurringInvoiceFormItem {
  description: string;
  quantity: number;
  unitPrice: number;
  taxRate?: number;
  discount?: number;
}

export interface RecurringInvoiceFormValues {
  customerId: string;
  frequency: string;
  currency?: string;
  dueInDays?: number;
  generateAsDraft?: boolean;
  notes?: string;
  terms?: string;
  startDate: string;
  endDate?: string;
  items: RecurringInvoiceFormItem[];
}

function invalidateRecurringQueries(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ["recurring-invoices"] });
  qc.invalidateQueries({ queryKey: ["dashboard"] });
}

export function useCreateRecurringInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: RecurringInvoiceFormValues) =>
      (await api.post<RecurringInvoice>("/recurring-invoices", data)).data,
    onSuccess: () => invalidateRecurringQueries(qc),
  });
}

export function useUpdateRecurringInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: RecurringInvoiceFormValues }) =>
      (await api.put<RecurringInvoice>(`/recurring-invoices/${id}`, data)).data,
    onSuccess: () => invalidateRecurringQueries(qc),
  });
}

export function useDeleteRecurringInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => api.delete(`/recurring-invoices/${id}`),
    onSuccess: () => invalidateRecurringQueries(qc),
  });
}

export function useUpdateRecurringInvoiceStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) =>
      (await api.patch<RecurringInvoice>(`/recurring-invoices/${id}/status`, { status })).data,
    onSuccess: () => invalidateRecurringQueries(qc),
  });
}

export function useRunRecurringInvoiceNow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => (await api.post<Invoice>(`/recurring-invoices/${id}/run-now`)).data,
    onSuccess: () => {
      invalidateRecurringQueries(qc);
      qc.invalidateQueries({ queryKey: ["invoices"] });
    },
  });
}
