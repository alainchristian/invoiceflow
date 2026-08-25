import { useState } from "react";
import { UserPlus, Trash2 } from "lucide-react";
import { useMembers, useInviteMember, useUpdateMemberRole, useRemoveMember } from "@/hooks/useOrganization";
import { useAuth } from "@/context/AuthContext";
import { PageHeader } from "@/components/layout/Topbar";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/Select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/Dialog";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/Table";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";

const ROLES = ["OWNER", "ADMIN", "ACCOUNTANT", "MEMBER"];

export default function SettingsTeam() {
  const { data: members = [], isLoading } = useMembers();
  const inviteMember = useInviteMember();
  const updateRole = useUpdateMemberRole();
  const removeMember = useRemoveMember();
  const { activeOrg } = useAuth();
  const toast = useToast();
  const canManage = activeOrg?.role === "OWNER" || activeOrg?.role === "ADMIN";

  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("MEMBER");

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    try {
      await inviteMember.mutateAsync({ email, role });
      toast.success("Member added");
      setEmail("");
      setOpen(false);
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Could not add that member");
    }
  }

  return (
    <div>
      <PageHeader
        title="Team"
        subtitle="Who has access to this organization."
        actions={
          canManage && (
            <Button onClick={() => setOpen(true)}>
              <UserPlus className="h-4 w-4" /> Invite member
            </Button>
          )
        }
      />

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-3 p-5">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-10" />
              ))}
            </div>
          ) : (
            <Table>
              <THead>
                <TR>
                  <TH>Name</TH>
                  <TH>Email</TH>
                  <TH>Role</TH>
                  {canManage && <TH></TH>}
                </TR>
              </THead>
              <TBody>
                {members.map((m) => (
                  <TR key={m.id}>
                    <TD>{m.user.name}</TD>
                    <TD>{m.user.email}</TD>
                    <TD>
                      {canManage ? (
                        <Select value={m.role} onValueChange={(v) => updateRole.mutate({ id: m.id, role: v })}>
                          <SelectTrigger className="h-8 w-36">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {ROLES.map((r) => (
                              <SelectItem key={r} value={r}>
                                {r.charAt(0) + r.slice(1).toLowerCase()}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        m.role.charAt(0) + m.role.slice(1).toLowerCase()
                      )}
                    </TD>
                    {canManage && (
                      <TD>
                        <button
                          onClick={async () => {
                            try {
                              await removeMember.mutateAsync(m.id);
                              toast.success("Member removed");
                            } catch (err: any) {
                              toast.error(err.response?.data?.error || "Could not remove member");
                            }
                          }}
                          className="text-fg-muted hover:text-danger"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </TD>
                    )}
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invite a team member</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleInvite} className="flex flex-col gap-4">
            <div>
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
              <p className="mt-1 text-xs text-fg-muted">They need an existing InvoiceFlow account with this email.</p>
            </div>
            <div>
              <Label htmlFor="role">Role</Label>
              <Select value={role} onValueChange={setRole}>
                <SelectTrigger id="role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLES.map((r) => (
                    <SelectItem key={r} value={r}>
                      {r.charAt(0) + r.slice(1).toLowerCase()}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button type="submit" className="self-end" disabled={inviteMember.isPending}>
              Add member
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
