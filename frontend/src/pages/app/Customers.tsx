import { useState } from "react";
import { Link } from "react-router-dom";
import { Users, UserPlus, Download } from "lucide-react";
import { useCustomers, downloadCustomersCsv } from "@/hooks/useCustomers";
import { PageHeader } from "@/components/layout/Topbar";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/Table";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { NewCustomerDialog } from "@/components/customers/NewCustomerDialog";
import { formatCurrency } from "@/lib/utils";

export default function Customers() {
  const { data: customers = [], isLoading } = useCustomers();
  const [showNew, setShowNew] = useState(false);

  return (
    <div>
      <PageHeader
        title="Customers"
        subtitle="Everyone you've ever invoiced, in one place."
        actions={
          <>
            <Button variant="secondary" onClick={() => downloadCustomersCsv()}>
              <Download className="h-4 w-4" /> Export CSV
            </Button>
            <Button onClick={() => setShowNew(true)}>
              <UserPlus className="h-4 w-4" /> Add Customer
            </Button>
          </>
        }
      />

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-3 p-5">
              {[...Array(4)].map((_, i) => (
                <Skeleton key={i} className="h-10" />
              ))}
            </div>
          ) : customers.length === 0 ? (
            <EmptyState
              icon={Users}
              title="No customers yet"
              description="Add your first customer to start creating invoices for them."
              action={<Button onClick={() => setShowNew(true)}>Add Customer</Button>}
            />
          ) : (
            <Table>
              <THead>
                <TR>
                  <TH>Name</TH>
                  <TH>Email</TH>
                  <TH>Total invoiced</TH>
                  <TH>Outstanding</TH>
                </TR>
              </THead>
              <TBody>
                {customers.map((c) => (
                  <TR key={c.id}>
                    <TD>
                      <Link to={`/app/customers/${c.id}`} className="font-medium text-brand-600 hover:underline">
                        {c.name}
                      </Link>
                      {c.company && <p className="text-xs text-fg-muted">{c.company}</p>}
                    </TD>
                    <TD>{c.email || "-"}</TD>
                    <TD>{formatCurrency(c.totalInvoiced ?? 0)}</TD>
                    <TD>{formatCurrency(c.outstanding ?? 0)}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <NewCustomerDialog open={showNew} onOpenChange={setShowNew} onCreated={() => {}} />
    </div>
  );
}
