import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";

export type PlatformRole = "SUPER_ADMIN" | "PLATFORM_ADMIN" | "SUPPORT_ADMIN";
export type TenantStatus = "ACTIVE" | "TRIAL" | "PAST_DUE" | "SUSPENDED" | "CANCELLED";

export interface TenantOwner {
  id?: string;
  name: string;
  email: string;
}

export interface AdminOrgListItem {
  id: string;
  name: string;
  slug: string;
  plan: string;
  subscriptionStatus: string | null;
  suspended: boolean;
  currentPeriodEnd: string | null;
  createdAt: string;
  status: TenantStatus;
  owner: TenantOwner | null;
  memberCount: number;
  invoiceCount: number;
}

export interface OrgListFilters {
  search?: string;
  status?: string;
  plan?: string;
  joinedFrom?: string;
  joinedTo?: string;
  sortBy?: string;
  sortDir?: "asc" | "desc";
  page?: number;
  pageSize?: number;
}

export interface OrgListResult {
  organizations: AdminOrgListItem[];
  total: number;
  page: number;
  pageSize: number;
}

export interface AdminOrgMember {
  id: string;
  role: string;
  createdAt: string;
  user: { id: string; name: string; email: string; lastLoginAt: string | null };
}

export interface ActivityFeedItem {
  id: string;
  type: string;
  label: string;
  amount?: number;
  currency?: string;
  metadata?: Record<string, unknown> | null;
  timestamp: string;
}

export interface AdminOrgDetail extends Omit<AdminOrgListItem, "owner"> {
  members: AdminOrgMember[];
  owner: { id: string; name: string; email: string; joinedAt: string } | null;
  suspendedAt: string | null;
  suspendedReason: string | null;
  totalInvoiced: number;
  totalCollected: number;
  monthlyValue: number;
  billingInterval: string;
  usage: {
    users: { used: number; cap: number | null };
    invoicesThisMonth: { used: number; cap: number | null };
    customers: { used: number; cap: number | null };
  };
  recentActivity: ActivityFeedItem[];
  _count: { invoices: number; customers: number; quotes: number };
  email: string | null;
  phone: string | null;
  address: string | null;
  taxId: string | null;
}

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  platformRole: PlatformRole | null;
  lastLoginAt: string | null;
  createdAt: string;
  memberships: { role: string; organization: { id: string; name: string } }[];
}

export interface AdminUserDetail {
  id: string;
  name: string;
  email: string;
  platformRole: PlatformRole | null;
  lastLoginAt: string | null;
  createdAt: string;
  memberships: {
    id: string;
    role: string;
    createdAt: string;
    organization: { id: string; name: string; plan: string; suspended: boolean };
  }[];
}

export interface AdminAuditLogEntry {
  id: string;
  adminUserId: string;
  adminName: string;
  action: string;
  actionLabel: string;
  targetOrganizationId: string | null;
  targetOrganizationName: string | null;
  targetUserId: string | null;
  metadata: Record<string, unknown> | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
}

export interface AdminPlan {
  id: string;
  name: string;
  priceMonthly: number;
  description: string;
  features: string[];
  invoiceCapPerMonth: number | null;
  seatCap: number | null;
  recurringInvoicesAllowed: boolean;
}

export interface AdminSubscription extends AdminOrgListItem {
  amount: number;
  billingInterval: string;
}

export interface AdminAdministrator {
  id: string;
  name: string;
  email: string;
  platformRole: PlatformRole;
  lastLoginAt: string | null;
  createdAt: string;
}

export interface AdminSettings {
  registrationEnabled: boolean;
  platformName: string;
  supportEmail: string | null;
  updatedAt: string;
}

export interface DashboardKpis {
  totalTenants: number;
  activeTenants: number;
  trialTenants: number;
  suspendedTenants: number;
  pastDueTenants: number;
  totalPlatformUsers: number;
  mrr: number;
}

export interface DashboardData {
  kpis: DashboardKpis;
  tenantGrowth: { label: string; newTenants: number; activeTenants: number }[];
  planDistribution: { plan: string; count: number }[];
  recentTenants: { id: string; name: string; plan: string; status: TenantStatus; createdAt: string; owner: TenantOwner | null }[];
  attentionRequired: { id: string; name: string; status: TenantStatus; reason: string; owner: TenantOwner | null }[];
}

function toQueryParams<T extends object>(filters: T) {
  const params: Record<string, string> = {};
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== null && value !== "") params[key] = String(value);
  }
  return params;
}

export function useAdminDashboard(period: "7d" | "30d" | "3m" | "12m") {
  return useQuery({
    queryKey: ["admin", "dashboard", period],
    queryFn: async () => (await api.get<DashboardData>("/admin/dashboard", { params: { period } })).data,
  });
}

export function useAdminOrganizations(filters: OrgListFilters) {
  return useQuery({
    queryKey: ["admin", "organizations", filters],
    queryFn: async () => (await api.get<OrgListResult>("/admin/organizations", { params: toQueryParams(filters) })).data,
  });
}

export function useAdminOrganization(id: string | undefined) {
  return useQuery({
    queryKey: ["admin", "organizations", "detail", id],
    queryFn: async () => (await api.get<AdminOrgDetail>(`/admin/organizations/${id}`)).data,
    enabled: !!id,
  });
}

