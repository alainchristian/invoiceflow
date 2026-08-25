import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";
import type { ApiKey, WebhookEndpoint } from "@/types";

export function useApiKeys() {
  return useQuery({
    queryKey: ["api-keys"],
    queryFn: async () => (await api.get<ApiKey[]>("/api-keys")).data,
  });
}

export function useCreateApiKey() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (name: string) => (await api.post<ApiKey & { key: string }>("/api-keys", { name })).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["api-keys"] }),
  });
}

export function useRevokeApiKey() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => (await api.delete(`/api-keys/${id}`)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["api-keys"] }),
  });
}

export function useWebhookEndpoints() {
  return useQuery({
    queryKey: ["webhook-endpoints"],
    queryFn: async () => (await api.get<WebhookEndpoint[]>("/webhook-endpoints")).data,
  });
}

export function useCreateWebhookEndpoint() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: { url: string; subscribedEvents: string[] }) =>
      (await api.post<WebhookEndpoint>("/webhook-endpoints", data)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["webhook-endpoints"] }),
  });
}

export function useDeleteWebhookEndpoint() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => api.delete(`/webhook-endpoints/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["webhook-endpoints"] }),
  });
}
