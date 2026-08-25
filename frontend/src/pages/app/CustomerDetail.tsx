import { useParams, Link } from "react-router-dom";
import { useCustomer } from "@/hooks/useCustomers";
import { PageHeader } from "@/components/layout/Topbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { StatusBadge } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/Table";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { Invoice } from "@/types";

export default function CustomerDetail() {
  const { id } = useParams();
  const { data: customer, isLoading } = useCustomer(id);

  if (isLoading || !customer) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  const invoices: Invoice[] = customer.invoices ?? [];
  const totalInvoiced = invoices.reduce((sum, inv) => sum + inv.total, 0);
  const outstanding = invoices
    .filter((inv) => inv.status !== "PAID" && inv.status !== "CANCELLED")
    .reduce((sum, inv) => sum + (inv.total - inv.amountPaid), 0);

  return (
    <div>
      <PageHeader title={customer.name} subtitle={customer.company || customer.email} />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardContent>
            <p className="text-sm text-fg-secondary">Total invoiced</p>
            <p className="mt-1 text-xl font-semibold text-fg">{formatCurrency(totalInvoiced)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <p className="text-sm text-fg-secondary">Outstanding</p>
            <p className="mt-1 text-xl font-semibold text-fg">{formatCurrency(outstanding)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <p className="text-sm text-fg-secondary">Contact</p>
            <p className="mt-1 text-sm text-fg">{customer.email || "-"}</p>
            <p className="text-sm text-fg-secondary">{customer.phone || ""}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Invoice history</CardTitle>
        </CardHeader>
        <CardContent className="p-0 pt-4">
          {invoices.length === 0 ? (
            <p className="px-5 pb-5 text-sm text-fg-secondary">No invoices for this customer yet.</p>
          ) : (
            <Table>
              <THead>
                <TR>
                  <TH>Invoice #</TH>
                  <TH>Date</TH>
                  <TH>Amount</TH>
                  <TH>Status</TH>
                </TR>
              </THead>
              <TBody>
                {invoices.map((inv) => (
                  <TR key={inv.id}>
                    <TD>
                      <Link to={`/app/invoices/${inv.id}`} className="font-medium text-brand-600 hover:underline">
                        {inv.number}
                      </Link>
                    </TD>
                    <TD>{formatDate(inv.issueDate)}</TD>
                    <TD>{formatCurrency(inv.total, inv.currency)}</TD>
                    <TD>
                      <StatusBadge status={inv.status} />
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
