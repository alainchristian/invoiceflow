import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";
import type { Expense } from "@/types";

export function useExpenses(params: { customerId?: string; billable?: boolean; billed?: boolean } = {}) {
  return useQuery({
    queryKey: ["expenses", params],
    queryFn: async () => (await api.get<Expense[]>("/expenses", { params })).data,
  });
}

export function useUnbilledExpenses(customerId: string | undefined) {
  return useQuery({
    queryKey: ["expenses", { customerId, billable: true, billed: false }],
    queryFn: async () =>
      (await api.get<Expense[]>("/expenses", { params: { customerId, billable: true, billed: false } })).data,
    enabled: !!customerId,
  });
}

export interface ExpenseFormValues {
  customerId?: string;
  description: string;
  amount: number;
  billable: boolean;
  occurredAt: string;
}

export function useCreateExpense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: ExpenseFormValues) => (await api.post<Expense>("/expenses", data)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["expenses"] }),
  });
}

export function useDeleteExpense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => api.delete(`/expenses/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["expenses"] }),
  });
}
