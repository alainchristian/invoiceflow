import { Link } from "react-router-dom";
import { DollarSign, Clock, AlertTriangle, CheckCircle2, Plus, FileText } from "lucide-react";
import { useDashboardSummary } from "@/hooks/useDashboard";
import { useAuth } from "@/context/AuthContext";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { RevenueChart } from "@/components/dashboard/RevenueChart";
import { StatusDonut } from "@/components/dashboard/StatusDonut";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/Table";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatCurrency, formatDate } from "@/lib/utils";

export default function Dashboard() {
  const { user } = useAuth();
  const { data, isLoading } = useDashboardSummary();

  const greeting = new Date().getHours() < 12 ? "Good morning" : new Date().getHours() < 18 ? "Good afternoon" : "Good evening";

  if (isLoading || !data) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
        <Skeleton className="h-72" />
      </div>
    );
  }

  const pctChange =
    data.paidLastMonth > 0 ? ((data.paidThisMonth - data.paidLastMonth) / data.paidLastMonth) * 100 : 0;

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-fg">
            {greeting}, {user?.name.split(" ")[0]} 👋
          </h1>
          <p className="mt-1 text-sm text-fg-secondary">Here's what's happening with your business today.</p>
        </div>
        <Button asChild>
          <Link to="/app/invoices/new">
            <Plus className="h-4 w-4" /> Create Invoice
          </Link>
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Total Revenue" value={formatCurrency(data.totalRevenue)} icon={DollarSign} />
        <KpiCard
          label="Outstanding"
          value={formatCurrency(data.outstanding)}
          change={{ value: `${data.unpaidCount} unpaid invoices`, positive: true }}
          icon={Clock}
        />
        <KpiCard label="Overdue" value={formatCurrency(data.overdue)} icon={AlertTriangle} tone="danger" />
        <KpiCard
          label="Paid This Month"
          value={formatCurrency(data.paidThisMonth)}
          change={pctChange !== 0 ? { value: `${Math.abs(pctChange).toFixed(1)}%`, positive: pctChange >= 0 } : undefined}
          icon={CheckCircle2}
        />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <RevenueChart data={data.revenueByMonth} />
        </div>
        <StatusDonut statusCounts={data.statusCounts} />
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Recent invoices</CardTitle>
          <Button asChild variant="ghost" size="sm">
            <Link to="/app/invoices">View all</Link>
          </Button>
        </CardHeader>
        <CardContent className="p-0 pt-4">
          {data.recentInvoices.length === 0 ? (
            <EmptyState
              icon={FileText}
              title="No invoices yet"
              description="Create your first professional invoice and start getting paid."
              action={
                <Button asChild size="sm">
                  <Link to="/app/invoices/new">Create Invoice</Link>
                </Button>
              }
            />
          ) : (
            <Table>
              <THead>
                <TR>
                  <TH>Invoice #</TH>
                  <TH>Customer</TH>
                  <TH>Due Date</TH>
                  <TH>Amount</TH>
                  <TH>Status</TH>
                </TR>
              </THead>
              <TBody>
                {data.recentInvoices.map((invoice) => (
                  <TR key={invoice.id} className="cursor-pointer">
                    <TD>
                      <Link to={`/app/invoices/${invoice.id}`} className="font-medium text-brand-600 hover:underline">
                        {invoice.number}
                      </Link>
                    </TD>
                    <TD>{invoice.customer.name}</TD>
                    <TD>{formatDate(invoice.dueDate)}</TD>
                    <TD>{formatCurrency(invoice.total, invoice.currency)}</TD>
                    <TD>
                      <StatusBadge status={invoice.status} />
                    </TD>
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
