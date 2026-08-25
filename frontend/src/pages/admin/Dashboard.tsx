import { useState } from "react";
import { Link } from "react-router-dom";
import { Building2, CheckCircle2, Clock, Ban, DollarSign, UsersRound, ArrowRight, AlertTriangle } from "lucide-react";
import { useAdminDashboard } from "@/hooks/useAdmin";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { TenantGrowthChart } from "@/components/admin/TenantGrowthChart";
import { PlanDistributionChart } from "@/components/admin/PlanDistributionChart";
import { TenantStatusBadge } from "@/components/admin/TenantStatusBadge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/Table";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { formatCurrency, formatDate } from "@/lib/utils";

export default function Dashboard() {
  const [period, setPeriod] = useState<"7d" | "30d" | "3m" | "12m">("30d");
  const { data, isLoading } = useAdminDashboard(period);

  if (isLoading || !data) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-72" />
      </div>
    );
  }

  const { kpis, tenantGrowth, planDistribution, recentTenants, attentionRequired } = data;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-fg">Platform Dashboard</h1>
        <p className="mt-1 text-sm text-fg-secondary">How InvoiceFlow is doing, at a glance.</p>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <KpiCard label="Total Tenants" value={String(kpis.totalTenants)} icon={Building2} />
        <KpiCard label="Active Tenants" value={String(kpis.activeTenants)} icon={CheckCircle2} />
        <KpiCard label="Trial Tenants" value={String(kpis.trialTenants)} icon={Clock} />
        <KpiCard label="Suspended Tenants" value={String(kpis.suspendedTenants)} icon={Ban} tone={kpis.suspendedTenants > 0 ? "danger" : "neutral"} />
        <KpiCard label="Monthly Recurring Revenue" value={formatCurrency(kpis.mrr)} icon={DollarSign} />
        <KpiCard label="Total Platform Users" value={String(kpis.totalPlatformUsers)} icon={UsersRound} />
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <TenantGrowthChart data={tenantGrowth} period={period} onPeriodChange={setPeriod} />
        </div>
        <PlanDistributionChart data={planDistribution} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Recent tenants</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {recentTenants.length === 0 ? (
              <EmptyState icon={Building2} title="No tenants yet" description="New tenants will show up here." className="py-10" />
            ) : (
              <Table>
                <THead>
                  <TR>
                    <TH>Tenant</TH>
                    <TH>Plan</TH>
                    <TH>Status</TH>
                    <TH>Joined</TH>
                  </TR>
                </THead>
                <TBody>
                  {recentTenants.map((t) => (
                    <TR key={t.id}>
                      <TD>
                        <Link to={`/admin/tenants/${t.id}`} className="font-medium text-brand-600 hover:underline">
                          {t.name}
                        </Link>
                      </TD>
                      <TD className="capitalize">{t.plan.toLowerCase()}</TD>
                      <TD>
                        <TenantStatusBadge status={t.status} />
                      </TD>
                      <TD>{formatDate(t.createdAt)}</TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            )}
            <div className="border-t border-border p-3 text-center">
              <Link to="/admin/tenants" className="inline-flex items-center gap-1 text-sm font-medium text-brand-600 hover:underline">
                View all tenants <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Attention required</CardTitle>
          </CardHeader>
          <CardContent>
            {attentionRequired.length === 0 ? (
              <EmptyState icon={CheckCircle2} title="All clear" description="No tenants currently need attention." className="py-10" />
            ) : (
              <div className="divide-y divide-border">
                {attentionRequired.map((t) => (
                  <Link
                    key={t.id}
                    to={`/admin/tenants/${t.id}`}
                    className="flex items-center justify-between py-3 first:pt-0 last:pb-0 hover:opacity-80"
                  >
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
    </div>
  );
}
