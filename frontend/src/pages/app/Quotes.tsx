import { useState } from "react";
import { Link } from "react-router-dom";
import { Plus, Search, FileSignature, MoreHorizontal, Copy, Send, ArrowRightLeft, Download, XCircle } from "lucide-react";
import { useQuotes, useDuplicateQuote, useSendQuote, useUpdateQuoteStatus, useConvertQuote, downloadQuotePdf } from "@/hooks/useQuotes";
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

const STATUS_TABS = ["ALL", "DRAFT", "SENT", "VIEWED", "ACCEPTED", "REJECTED", "EXPIRED", "CONVERTED"];

export default function Quotes() {
  const [status, setStatus] = useState("ALL");
  const [search, setSearch] = useState("");
  const { data, isLoading } = useQuotes({ status: status === "ALL" ? undefined : status, search: search || undefined });
  const duplicate = useDuplicateQuote();
  const send = useSendQuote();
  const updateStatus = useUpdateQuoteStatus();
  const convert = useConvertQuote();
  const toast = useToast();

  return (
    <div>
      <PageHeader
        title="Quotes"
        subtitle="Send estimates and convert accepted quotes into invoices."
        actions={
          <Button asChild>
            <Link to="/app/quotes/new">
              <Plus className="h-4 w-4" /> Create Quote
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
          <Input placeholder="Search quotes..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-3 p-5">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-10" />
              ))}
            </div>
          ) : !data || data.quotes.length === 0 ? (
            <EmptyState
              icon={FileSignature}
              title="No quotes yet"
              description="Create an estimate for a customer and send it for approval."
              action={
                <Button asChild size="sm">
                  <Link to="/app/quotes/new">Create Quote</Link>
                </Button>
              }
            />
          ) : (
            <Table>
              <THead>
                <TR>
                  <TH>Quote #</TH>
                  <TH>Customer</TH>
                  <TH>Date</TH>
                  <TH>Expiry Date</TH>
                  <TH>Amount</TH>
                  <TH>Status</TH>
                  <TH></TH>
                </TR>
              </THead>
              <TBody>
                {data.quotes.map((quote) => (
                  <TR key={quote.id}>
                    <TD>
                      <Link to={`/app/quotes/${quote.id}`} className="font-medium text-brand-600 hover:underline">
                        {quote.number}
                      </Link>
                    </TD>
                    <TD>{quote.customer.name}</TD>
                    <TD>{formatDate(quote.issueDate)}</TD>
                    <TD>{quote.expiryDate ? formatDate(quote.expiryDate) : "-"}</TD>
                    <TD>{formatCurrency(quote.total, quote.currency)}</TD>
                    <TD>
                      <StatusBadge status={quote.status} />
                    </TD>
                    <TD>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className="rounded-md p-1.5 text-fg-muted hover:bg-surface-hover hover:text-fg">
                            <MoreHorizontal className="h-4 w-4" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent>
                          <DropdownMenuItem onClick={() => downloadQuotePdf(quote.id, quote.number)}>
                            <Download className="mr-2 h-4 w-4" /> Download PDF
                          </DropdownMenuItem>
                          {(quote.status === "DRAFT" || quote.status === "EXPIRED") && (
                            <DropdownMenuItem
                              onClick={async () => {
                                await send.mutateAsync(quote.id);
                                toast.success("Quote sent");
                              }}
                            >
                              <Send className="mr-2 h-4 w-4" /> Send
                            </DropdownMenuItem>
                          )}
                          {quote.status !== "CONVERTED" && (
                            <DropdownMenuItem
                              onClick={async () => {
                                await convert.mutateAsync(quote.id);
                                toast.success("Quote converted to invoice");
                              }}
                            >
                              <ArrowRightLeft className="mr-2 h-4 w-4" /> Convert to Invoice
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem
                            onClick={async () => {
                              await duplicate.mutateAsync(quote.id);
                              toast.success("Quote duplicated");
                            }}
                          >
                            <Copy className="mr-2 h-4 w-4" /> Duplicate
                          </DropdownMenuItem>
                          {["SENT", "VIEWED", "EXPIRED"].includes(quote.status) && (
                            <DropdownMenuItem
                              onClick={async () => {
                                await updateStatus.mutateAsync({ id: quote.id, status: "REJECTED" });
                                toast.success("Quote marked as rejected");
                              }}
                            >
                              <XCircle className="mr-2 h-4 w-4" /> Mark as Rejected
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
