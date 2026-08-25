import { Check } from "lucide-react";
import { useAdminPlans } from "@/hooks/useAdmin";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { formatCurrency } from "@/lib/utils";

export default function Plans() {
  const { data: plans, isLoading } = useAdminPlans();

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-fg">Plans</h1>
        <p className="mt-1 text-sm text-fg-secondary">
          The subscription plans available on InvoiceFlow. Pricing and limits are configured in code and deployed, not editable here.
        </p>
      </div>

      {isLoading || !plans ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-72" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {plans.map((plan) => (
            <Card key={plan.id}>
              <CardHeader>
                <CardTitle className="text-base font-semibold text-fg">{plan.name}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold text-fg">
                  {plan.priceMonthly === 0 ? "Free" : formatCurrency(plan.priceMonthly)}
                  {plan.priceMonthly > 0 && <span className="text-sm font-normal text-fg-muted"> / month</span>}
                </p>
                <p className="mt-1 text-sm text-fg-secondary">{plan.description}</p>
                <ul className="mt-4 space-y-2 text-sm">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-fg-secondary">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" /> {f}
                    </li>
                  ))}
                </ul>
                <div className="mt-4 space-y-1 border-t border-border pt-4 text-xs text-fg-muted">
                  <p>Invoice cap: {plan.invoiceCapPerMonth ?? "Unlimited"} / month</p>
                  <p>Seat cap: {plan.seatCap ?? "Unlimited"}</p>
                  <p>Recurring invoices: {plan.recurringInvoicesAllowed ? "Included" : "Not included"}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
