import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";
import type { AnalyticsSummary } from "@/types";

export function useAnalyticsSummary(enabled = true) {
  return useQuery({
    queryKey: ["dashboard", "analytics"],
    queryFn: async () => (await api.get<AnalyticsSummary>("/dashboard/analytics")).data,
    retry: false,
    enabled,
  });
}
