import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";
import type { Member, Organization } from "@/types";

export function useCurrentOrganization() {
  return useQuery({
    queryKey: ["organization", "current"],
    queryFn: async () => (await api.get<Organization>("/organizations/current")).data,
  });
}

export function useUpdateOrganization() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: Partial<Organization>) =>
      (await api.put<Organization>("/organizations/current", data)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["organization"] }),
  });
}

export function useMembers() {
  return useQuery({
    queryKey: ["organization", "members"],
    queryFn: async () => (await api.get<Member[]>("/organizations/members")).data,
  });
}

export function useInviteMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ email, role }: { email: string; role: string }) =>
      (await api.post<Member>("/organizations/members", { email, role })).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["organization", "members"] }),
  });
}

export function useUpdateMemberRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, role }: { id: string; role: string }) =>
      (await api.patch(`/organizations/members/${id}`, { role })).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["organization", "members"] }),
  });
}

export function useRemoveMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => api.delete(`/organizations/members/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["organization", "members"] }),
  });
}
