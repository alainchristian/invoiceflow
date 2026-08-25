import { useState } from "react";
import { Link } from "react-router-dom";
import { UsersRound, Search, ShieldCheck } from "lucide-react";
import { useAdminUsers } from "@/hooks/useAdmin";
import { Card, CardContent } from "@/components/ui/Card";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/Table";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { formatDate } from "@/lib/utils";

export default function Users() {
  const [search, setSearch] = useState("");
  const { data: users = [], isLoading } = useAdminUsers(search);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-fg">Users</h1>
        <p className="mt-1 text-sm text-fg-secondary">Every user account across every tenant, for support lookups.</p>
      </div>

      <div className="mb-4 relative max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-muted" />
        <Input placeholder="Search by name or email..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-3 p-5">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-10" />
              ))}
            </div>
          ) : users.length === 0 ? (
            <EmptyState icon={UsersRound} title="No users found" description="Try a different search." />
          ) : (
            <Table>
              <THead>
                <TR>
                  <TH>Name</TH>
                  <TH>Email</TH>
                  <TH>Organizations</TH>
                  <TH>Last active</TH>
                  <TH>Joined</TH>
                </TR>
              </THead>
              <TBody>
                {users.map((u) => (
                  <TR key={u.id}>
                    <TD>
                      <Link to={`/admin/users/${u.id}`} className="flex items-center gap-1.5 font-medium text-brand-600 hover:underline">
                        {u.name}
                        {u.platformRole && (
                          <span title="Platform administrator">
                            <ShieldCheck className="h-3.5 w-3.5 text-brand-600" />
                          </span>
                        )}
                      </Link>
                    </TD>
                    <TD>{u.email}</TD>
                    <TD>
                      <div className="flex flex-wrap gap-1">
                        {u.memberships.length === 0 ? (
                          <span className="text-fg-muted">-</span>
                        ) : (
                          u.memberships.map((m) => (
                            <Badge key={m.organization.id} variant="neutral">
                              {m.organization.name}
                            </Badge>
                          ))
                        )}
                      </div>
                    </TD>
                    <TD>{u.lastLoginAt ? formatDate(u.lastLoginAt) : "Never"}</TD>
                    <TD>{formatDate(u.createdAt)}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