export function useAdminOrgActivity(id: string | undefined, opts: { type?: string; page?: number }) {
  return useQuery({
    queryKey: ["admin", "organizations", "activity", id, opts],
    queryFn: async () =>
      (await api.get<{ items: ActivityFeedItem[]; total: number; page: number; pageSize: number }>(
        `/admin/organizations/${id}/activity`,
        { params: toQueryParams(opts) }
      )).data,
    enabled: !!id,
  });
}

export function useOrgBillingHistory(id: string | undefined) {
  return useQuery({
    queryKey: ["admin", "organizations", "billing-history", id],
    queryFn: async () =>
      (await api.get<{ invoices: { id: string; amount: number; currency: string; status: string; created: string; hostedInvoiceUrl: string | null }[] }>(
        `/admin/organizations/${id}/billing-history`
      )).data.invoices,
    enabled: !!id,
  });
}

export function useSuspendOrganization() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason?: string }) =>
      (await api.post(`/admin/organizations/${id}/suspend`, { reason })).data,
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: ["admin", "organizations"] });
      qc.invalidateQueries({ queryKey: ["admin", "organizations", "detail", id] });
    },
  });
}

export function useReactivateOrganization() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => (await api.post(`/admin/organizations/${id}/reactivate`)).data,
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: ["admin", "organizations"] });
      qc.invalidateQueries({ queryKey: ["admin", "organizations", "detail", id] });
    },
  });
}

export function useDeleteOrganization() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, confirmName }: { id: string; confirmName: string }) =>
      api.delete(`/admin/organizations/${id}`, { data: { confirmName } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "organizations"] }),
  });
}

export function useNotifyOrganization() {
  return useMutation({
    mutationFn: async ({ id, subject, message }: { id: string; subject: string; message: string }) =>
      api.post(`/admin/organizations/${id}/notify`, { subject, message }),
  });
}

export function useStartImpersonation() {
  return useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => api.post(`/admin/organizations/${id}/impersonate`, { reason }),
  });
}

export function useAdminUsers(search: string) {
  return useQuery({
    queryKey: ["admin", "users", search],
    queryFn: async () => (await api.get<{ users: AdminUser[] }>("/admin/users", { params: { search: search || undefined } })).data.users,
  });
}

export function useAdminUser(id: string | undefined) {
  return useQuery({
    queryKey: ["admin", "users", "detail", id],
    queryFn: async () => (await api.get<AdminUserDetail>(`/admin/users/${id}`)).data,
    enabled: !!id,
  });
}

export interface ActivityFilters {
  action?: string;
  adminUserId?: string;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}

export function useAdminActivity(filters: ActivityFilters) {
  return useQuery({
    queryKey: ["admin", "activity", filters],
    queryFn: async () =>
      (await api.get<{ logs: AdminAuditLogEntry[]; total: number; page: number; pageSize: number }>("/admin/activity", {
        params: toQueryParams(filters),
      })).data,
  });
}

export function useAdminPlans() {
  return useQuery({
    queryKey: ["admin", "plans"],
    queryFn: async () => (await api.get<{ plans: AdminPlan[] }>("/admin/plans")).data.plans,
  });
}

export interface SubscriptionFilters {
  search?: string;
  status?: string;
  plan?: string;
  renewalFrom?: string;
  renewalTo?: string;
  sortBy?: string;
  sortDir?: "asc" | "desc";
  page?: number;
  pageSize?: number;
}

export function useAdminSubscriptions(filters: SubscriptionFilters) {
  return useQuery({
    queryKey: ["admin", "subscriptions", filters],
    queryFn: async () =>
      (await api.get<{ subscriptions: AdminSubscription[]; total: number; page: number; pageSize: number }>("/admin/subscriptions", {
        params: toQueryParams(filters),
      })).data,
  });
}

export function useAdminAdministrators() {
  return useQuery({
    queryKey: ["admin", "administrators"],
    queryFn: async () => (await api.get<{ administrators: AdminAdministrator[] }>("/admin/administrators")).data.administrators,
  });
}

export function useGrantAdminRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ email, platformRole }: { email: string; platformRole: PlatformRole }) =>
      (await api.post("/admin/administrators", { email, platformRole })).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "administrators"] }),
  });
}

export function useChangeAdminRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, platformRole }: { id: string; platformRole: PlatformRole }) =>
      (await api.patch(`/admin/administrators/${id}`, { platformRole })).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "administrators"] }),
  });
}

export function useRevokeAdminRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => api.delete(`/admin/administrators/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "administrators"] }),
  });
}

export function useAdminSettings() {
  return useQuery({
    queryKey: ["admin", "settings"],
    queryFn: async () => (await api.get<AdminSettings>("/admin/settings")).data,
  });
}

export function useUpdateAdminSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: Partial<Pick<AdminSettings, "registrationEnabled" | "platformName" | "supportEmail">>) =>
      (await api.patch<AdminSettings>("/admin/settings", data)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "settings"] }),
  });
}

export async function downloadOrganizationsCsv(filters: OrgListFilters) {
  const response = await api.get("/admin/export/organizations.csv", { params: toQueryParams(filters), responseType: "blob" });
  const url = window.URL.createObjectURL(new Blob([response.data]));
  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", `tenants-${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}

// Edit-tenant reuses the tenant's own org-update endpoint via the existing
// cross-tenant bypass in requireOrgMember -- no new backend route needed,
// just pass the target org id as the X-Organization-Id header override.
export function useEditTenant(orgId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: Record<string, unknown>) =>
      (await api.put("/organizations/current", data, { headers: { "X-Organization-Id": orgId } })).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "organizations", "detail", orgId] }),
  });
}
