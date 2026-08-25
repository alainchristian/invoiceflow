import { useState } from "react";
import { ShieldCheck, UserPlus } from "lucide-react";
import {
  useAdminAdministrators,
  useGrantAdminRole,
  useChangeAdminRole,
  useRevokeAdminRole,
  type AdminAdministrator,
  type PlatformRole,
} from "@/hooks/useAdmin";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/components/ui/Toast";
import { Card, CardContent } from "@/components/ui/Card";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/Table";
import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/Dialog";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/Select";
import { ConfirmActionDialog } from "@/components/admin/ConfirmActionDialog";
import { formatDate } from "@/lib/utils";

const ROLE_LABEL: Record<PlatformRole, string> = {
  SUPER_ADMIN: "Super Admin",
  PLATFORM_ADMIN: "Platform Admin",
  SUPPORT_ADMIN: "Support Admin",
};

export default function Administrators() {
  const { user: currentUser } = useAuth();
  const toast = useToast();
  const { data: administrators, isLoading } = useAdminAdministrators();
  const grant = useGrantAdminRole();
  const changeRole = useChangeAdminRole();
  const revoke = useRevokeAdminRole();

  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<PlatformRole>("SUPPORT_ADMIN");
  const [revokeTarget, setRevokeTarget] = useState<AdminAdministrator | null>(null);

  async function handleInvite() {
    try {
      await grant.mutateAsync({ email: inviteEmail, platformRole: inviteRole });
      toast.success(`${inviteEmail} is now a ${ROLE_LABEL[inviteRole]}.`);
      setInviteOpen(false);
      setInviteEmail("");
      setInviteRole("SUPPORT_ADMIN");
    } catch (err: unknown) {
      const message =
        err && typeof err === "object" && "response" in err
          ? (err as { response?: { data?: { error?: string } } }).response?.data?.error
          : undefined;
      toast.error(message ?? "Failed to grant administrator access.");
    }
  }

  async function handleRoleChange(admin: AdminAdministrator, role: PlatformRole) {
    try {
      await changeRole.mutateAsync({ id: admin.id, platformRole: role });
      toast.success(`${admin.name}'s role updated to ${ROLE_LABEL[role]}.`);
    } catch {
      toast.error("Failed to update role. You can't remove the last remaining Super Admin.");
    }
  }

  async function handleRevoke() {
    if (!revokeTarget) return;
    try {
      await revoke.mutateAsync(revokeTarget.id);
      toast.success(`${revokeTarget.name} is no longer a platform administrator.`);
      setRevokeTarget(null);
    } catch {
      toast.error("Failed to revoke access. You can't remove the last remaining Super Admin.");
    }
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-fg">Administrators</h1>
          <p className="mt-1 text-sm text-fg-secondary">People with platform-level access to InvoiceFlow.</p>
        </div>
        <Button onClick={() => setInviteOpen(true)}>
          <UserPlus className="h-4 w-4" /> Grant Access
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-3 p-5">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-10" />
              ))}
            </div>
          ) : !administrators || administrators.length === 0 ? (
            <EmptyState icon={ShieldCheck} title="No administrators yet" description="Grant access to get started." />
          ) : (
            <Table>
              <THead>
                <TR>
                  <TH>Administrator</TH>
                  <TH>Email</TH>
                  <TH>Platform role</TH>
                  <TH>Last active</TH>
                  <TH>Created</TH>
                  <TH></TH>
                </TR>
              </THead>
              <TBody>
                {administrators.map((admin) => (
                  <TR key={admin.id}>
                    <TD className="font-medium">{admin.name}</TD>
                    <TD>{admin.email}</TD>
                    <TD>
                      {admin.id === currentUser?.id ? (
                        <Badge variant="brand">{ROLE_LABEL[admin.platformRole]}</Badge>
                      ) : (
                        <Select value={admin.platformRole} onValueChange={(v) => handleRoleChange(admin, v as PlatformRole)}>
                          <SelectTrigger className="w-40">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {(Object.keys(ROLE_LABEL) as PlatformRole[]).map((role) => (
                              <SelectItem key={role} value={role}>
                                {ROLE_LABEL[role]}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </TD>
                    <TD>{admin.lastLoginAt ? formatDate(admin.lastLoginAt) : "Never"}</TD>
                    <TD>{formatDate(admin.createdAt)}</TD>
                    <TD>
                      {admin.id !== currentUser?.id && (
                        <Button variant="ghost" size="sm" className="text-danger" onClick={() => setRevokeTarget(admin)}>
                          Revoke
                        </Button>
                      )}
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Grant platform access</DialogTitle>
            <DialogDescription>The person must already have an InvoiceFlow account. This grants them a platform role on it.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor="invite-email">Email</Label>
              <Input id="invite-email" type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder="person@example.com" />
            </div>
            <div>
              <Label htmlFor="invite-role">Platform role</Label>
              <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as PlatformRole)}>
                <SelectTrigger id="invite-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(ROLE_LABEL) as PlatformRole[]).map((role) => (
                    <SelectItem key={role} value={role}>
                      {ROLE_LABEL[role]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="mt-5 flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setInviteOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleInvite} disabled={grant.isPending || !inviteEmail.trim()}>
              Grant access
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmActionDialog
        open={!!revokeTarget}
        onOpenChange={(open) => !open && setRevokeTarget(null)}
        title={`Revoke ${revokeTarget?.name}'s access?`}
        description="They will no longer be able to access the Platform Admin portal or any tenant they aren't a real member of."
        confirmLabel="Revoke access"
        onConfirm={handleRevoke}
        loading={revoke.isPending}
      />
    </div>
  );
}
