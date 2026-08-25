import { Link } from "react-router-dom";
import { Sparkles } from "lucide-react";
import { PageHeader } from "@/components/layout/Topbar";
import { useCurrentOrganization } from "@/hooks/useOrganization";
import { useAnalyticsSummary } from "@/hooks/useAnalytics";
import { TopCustomersChart } from "@/components/dashboard/TopCustomersChart";
import { RevenueByProductChart } from "@/components/dashboard/RevenueByProductChart";
import { QuoteConversionChart } from "@/components/dashboard/QuoteConversionChart";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";

export default function Analytics() {
  const { data: organization, isLoading: orgLoading } = useCurrentOrganization();
  const isStarter = organization?.plan === "STARTER";
  const { data, isLoading } = useAnalyticsSummary(!orgLoading && !isStarter);

  if (orgLoading || (!isStarter && isLoading)) {
    return (
      <div>
        <PageHeader title="Analytics" subtitle="Deeper insight into revenue and quotes." />
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Skeleton className="h-72" />
          <Skeleton className="h-72" />
        </div>
      </div>
    );
  }

  if (isStarter) {
    return (
      <div>
        <PageHeader title="Analytics" subtitle="Deeper insight into revenue and quotes." />
        <EmptyState
          icon={Sparkles}
          title="Analytics is a Professional feature"
          description="Upgrade to see revenue by customer, revenue by product, and quote conversion trends."
          action={
            <Button asChild size="sm">
              <Link to="/app/settings/billing">Upgrade plan</Link>
            </Button>
          }
        />
      </div>
    );
  }

  if (!data) return null;

  return (
    <div>
      <PageHeader title="Analytics" subtitle="Deeper insight into revenue and quotes." />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <TopCustomersChart data={data.topCustomers} />
        <RevenueByProductChart data={data.revenueByProduct} />
        <div className="lg:col-span-2">
          <QuoteConversionChart data={data.quoteConversionByMonth} />
        </div>
      </div>
    </div>
  );
}
