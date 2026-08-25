import { useState } from "react";
import { Link } from "react-router-dom";
import { Search, AlertTriangle, CheckCircle2, ArrowRight } from "lucide-react";
import { useAdminDashboard, useAdminOrganizations } from "@/hooks/useAdmin";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { TenantStatusBadge } from "@/components/admin/TenantStatusBadge";

export default function Support() {
  const [search, setSearch] = useState("");
  const { data: dashboard, isLoading: dashboardLoading } = useAdminDashboard("30d");
  const { data: searchResults, isLoading: searchLoading } = useAdminOrganizations({ search, pageSize: 10 });

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-fg">Support Center</h1>
        <p className="mt-1 text-sm text-fg-secondary">Quickly find a tenant and see what needs attention right now.</p>
      </div>

      <div className="mb-6 relative max-w-lg">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-muted" />
        <Input placeholder="Search by tenant name, owner, or email..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
      </div>

      {search && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Results</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 p-0">
            {searchLoading ? (
              <div className="space-y-3 p-5">
                {[...Array(3)].map((_, i) => (
                  <Skeleton key={i} className="h-8" />
                ))}
              </div>
            ) : !searchResults || searchResults.organizations.length === 0 ? (
              <EmptyState icon={Search} title="No matches" description="Try a different search term." className="py-8" />
            ) : (
              <div className="divide-y divide-border">
                {searchResults.organizations.map((org) => (
                  <Link key={org.id} to={`/admin/tenants/${org.id}`} className="flex items-center justify-between px-5 py-3 hover:bg-surface-hover">
                    <div>
                      <p className="text-sm font-medium text-fg">{org.name}</p>
                      <p className="text-xs text-fg-muted">{org.owner?.email ?? org.slug}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <TenantStatusBadge status={org.status} />
                      <ArrowRight className="h-4 w-4 text-fg-muted" />
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Tenants requiring attention</CardTitle>
        </CardHeader>
        <CardContent>
          {dashboardLoading || !dashboard ? (
            <Skeleton className="h-32" />
          ) : dashboard.attentionRequired.length === 0 ? (
            <EmptyState icon={CheckCircle2} title="All clear" description="No tenants currently need attention." className="py-10" />
          ) : (
            <div className="divide-y divide-border">
              {dashboard.attentionRequired.map((t) => (
                <Link key={t.id} to={`/admin/tenants/${t.id}`} className="flex items-center justify-between py-3 first:pt-0 last:pb-0 hover:opacity-80">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 shrink-0 text-warning" />
                    <div>
                      <p className="text-sm font-medium text-fg">{t.name}</p>
                      <p className="text-xs text-fg-muted">{t.reason}</p>
                    </div>
                  </div>
                  <TenantStatusBadge status={t.status} />
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
