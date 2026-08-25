import { useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { ArrowLeft, LogIn, Pencil, MoreHorizontal, Ban, CheckCircle2, Trash2, Bell, ExternalLink } from "lucide-react";
import {
  useAdminOrganization,
  useAdminOrgActivity,
  useOrgBillingHistory,
  useSuspendOrganization,
  useReactivateOrganization,
  useDeleteOrganization,
  useNotifyOrganization,
  useStartImpersonation,
  useEditTenant,
} from "@/hooks/useAdmin";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/components/ui/Toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Label, Textarea } from "@/components/ui/Input";
import { Skeleton } from "@/components/ui/Skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/Tabs";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/Table";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/Dialog";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/DropdownMenu";
import { TenantStatusBadge } from "@/components/admin/TenantStatusBadge";
import { UsageBar } from "@/components/admin/UsageBar";
import { ActivityFeed } from "@/components/admin/ActivityFeed";
import { ConfirmActionDialog } from "@/components/admin/ConfirmActionDialog";
import { formatCurrency, formatDate } from "@/lib/utils";

export default function TenantDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const toast = useToast();
  const { switchOrganization, user } = useAuth();
  const { data: org, isLoading } = useAdminOrganization(id);

  const suspend = useSuspendOrganization();
  const reactivate = useReactivateOrganization();
  const del = useDeleteOrganization();
  const notify = useNotifyOrganization();
  const impersonate = useStartImpersonation();
  const editTenant = useEditTenant(id);

  const [suspendOpen, setSuspendOpen] = useState(false);
  const [suspendReason, setSuspendReason] = useState("");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [confirmName, setConfirmName] = useState("");
  const [notifyOpen, setNotifyOpen] = useState(false);
  const [notifySubject, setNotifySubject] = useState("");
  const [notifyMessage, setNotifyMessage] = useState("");
  const [impersonateOpen, setImpersonateOpen] = useState(false);
  const [impersonateReason, setImpersonateReason] = useState("");
  const [editOpen, setEditOpen] = useState(false);
  const [editName, setEditName] = useState("");

  const canMutate = user?.platformRole === "SUPER_ADMIN" || user?.platformRole === "PLATFORM_ADMIN";
  const canDelete = user?.platformRole === "SUPER_ADMIN";

  if (isLoading || !org) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-40" />
      </div>
    );
  }

  function openEdit() {
    if (!org) return;
    setEditName(org.name);
    setEditOpen(true);
  }

  async function handleEditSave() {
    try {
      await editTenant.mutateAsync({ name: editName });
      toast.success("Tenant updated.");
      setEditOpen(false);
    } catch {
      toast.error("Failed to update tenant.");
    }
  }

  async function handleImpersonate() {
    if (!org) return;
    try {
      await impersonate.mutateAsync({ id: org.id, reason: impersonateReason });
      switchOrganization(org.id);
      navigate("/app");
    } catch {
      toast.error("Failed to start tenant access.");
    }
  }

  async function handleSuspend() {
    if (!org) return;
    try {
      await suspend.mutateAsync({ id: org.id, reason: suspendReason || undefined });
      toast.success(`${org.name} has been suspended.`);
      setSuspendOpen(false);
      setSuspendReason("");
    } catch {
      toast.error("Failed to suspend tenant.");
    }
  }

  async function handleReactivate() {
    if (!org) return;
    try {
      await reactivate.mutateAsync(org.id);
      toast.success(`${org.name} has been reactivated.`);
    } catch {
      toast.error("Failed to reactivate tenant.");
    }
  }

  async function handleDelete() {
    if (!org) return;
    try {
      await del.mutateAsync({ id: org.id, confirmName });
      toast.success(`${org.name} has been permanently deleted.`);
      navigate("/admin/tenants");
    } catch {
      toast.error("Failed to delete tenant. Check that the name matches exactly.");
    }
  }

  async function handleNotify() {
    if (!org) return;
    try {
      await notify.mutateAsync({ id: org.id, subject: notifySubject, message: notifyMessage });
      toast.success(`Notification sent to ${org.name}.`);
      setNotifyOpen(false);
      setNotifySubject("");
      setNotifyMessage("");
    } catch {
      toast.error("Failed to send notification.");
    }
  }

  return (
    <div>
      <Link to="/admin/tenants" className="mb-4 inline-flex items-center gap-1.5 text-sm text-fg-secondary hover:text-fg">
        <ArrowLeft className="h-4 w-4" /> Back to tenants
      </Link>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold text-fg">{org.name}</h1>
            <TenantStatusBadge status={org.status} />
          </div>
          <p className="mt-1 text-sm text-fg-secondary">
            {org.owner?.email ?? org.slug} · <span className="capitalize">{org.plan.toLowerCase()}</span> plan · created {formatDate(org.createdAt)}
          </p>
          {org.suspended && org.suspendedReason && <p className="mt-1 text-sm text-danger">Reason: {org.suspendedReason}</p>}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={() => setImpersonateOpen(true)}>
            <LogIn className="h-4 w-4" /> Login as Tenant
          </Button>
          <Button variant="secondary" onClick={openEdit}>
            <Pencil className="h-4 w-4" /> Edit
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="secondary">
                <MoreHorizontal className="h-4 w-4" /> More Actions
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              {canMutate && (
                <DropdownMenuItem onSelect={() => setNotifyOpen(true)}>
                  <Bell className="mr-2 h-4 w-4" /> Send Notification
                </DropdownMenuItem>
              )}
              {canMutate && (
                <>
                  <DropdownMenuSeparator />
                  {org.suspended ? (
                    <DropdownMenuItem onSelect={handleReactivate}>
                      <CheckCircle2 className="mr-2 h-4 w-4" /> Reactivate
                    </DropdownMenuItem>
                  ) : (
                    <DropdownMenuItem onSelect={() => setSuspendOpen(true)} className="text-danger">
                      <Ban className="mr-2 h-4 w-4" /> Suspend
                    </DropdownMenuItem>
                  )}
                </>
              )}
              {canDelete && (
                <DropdownMenuItem onSelect={() => setDeleteOpen(true)} className="text-danger">
                  <Trash2 className="mr-2 h-4 w-4" /> Delete
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardHeader>
            <CardTitle>Users</CardTitle>
          </CardHeader>
          <CardContent className="pt-2 text-2xl font-semibold text-fg">
            {org.usage.users.used} / {org.usage.users.cap ?? "∞"}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Invoices this month</CardTitle>
          </CardHeader>
          <CardContent className="pt-2 text-2xl font-semibold text-fg">
            {org.usage.invoicesThisMonth.used} / {org.usage.invoicesThisMonth.cap ?? "∞"}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Customers</CardTitle>
          </CardHeader>
          <CardContent className="pt-2 text-2xl font-semibold text-fg">{org.usage.customers.used}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Subscription</CardTitle>
          </CardHeader>
          <CardContent className="pt-2 text-2xl font-semibold text-fg capitalize">{org.plan.toLowerCase()}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Monthly value</CardTitle>
          </CardHeader>
          <CardContent className="pt-2 text-2xl font-semibold text-fg">{formatCurrency(org.monthlyValue)}</CardContent>
        </Card>
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="subscription">Subscription</TabsTrigger>
          <TabsTrigger value="usage">Usage</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
          <TabsTrigger value="billing">Billing</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4">
          <OverviewTab org={org} />
        </TabsContent>
        <TabsContent value="users" className="mt-4">
          <UsersTab org={org} />
        </TabsContent>
        <TabsContent value="subscription" className="mt-4">
          <SubscriptionTab org={org} />
        </TabsContent>
        <TabsContent value="usage" className="mt-4">
          <UsageTab org={org} />
        </TabsContent>
        <TabsContent value="activity" className="mt-4">
          <ActivityTab orgId={org.id} />
        </TabsContent>
        <TabsContent value="billing" className="mt-4">
          <BillingTab orgId={org.id} />
        </TabsContent>
        <TabsContent value="settings" className="mt-4">
          <SettingsTab org={org} onSuspend={() => setSuspendOpen(true)} onReactivate={handleReactivate} canMutate={canMutate} />
        </TabsContent>
      </Tabs>

      <ConfirmActionDialog
        open={suspendOpen}
        onOpenChange={setSuspendOpen}
        title={`Suspend ${org.name}?`}
        description="Suspending this tenant will prevent all organization users from accessing InvoiceFlow until it's reactivated. Data is preserved."
        confirmLabel="Suspend tenant"
        onConfirm={handleSuspend}
        loading={suspend.isPending}
      >
        <Label htmlFor="suspend-reason">Reason (optional)</Label>
        <Input id="suspend-reason" value={suspendReason} onChange={(e) => setSuspendReason(e.target.value)} placeholder="e.g. Overdue billing" />
      </ConfirmActionDialog>

      <ConfirmActionDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={`Delete ${org.name}?`}
        description="This permanently deletes all of this tenant's invoices, quotes, customers, and payment records. This cannot be undone."
        confirmLabel="Permanently delete"
        onConfirm={handleDelete}
        loading={del.isPending}
        disabled={confirmName !== org.name}
      >
        <Label htmlFor="confirm-name">
          Type <span className="font-semibold text-fg">{org.name}</span> to confirm
        </Label>
        <Input id="confirm-name" value={confirmName} onChange={(e) => setConfirmName(e.target.value)} />
      </ConfirmActionDialog>

      <ConfirmActionDialog
        open={impersonateOpen}
        onOpenChange={setImpersonateOpen}
        title={`Access ${org.name}?`}
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

      <Dialog open={notifyOpen} onOpenChange={setNotifyOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Notify {org.name}</DialogTitle>
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
            <Button variant="secondary" onClick={() => setNotifyOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleNotify} disabled={notify.isPending || !notifySubject.trim() || !notifyMessage.trim()}>
              Send notification
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit {org.name}</DialogTitle>
            <DialogDescription>Updates this tenant's business name.</DialogDescription>
          </DialogHeader>
          <Label htmlFor="edit-name">Business name</Label>
          <Input id="edit-name" value={editName} onChange={(e) => setEditName(e.target.value)} />
          <div className="mt-5 flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setEditOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleEditSave} disabled={editTenant.isPending || !editName.trim()}>
              Save
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

type OrgDetail = NonNullable<ReturnType<typeof useAdminOrganization>["data"]>;

function OverviewTab({ org }: { org: OrgDetail }) {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Tenant information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <Row label="Business name" value={org.name} />
          <Row label="Email" value={org.email ?? "-"} />
          <Row label="Phone" value={org.phone ?? "-"} />
          <Row label="Address" value={org.address ?? "-"} />
          <Row label="Tenant ID" value={org.id} mono />
          <Row label="Created" value={formatDate(org.createdAt)} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Owner</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {org.owner ? (
            <>
              <Row label="Name" value={org.owner.name} />
              <Row label="Email" value={org.owner.email} />
              <Row label="Joined" value={formatDate(org.owner.joinedAt)} />
            </>
          ) : (
            <p className="text-fg-muted">No owner on record.</p>
          )}
        </CardContent>
      </Card>

      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>Recent activity</CardTitle>
        </CardHeader>
        <CardContent>
          <ActivityFeed items={org.recentActivity} />
        </CardContent>
      </Card>
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between border-b border-border py-1.5 last:border-0">
      <span className="text-fg-muted">{label}</span>
      <span className={mono ? "font-mono text-xs text-fg" : "text-fg"}>{value}</span>
    </div>
  );
}

function UsersTab({ org }: { org: OrgDetail }) {
  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <THead>
            <TR>
              <TH>User</TH>
              <TH>Email</TH>
              <TH>Role</TH>
              <TH>Joined</TH>
              <TH>Last active</TH>
            </TR>
          </THead>
          <TBody>
            {org.members.map((m) => (
              <TR key={m.id}>
                <TD className="font-medium">{m.user.name}</TD>
                <TD>{m.user.email}</TD>
                <TD>
                  <Badge variant="neutral" className="capitalize">
                    {m.role.toLowerCase()}
                  </Badge>
                </TD>
                <TD>{formatDate(m.createdAt)}</TD>
                <TD>{m.user.lastLoginAt ? formatDate(m.user.lastLoginAt) : "Never"}</TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function SubscriptionTab({ org }: { org: OrgDetail }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Current plan</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        <Row label="Plan" value={org.plan} />
        <Row label="Status" value={org.status} />
        <Row label="Billing interval" value={org.billingInterval} />
        <Row label="Renewal date" value={org.currentPeriodEnd ? formatDate(org.currentPeriodEnd) : "-"} />
        <p className="pt-3 text-xs text-fg-muted">
          Plan changes, upgrades, downgrades, and cancellations are handled by the tenant through the Stripe customer portal from their own
          Billing settings.
        </p>
      </CardContent>
    </Card>
  );
}

function UsageTab({ org }: { org: OrgDetail }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Usage this month</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <UsageBar label="Users" used={org.usage.users.used} cap={org.usage.users.cap} />
        <UsageBar label="Invoices" used={org.usage.invoicesThisMonth.used} cap={org.usage.invoicesThisMonth.cap} />
        <UsageBar label="Customers" used={org.usage.customers.used} cap={null} />
      </CardContent>
    </Card>
  );
}

function ActivityTab({ orgId }: { orgId: string }) {
  const [page, setPage] = useState(1);
  const { data, isLoading } = useAdminOrgActivity(orgId, { page });

  if (isLoading || !data) return <Skeleton className="h-64" />;

  return (
    <Card>
      <CardContent>
        <ActivityFeed items={data.items} />
        {data.total > data.pageSize && (
          <div className="mt-4 flex items-center justify-center gap-2">
            <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              Previous
            </Button>
            <Button variant="secondary" size="sm" disabled={page * data.pageSize >= data.total} onClick={() => setPage((p) => p + 1)}>
              Next
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function BillingTab({ orgId }: { orgId: string }) {
  const { data: invoices, isLoading } = useOrgBillingHistory(orgId);

  if (isLoading) return <Skeleton className="h-64" />;
  if (!invoices || invoices.length === 0) {
    return <EmptyState icon={CheckCircle2} title="No billing history" description="This tenant hasn't been billed yet." />;
  }

  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <THead>
            <TR>
              <TH>Date</TH>
              <TH>Amount</TH>
              <TH>Status</TH>
              <TH></TH>
            </TR>
          </THead>
          <TBody>
            {invoices.map((inv) => (
              <TR key={inv.id}>
                <TD>{formatDate(inv.created)}</TD>
                <TD>{formatCurrency(inv.amount, inv.currency.toUpperCase())}</TD>
                <TD className="capitalize">{inv.status}</TD>
                <TD>
                  {inv.hostedInvoiceUrl && (
                    <a href={inv.hostedInvoiceUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-brand-600 hover:underline">
                      View <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function SettingsTab({
  org,
  onSuspend,
  onReactivate,
  canMutate,
}: {
  org: OrgDetail;
  onSuspend: () => void;
  onReactivate: () => void;
  canMutate: boolean;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Platform overrides</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <p className="text-fg-secondary">
          Platform-level controls for this tenant. The tenant's own business settings (branding, invoice defaults, team) are managed by the
          tenant itself under Settings, not here.
        </p>
        <Row label="Account status" value={org.status} />
        {canMutate && (
          <div className="pt-2">
            {org.suspended ? (
              <Button variant="secondary" onClick={onReactivate}>
                <CheckCircle2 className="h-4 w-4" /> Reactivate tenant
              </Button>
            ) : (
              <Button variant="danger" onClick={onSuspend}>
                <Ban className="h-4 w-4" /> Suspend tenant
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
