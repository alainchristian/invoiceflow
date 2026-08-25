import { useState } from "react";
import { Link } from "react-router-dom";
import { ScrollText, Search, ChevronLeft, ChevronRight } from "lucide-react";
import { useAdminActivity } from "@/hooks/useAdmin";
import { Card, CardContent } from "@/components/ui/Card";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/Table";
import { Badge } from "@/components/ui/Badge";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { formatDate } from "@/lib/utils";

export default function Activity() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const { data, isLoading } = useAdminActivity({ search, page, pageSize: 30 });

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-fg">Activity Logs</h1>
        <p className="mt-1 text-sm text-fg-secondary">Every admin action and cross-tenant access, most recent first.</p>
      </div>

      <div className="mb-4 relative max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-muted" />
        <Input
          placeholder="Search by admin or tenant name..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          className="pl-9"
        />
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-3 p-5">
              {[...Array(6)].map((_, i) => (
                <Skeleton key={i} className="h-8" />
              ))}
            </div>
          ) : !data || data.logs.length === 0 ? (
            <EmptyState icon={ScrollText} title="No activity yet" description="Admin actions will show up here." />
          ) : (
            <Table>
              <THead>
                <TR>
                  <TH>Action</TH>
                  <TH>Admin</TH>
                  <TH>Tenant</TH>
                  <TH>When</TH>
                </TR>
              </THead>
              <TBody>
                {data.logs.map((log) => (
                  <TR key={log.id}>
                    <TD>
                      <Badge variant={log.action === "delete_organization" ? "danger" : "neutral"}>{log.actionLabel}</Badge>
                      {log.action === "cross_tenant_access" && log.metadata?.path ? (
                        <p className="mt-1 text-xs text-fg-muted">
                          {String(log.metadata.method)} {String(log.metadata.path)}
                        </p>
                      ) : null}
                      {(log.action === "impersonation_started" || log.action === "suspend_organization") && log.metadata?.reason ? (
                        <p className="mt-1 text-xs text-fg-muted">Reason: {String(log.metadata.reason)}</p>
                      ) : null}
                    </TD>
                    <TD>{log.adminName}</TD>
                    <TD>
                      {log.targetOrganizationId && log.action !== "delete_organization" ? (
                        <Link to={`/admin/tenants/${log.targetOrganizationId}`} className="text-brand-600 hover:underline">
                          {log.targetOrganizationName ?? log.targetOrganizationId}
                        </Link>
                      ) : (
                        log.targetOrganizationName ?? "-"
                      )}
                    </TD>
                    <TD>{formatDate(log.createdAt)}</TD>
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
            <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span>
              Page {page} of {totalPages}
            </span>
            <Button variant="secondary" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
