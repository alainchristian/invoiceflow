import { useState } from "react";
import { Link } from "react-router-dom";
import { Plus, Search, FileText, MoreHorizontal, Copy, Send, CheckCircle2, Download, Ban } from "lucide-react";
import {
  useInvoices,
  useDuplicateInvoice,
  useSendInvoice,
  useUpdateInvoiceStatus,
  downloadInvoicePdf,
  downloadInvoicesCsv,
} from "@/hooks/useInvoices";
import { PageHeader } from "@/components/layout/Topbar";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card, CardContent } from "@/components/ui/Card";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/Table";
import { StatusBadge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/DropdownMenu";
import { useToast } from "@/components/ui/Toast";
import { formatCurrency, formatDate } from "@/lib/utils";

const STATUS_TABS = ["ALL", "DRAFT", "SENT", "VIEWED", "PAID", "OVERDUE", "CANCELLED"];

export default function Invoices() {
  const [status, setStatus] = useState("ALL");
  const [search, setSearch] = useState("");
  const { data, isLoading } = useInvoices({ status: status === "ALL" ? undefined : status, search: search || undefined });
  const duplicate = useDuplicateInvoice();
  const send = useSendInvoice();
  const updateStatus = useUpdateInvoiceStatus();
  const toast = useToast();

  return (
    <div>
      <PageHeader
        title="Invoices"
        subtitle="Create, send, and track every invoice in one place."
        actions={
          <Button asChild>
            <Link to="/app/invoices/new">
              <Plus className="h-4 w-4" /> Create Invoice
            </Link>
          </Button>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1 overflow-x-auto rounded-lg border border-border bg-surface p-1">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setStatus(tab)}
              className={`whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                status === tab ? "bg-brand-600 text-white" : "text-fg-secondary hover:text-fg"
              }`}
            >
              {tab === "ALL" ? "All" : tab.charAt(0) + tab.slice(1).toLowerCase()}
            </button>
          ))}
        </div>
        <div className="relative ml-auto w-64">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-muted" />
          <Input placeholder="Search invoices..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => downloadInvoicesCsv({ status: status === "ALL" ? undefined : status, search: search || undefined })}
        >
          <Download className="h-4 w-4" /> Export CSV
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-3 p-5">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-10" />
              ))}
            </div>
          ) : !data || data.invoices.length === 0 ? (
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
                  <TH>Date</TH>
                  <TH>Due Date</TH>
                  <TH>Amount</TH>
                  <TH>Status</TH>
                  <TH></TH>
                </TR>
              </THead>
              <TBody>
                {data.invoices.map((invoice) => (
                  <TR key={invoice.id}>
                    <TD>
                      <Link to={`/app/invoices/${invoice.id}`} className="font-medium text-brand-600 hover:underline">
                        {invoice.number}
                      </Link>
                    </TD>
                    <TD>{invoice.customer.name}</TD>
                    <TD>{formatDate(invoice.issueDate)}</TD>
                    <TD>{formatDate(invoice.dueDate)}</TD>
                    <TD>{formatCurrency(invoice.total, invoice.currency)}</TD>
                    <TD>
                      <StatusBadge status={invoice.status} />
                    </TD>
                    <TD>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className="rounded-md p-1.5 text-fg-muted hover:bg-surface-hover hover:text-fg">
                            <MoreHorizontal className="h-4 w-4" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent>
                          <DropdownMenuItem onClick={() => downloadInvoicePdf(invoice.id, invoice.number)}>
                            <Download className="mr-2 h-4 w-4" /> Download PDF
                          </DropdownMenuItem>
                          {invoice.status === "DRAFT" && (
                            <DropdownMenuItem
                              onClick={async () => {
                                await send.mutateAsync(invoice.id);
                                toast.success("Invoice sent");
                              }}
                            >
                              <Send className="mr-2 h-4 w-4" /> Send
                            </DropdownMenuItem>
                          )}
                          {invoice.status !== "PAID" && invoice.status !== "CANCELLED" && (
                            <DropdownMenuItem
                              onClick={async () => {
                                await updateStatus.mutateAsync({ id: invoice.id, status: "PAID" });
                                toast.success("Invoice marked as paid");
                              }}
                            >
                              <CheckCircle2 className="mr-2 h-4 w-4" /> Mark as Paid
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem
                            onClick={async () => {
                              await duplicate.mutateAsync(invoice.id);
                              toast.success("Invoice duplicated");
                            }}
                          >
                            <Copy className="mr-2 h-4 w-4" /> Duplicate
                          </DropdownMenuItem>
                          {invoice.status !== "CANCELLED" && invoice.status !== "PAID" && (
                            <DropdownMenuItem
                              onClick={async () => {
                                await updateStatus.mutateAsync({ id: invoice.id, status: "CANCELLED" });
                                toast.success("Invoice cancelled");
                              }}
                            >
                              <Ban className="mr-2 h-4 w-4" /> Cancel
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
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
