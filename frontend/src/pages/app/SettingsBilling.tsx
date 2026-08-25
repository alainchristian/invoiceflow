import { CreditCard, Check } from "lucide-react";
import { PageHeader } from "@/components/layout/Topbar";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { useBillingSummary, useStartCheckout, useOpenBillingPortal } from "@/hooks/useBilling";
import { PLANS, PLAN_ORDER, planRank, type PlanId } from "@/lib/plans";
import { formatDate } from "@/lib/utils";

function UsageBar({ label, used, cap }: { label: string; used: number; cap: number }) {
  const pct = Math.min(100, Math.round((used / cap) * 100));
  const atLimit = used >= cap;
  return (
    <div>
      <div className="mb-1 flex justify-between text-sm">
        <span className="text-fg-secondary">{label}</span>
        <span className={atLimit ? "font-medium text-danger" : "text-fg"}>
          {used} of {cap}
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-surface-hover">
        <div
          className={`h-full rounded-full ${atLimit ? "bg-danger" : "bg-brand-600"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export default function SettingsBilling() {
  const toast = useToast();
  const { data: billing, isLoading } = useBillingSummary();
  const startCheckout = useStartCheckout();
  const openPortal = useOpenBillingPortal();

  async function handleUpgrade(plan: "PROFESSIONAL" | "BUSINESS") {
    try {
      const { url } = await startCheckout.mutateAsync(plan);
      window.location.href = url;
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Could not start checkout. Please try again.");
    }
  }

  async function handleManageSubscription() {
    try {
      const { url } = await openPortal.mutateAsync();
      window.location.href = url;
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Could not open the billing portal. Please try again.");
    }
  }

  if (isLoading || !billing) {
    return (
      <div>
        <PageHeader title="Billing & Subscription" subtitle="Manage your InvoiceFlow plan." />
        <Skeleton className="h-40" />
      </div>
    );
  }

  const currentDef = PLANS[billing.plan];
  const hasSubscription = billing.hasActiveSubscription;

  return (
    <div>
      <PageHeader title="Billing & Subscription" subtitle="Manage your InvoiceFlow plan." />

      <div className="flex flex-col gap-6">
        <Card>
          <CardContent className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-50 text-brand-600 dark:bg-brand-900/40">
                <CreditCard className="h-5 w-5" />
              </div>
              <div>
                <p className="font-medium text-fg">
                  {currentDef.name} plan{" "}
                  <Badge
                    variant={
                      billing.subscriptionStatus === "past_due"
                        ? "warning"
                        : billing.plan === "STARTER"
                        ? "neutral"
                        : "brand"
                    }
                    className="ml-2"
                  >
                    {billing.subscriptionStatus === "past_due" ? "Past due" : "Active"}
                  </Badge>
                </p>
                {billing.currentPeriodEnd && hasSubscription && (
                  <p className="text-sm text-fg-secondary">Renews {formatDate(billing.currentPeriodEnd)}</p>
                )}
              </div>
            </div>
            {hasSubscription && (
              <Button variant="secondary" size="sm" onClick={handleManageSubscription} disabled={openPortal.isPending}>
                {openPortal.isPending ? "Loading..." : "Manage subscription"}
              </Button>
            )}
          </CardContent>
        </Card>

        {(billing.usage.invoiceCap !== null || billing.usage.seatCap !== null) && (
          <Card>
            <CardHeader>
              <CardTitle>Usage this month</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {billing.usage.invoiceCap !== null && (
                <UsageBar label="Invoices" used={billing.usage.invoicesThisMonth} cap={billing.usage.invoiceCap} />
              )}
              {billing.usage.seatCap !== null && (
                <UsageBar label="Team members" used={billing.usage.seatsUsed} cap={billing.usage.seatCap} />
              )}
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {PLAN_ORDER.map((id: PlanId) => {
            const def = PLANS[id];
            const isCurrent = id === billing.plan;
            const canUpgrade = !hasSubscription && planRank(id) > planRank(billing.plan) && id !== "STARTER";

            return (
              <Card key={id} className={isCurrent ? "border-brand-600" : undefined}>
                <CardContent className="flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <p className="font-medium text-fg">{def.name}</p>
                    {isCurrent && <Badge variant="brand">Current</Badge>}
                  </div>
                  <p className="text-2xl font-bold text-fg">
                    ${def.priceMonthly}
                    <span className="text-sm font-normal text-fg-muted">/mo</span>
                  </p>
                  <p className="text-sm text-fg-secondary">{def.description}</p>
                  <ul className="flex flex-col gap-1.5 text-sm text-fg-secondary">
                    {def.features.map((f) => (
                      <li key={f} className="flex items-center gap-2">
                        <Check className="h-3.5 w-3.5 shrink-0 text-brand-600" /> {f}
                      </li>
                    ))}
                  </ul>
                  {canUpgrade && (
                    <Button size="sm" onClick={() => handleUpgrade(id as "PROFESSIONAL" | "BUSINESS")} disabled={startCheckout.isPending}>
                      {startCheckout.isPending ? "Redirecting..." : `Upgrade to ${def.name}`}
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
