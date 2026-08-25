import { useState, type ReactNode } from "react";
import { useSearchParams, Link, useNavigate } from "react-router-dom";
import { Building2, Search, Download, ChevronUp, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import {
  useAdminOrganizations,
  useSuspendOrganization,
  useReactivateOrganization,
  useDeleteOrganization,
  useNotifyOrganization,
  useStartImpersonation,
  downloadOrganizationsCsv,
  type AdminOrgListItem,
} from "@/hooks/useAdmin";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/components/ui/Toast";
import { Card, CardContent } from "@/components/ui/Card";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/Table";
import { Input, Label, Textarea } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/Select";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { TenantStatusBadge } from "@/components/admin/TenantStatusBadge";
import { TenantActionsMenu } from "@/components/admin/TenantActionsMenu";
import { ConfirmActionDialog } from "@/components/admin/ConfirmActionDialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/Dialog";
import { formatDate } from "@/lib/utils";

const STATUS_OPTIONS = [
  { value: "ALL", label: "All statuses" },
  { value: "ACTIVE", label: "Active" },
  { value: "TRIAL", label: "Trial" },
  { value: "PAST_DUE", label: "Past due" },
  { value: "SUSPENDED", label: "Suspended" },
  { value: "CANCELLED", label: "Cancelled" },
];

const PLAN_OPTIONS = [
  { value: "ALL", label: "All plans" },
  { value: "STARTER", label: "Starter" },
  { value: "PROFESSIONAL", label: "Professional" },
  { value: "BUSINESS", label: "Business" },
];

export default function Tenants() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { switchOrganization, user } = useAuth();

  const search = params.get("search") ?? "";
  const status = params.get("status") ?? "ALL";
  const plan = params.get("plan") ?? "ALL";
  const sortBy = params.get("sortBy") ?? "createdAt";
  const sortDir = (params.get("sortDir") as "asc" | "desc") ?? "desc";
  const page = Number(params.get("page") ?? "1");

  const { data, isLoading } = useAdminOrganizations({
    search,
    status: status === "ALL" ? undefined : status,
    plan: plan === "ALL" ? undefined : plan,
    sortBy,
    sortDir,
    page,
    pageSize: 20,
  });

  const suspend = useSuspendOrganization();
  const reactivate = useReactivateOrganization();
  const del = useDeleteOrganization();
  const notify = useNotifyOrganization();
  const impersonate = useStartImpersonation();

  const [suspendTarget, setSuspendTarget] = useState<AdminOrgListItem | null>(null);
  const [suspendReason, setSuspendReason] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<AdminOrgListItem | null>(null);
  const [confirmName, setConfirmName] = useState("");
  const [notifyTarget, setNotifyTarget] = useState<AdminOrgListItem | null>(null);
  const [notifySubject, setNotifySubject] = useState("");
  const [notifyMessage, setNotifyMessage] = useState("");
  const [impersonateTarget, setImpersonateTarget] = useState<AdminOrgListItem | null>(null);
  const [impersonateReason, setImpersonateReason] = useState("");

  const canMutate = user?.platformRole === "SUPER_ADMIN" || user?.platformRole === "PLATFORM_ADMIN";
  const canDelete = user?.platformRole === "SUPER_ADMIN";

  function updateParam(key: string, value: string | null) {
    const next = new URLSearchParams(params);
    if (value && value !== "ALL") next.set(key, value);
    else next.delete(key);
    if (key !== "page") next.delete("page");
    setParams(next);
  }

  function toggleSort(column: string) {
    if (sortBy === column) updateParam("sortDir", sortDir === "asc" ? "desc" : "asc");
    else {
      const next = new URLSearchParams(params);
      next.set("sortBy", column);
      next.set("sortDir", "desc");
      next.delete("page");
      setParams(next);
    }
  }

  async function handleImpersonate() {
    if (!impersonateTarget) return;
    try {
      await impersonate.mutateAsync({ id: impersonateTarget.id, reason: impersonateReason });
      switchOrganization(impersonateTarget.id);
      navigate("/app");
    } catch {
      toast.error("Failed to start tenant access.");
    }
  }

  async function handleSuspend() {
    if (!suspendTarget) return;
    try {
      await suspend.mutateAsync({ id: suspendTarget.id, reason: suspendReason || undefined });
      toast.success(`${suspendTarget.name} has been suspended.`);
      setSuspendTarget(null);
      setSuspendReason("");
    } catch {
      toast.error("Failed to suspend tenant.");
    }
  }

  async function handleReactivate(tenant: AdminOrgListItem) {
    try {
      await reactivate.mutateAsync(tenant.id);
      toast.success(`${tenant.name} has been reactivated.`);
    } catch {
      toast.error("Failed to reactivate tenant.");
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      await del.mutateAsync({ id: deleteTarget.id, confirmName });
      toast.success(`${deleteTarget.name} has been permanently deleted.`);
      setDeleteTarget(null);
      setConfirmName("");
    } catch {
      toast.error("Failed to delete tenant. Check that the name matches exactly.");
    }
  }

  async function handleNotify() {
    if (!notifyTarget) return;
    try {
      await notify.mutateAsync({ id: notifyTarget.id, subject: notifySubject, message: notifyMessage });
      toast.success(`Notification sent to ${notifyTarget.name}.`);
      setNotifyTarget(null);
      setNotifySubject("");
      setNotifyMessage("");
    } catch {
      toast.error("Failed to send notification.");
    }
  }

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  function SortHeader({ column, children }: { column: string; children: ReactNode }) {
    return (
      <TH>
        <button onClick={() => toggleSort(column)} className="flex items-center gap-1 hover:text-fg">
          {children}
          {sortBy === column && (sortDir === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)}
        </button>
      </TH>
    );
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-fg">Tenants</h1>
          <p className="mt-1 text-sm text-fg-secondary">Manage and monitor all organizations using InvoiceFlow.</p>
        </div>
        <Button variant="secondary" onClick={() => downloadOrganizationsCsv({ search, status: status === "ALL" ? undefined : status, plan: plan === "ALL" ? undefined : plan })}>
          <Download className="h-4 w-4" /> Export
        </Button>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative max-w-sm flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-muted" />
          <Input
            placeholder="Search by tenant name, owner, email, or ID..."
            value={search}
            onChange={(e) => updateParam("search", e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={status} onValueChange={(v) => updateParam("status", v)}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={plan} onValueChange={(v) => updateParam("plan", v)}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PLAN_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-3 p-5">
              {[...Array(6)].map((_, i) => (
                <Skeleton key={i} className="h-10" />
              ))}
            </div>
          ) : !data || data.organizations.length === 0 ? (
            <EmptyState
              icon={Building2}
              title="No tenants found"
              description="Try adjusting your search or filters."
              action={
                <Button variant="secondary" onClick={() => setParams(new URLSearchParams())}>
                  Clear filters
                </Button>
              }
            />
          ) : (
            <Table>
              <THead>
                <TR>
                  <SortHeader column="name">Tenant</SortHeader>
                  <TH>Owner</TH>
                  <TH>Plan</TH>
                  <SortHeader column="members">Users</SortHeader>
                  <TH>Status</TH>
                  <SortHeader column="createdAt">Joined</SortHeader>
                  <TH></TH>
                </TR>
              </THead>
              <TBody>
                {data.organizations.map((org) => (
                  <TR key={org.id}>
                    <TD>
                      <Link to={`/admin/tenants/${org.id}`} className="font-medium text-brand-600 hover:underline">
                        {org.name}
                      </Link>
                      <p className="text-xs text-fg-muted">{org.slug}</p>
                    </TD>
                    <TD>
                      {org.owner ? (
                        <>
                          <p className="text-fg">{org.owner.name}</p>
                          <p className="text-xs text-fg-muted">{org.owner.email}</p>
                        </>
                      ) : (
                        <span className="text-fg-muted">-</span>
                      )}
                    </TD>
                    <TD className="capitalize">{org.plan.toLowerCase()}</TD>
                    <TD>{org.memberCount}</TD>
                    <TD>
                      <TenantStatusBadge status={org.status} />
                    </TD>
                    <TD>{formatDate(org.createdAt)}</TD>
                    <TD>
                      <TenantActionsMenu
                        tenant={org}
                        canMutate={canMutate}
                        canDelete={canDelete}
                        onView={() => navigate(`/admin/tenants/${org.id}`)}
                        onImpersonate={() => setImpersonateTarget(org)}
                        onNotify={() => setNotifyTarget(org)}
                        onSuspend={() => setSuspendTarget(org)}
                        onReactivate={() => handleReactivate(org)}
                        onDelete={() => setDeleteTarget(org)}
                      />
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {data && data.total > 0 && (
        <div className="mt-4 flex items-center justify-between text-sm text-fg-secondary">
          <span>
            Showing {(page - 1) * data.pageSize + 1}-{Math.min(page * data.pageSize, data.total)} of {data.total}
          </span>
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => updateParam("page", String(page - 1))}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span>
              Page {page} of {totalPages}
            </span>
            <Button variant="secondary" size="sm" disabled={page >= totalPages} onClick={() => updateParam("page", String(page + 1))}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      <ConfirmActionDialog
        open={!!suspendTarget}
        onOpenChange={(open) => !open && setSuspendTarget(null)}
        title={`Suspend ${suspendTarget?.name}?`}
        description="Suspending this tenant will prevent all organization users from accessing InvoiceFlow until it's reactivated. Data is preserved."
        confirmLabel="Suspend tenant"
        onConfirm={handleSuspend}
        loading={suspend.isPending}
      >
        <Label htmlFor="suspend-reason">Reason (optional)</Label>
        <Input id="suspend-reason" value={suspendReason} onChange={(e) => setSuspendReason(e.target.value)} placeholder="e.g. Overdue billing" />
      </ConfirmActionDialog>

      <ConfirmActionDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title={`Delete ${deleteTarget?.name}?`}
        description="This permanently deletes all of this tenant's invoices, quotes, customers, and payment records. This cannot be undone."
        confirmLabel="Permanently delete"
        onConfirm={handleDelete}
        loading={del.isPending}
        disabled={confirmName !== deleteTarget?.name}
      >
        <Label htmlFor="confirm-name">
          Type <span className="font-semibold text-fg">{deleteTarget?.name}</span> to confirm
        </Label>
        <Input id="confirm-name" value={confirmName} onChange={(e) => setConfirmName(e.target.value)} />
      </ConfirmActionDialog>

      <ConfirmActionDialog
        open={!!impersonateTarget}
        onOpenChange={(open) => !open && setImpersonateTarget(null)}
        title={`Access ${impersonateTarget?.name}?`}
        description="You are about to access this tenant's environment for support purposes. This is logged."
        confirmLabel="Continue"
        confirmVariant="primary"
        onConfirm={handleImpersonate}
        loading={impersonate.isPending}
        disabled={impersonateReason.trim().length < 3}
      >
        <Label htmlFor="impersonate-reason">Reason</Label>
        <Input id="impersonate-reason" value={impersonateReason} onChange={(e) => setImpersonateReason(e.target.value)} placeholder="e.g. Investigating a support ticket" />
      </ConfirmActionDialog>

      <Dialog open={!!notifyTarget} onOpenChange={(open) => !open && setNotifyTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Notify {notifyTarget?.name}</DialogTitle>
            <DialogDescription>Sends an in-app notification to every member and an email to the tenant owner.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor="notify-subject">Subject</Label>
              <Input id="notify-subject" value={notifySubject} onChange={(e) => setNotifySubject(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="notify-message">Message</Label>
              <Textarea id="notify-message" rows={4} value={notifyMessage} onChange={(e) => setNotifyMessage(e.target.value)} />
            </div>
          </div>
          <div className="mt-5 flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setNotifyTarget(null)}>
              Cancel
            </Button>
            <Button onClick={handleNotify} disabled={notify.isPending || !notifySubject.trim() || !notifyMessage.trim()}>
              Send notification
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
