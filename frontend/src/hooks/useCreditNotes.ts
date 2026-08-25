import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";
import type { CreditNote } from "@/types";

export interface CreditNoteListParams {
  status?: string;
  customerId?: string;
}

export function useCreditNotes(params: CreditNoteListParams = {}) {
  return useQuery({
    queryKey: ["credit-notes", params],
    queryFn: async () =>
      (await api.get<{ creditNotes: CreditNote[] }>("/credit-notes", { params })).data,
  });
}

export function useCreditNote(id: string | undefined) {
  return useQuery({
    queryKey: ["credit-notes", id],
    queryFn: async () => (await api.get<CreditNote>(`/credit-notes/${id}`)).data,
    enabled: !!id,
  });
}

export interface CreditNoteFormItem {
  description: string;
  quantity: number;
  unitPrice: number;
  taxRate?: number;
  discount?: number;
}

export interface CreditNoteFormValues {
  customerId: string;
  invoiceId?: string;
  currency?: string;
  reason?: string;
  notes?: string;
  items: CreditNoteFormItem[];
}

function invalidateCreditNoteQueries(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ["credit-notes"] });
}

export function useCreateCreditNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: CreditNoteFormValues) => (await api.post<CreditNote>("/credit-notes", data)).data,
    onSuccess: () => invalidateCreditNoteQueries(qc),
  });
}

export function useUpdateCreditNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: CreditNoteFormValues }) =>
      (await api.put<CreditNote>(`/credit-notes/${id}`, data)).data,
    onSuccess: () => invalidateCreditNoteQueries(qc),
  });
}

export function useDeleteCreditNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => api.delete(`/credit-notes/${id}`),
    onSuccess: () => invalidateCreditNoteQueries(qc),
  });
}

export function useIssueCreditNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => (await api.post<CreditNote>(`/credit-notes/${id}/issue`)).data,
    onSuccess: () => invalidateCreditNoteQueries(qc),
  });
}

export function useVoidCreditNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => (await api.post<CreditNote>(`/credit-notes/${id}/void`)).data,
    onSuccess: () => invalidateCreditNoteQueries(qc),
  });
}

export async function downloadCreditNotePdf(id: string, number: string) {
  const response = await api.get(`/credit-notes/${id}/pdf`, { responseType: "blob" });
  const url = window.URL.createObjectURL(new Blob([response.data], { type: "application/pdf" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `credit-note-${number}.pdf`;
  link.click();
  window.URL.revokeObjectURL(url);
}
