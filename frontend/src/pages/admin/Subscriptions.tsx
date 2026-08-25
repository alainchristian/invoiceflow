import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Receipt, ChevronLeft, ChevronRight } from "lucide-react";
import { useAdminSubscriptions } from "@/hooks/useAdmin";
import { Card, CardContent } from "@/components/ui/Card";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/Table";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { TenantStatusBadge } from "@/components/admin/TenantStatusBadge";
import { formatCurrency, formatDate } from "@/lib/utils";

const STATUS_OPTIONS = [
  { value: "ALL", label: "All statuses" },
  { value: "ACTIVE", label: "Active" },
  { value: "TRIAL", label: "Trial" },
  { value: "PAST_DUE", label: "Past due" },
  { value: "CANCELLED", label: "Cancelled" },
];

const PLAN_OPTIONS = [
  { value: "ALL", label: "All plans" },
  { value: "STARTER", label: "Starter" },
  { value: "PROFESSIONAL", label: "Professional" },
  { value: "BUSINESS", label: "Business" },
];

export default function Subscriptions() {
  const [params, setParams] = useSearchParams();
  const [page, setPage] = useState(1);
  const status = params.get("status") ?? "ALL";
  const plan = params.get("plan") ?? "ALL";

  const { data, isLoading } = useAdminSubscriptions({
    status: status === "ALL" ? undefined : status,
    plan: plan === "ALL" ? undefined : plan,
    page,
    pageSize: 20,
  });

  function updateParam(key: string, value: string) {
    const next = new URLSearchParams(params);
    if (value !== "ALL") next.set(key, value);
    else next.delete(key);
    setParams(next);
    setPage(1);
  }

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-fg">Subscriptions</h1>
        <p className="mt-1 text-sm text-fg-secondary">Every tenant's subscription to InvoiceFlow.</p>
      </div>

      <div className="mb-4 flex flex-wrap gap-3">
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
          ) : !data || data.subscriptions.length === 0 ? (
            <EmptyState icon={Receipt} title="No subscriptions found" description="Try adjusting your filters." />
          ) : (
            <Table>
              <THead>
                <TR>
                  <TH>Tenant</TH>
                  <TH>Plan</TH>
                  <TH>Status</TH>
                  <TH>Billing interval</TH>
                  <TH>Amount</TH>
                  <TH>Renewal date</TH>
                </TR>
              </THead>
              <TBody>
                {data.subscriptions.map((sub) => (
                  <TR key={sub.id}>
                    <TD>
                      <Link to={`/admin/tenants/${sub.id}`} className="font-medium text-brand-600 hover:underline">
                        {sub.name}
                      </Link>
                    </TD>
                    <TD className="capitalize">{sub.plan.toLowerCase()}</TD>
                    <TD>
                      <TenantStatusBadge status={sub.status} />
                    </TD>
                    <TD>{sub.billingInterval}</TD>
                    <TD>{formatCurrency(sub.amount)}</TD>
                    <TD>{sub.currentPeriodEnd ? formatDate(sub.currentPeriodEnd) : "-"}</TD>
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
