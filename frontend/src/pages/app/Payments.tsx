import { Link } from "react-router-dom";
import { Wallet } from "lucide-react";
import { usePayments } from "@/hooks/usePayments";
import { PageHeader } from "@/components/layout/Topbar";
import { Card, CardContent } from "@/components/ui/Card";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/Table";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { Badge } from "@/components/ui/Badge";
import { formatCurrency, formatDate } from "@/lib/utils";

const METHOD_LABEL: Record<string, string> = {
  BANK_TRANSFER: "Bank transfer",
  CASH: "Cash",
  CARD: "Card",
  MOBILE_MONEY: "Mobile money",
  OTHER: "Other",
};

export default function Payments() {
  const { data: payments = [], isLoading } = usePayments();

  return (
    <div>
      <PageHeader title="Payments" subtitle="Every payment recorded against an invoice." />

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-3 p-5">
              {[...Array(4)].map((_, i) => (
                <Skeleton key={i} className="h-10" />
              ))}
            </div>
          ) : payments.length === 0 ? (
            <EmptyState
              icon={Wallet}
              title="No payments recorded yet"
              description="Payments you record against invoices will show up here."
            />
          ) : (
            <Table>
              <THead>
                <TR>
                  <TH>Date</TH>
                  <TH>Invoice</TH>
                  <TH>Customer</TH>
                  <TH>Method</TH>
                  <TH>Amount</TH>
                </TR>
              </THead>
              <TBody>
                {payments.map((p) => (
                  <TR key={p.id}>
                    <TD>{formatDate(p.paidAt)}</TD>
                    <TD>
                      <Link to={`/app/invoices/${p.invoice.id}`} className="font-medium text-brand-600 hover:underline">
                        {p.invoice.number}
                      </Link>
                    </TD>
                    <TD>{p.invoice.customer.name}</TD>
                    <TD>
                      <Badge variant="neutral">{METHOD_LABEL[p.method]}</Badge>
                    </TD>
                    <TD>{formatCurrency(p.amount, p.invoice.currency)}</TD>
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
