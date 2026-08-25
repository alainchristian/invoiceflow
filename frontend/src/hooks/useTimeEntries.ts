import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";
import type { TimeEntry } from "@/types";

export function useTimeEntries(params: { customerId?: string; billed?: boolean } = {}) {
  return useQuery({
    queryKey: ["time-entries", params],
    queryFn: async () => (await api.get<TimeEntry[]>("/time-entries", { params })).data,
  });
}

export function useUnbilledTimeEntries(customerId: string | undefined) {
  return useQuery({
    queryKey: ["time-entries", { customerId, billed: false }],
    queryFn: async () =>
      (await api.get<TimeEntry[]>("/time-entries", { params: { customerId, billed: false } })).data,
    enabled: !!customerId,
  });
}

export interface TimeEntryFormValues {
  customerId: string;
  description: string;
  minutes: number;
  hourlyRate: number;
  occurredAt: string;
}

export function useCreateTimeEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: TimeEntryFormValues) => (await api.post<TimeEntry>("/time-entries", data)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["time-entries"] }),
  });
}

export function useDeleteTimeEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => api.delete(`/time-entries/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["time-entries"] }),
  });
}
