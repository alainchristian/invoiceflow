import { useState } from "react";
import { Link } from "react-router-dom";
import { Plus, Receipt, MoreHorizontal, Download, Send, Ban, Trash2 } from "lucide-react";
import {
  useCreditNotes,
  useIssueCreditNote,
  useVoidCreditNote,
  useDeleteCreditNote,
  downloadCreditNotePdf,
} from "@/hooks/useCreditNotes";
import { PageHeader } from "@/components/layout/Topbar";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/Table";
import { StatusBadge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/DropdownMenu";
import { useToast } from "@/components/ui/Toast";
import { formatCurrency, formatDate } from "@/lib/utils";

const STATUS_TABS = ["ALL", "DRAFT", "ISSUED", "VOID"];

export default function CreditNotes() {
  const [status, setStatus] = useState("ALL");
  const { data, isLoading } = useCreditNotes({ status: status === "ALL" ? undefined : status });
  const issue = useIssueCreditNote();
  const voidNote = useVoidCreditNote();
  const deleteNote = useDeleteCreditNote();
  const toast = useToast();

  return (
    <div>
      <PageHeader
        title="Credit Notes"
        subtitle="Issue credits against invoices and keep a record for your books."
        actions={
          <Button asChild>
            <Link to="/app/credit-notes/new">
              <Plus className="h-4 w-4" /> New Credit Note
            </Link>
          </Button>
        }
      />

      <div className="mb-4 flex items-center gap-1 overflow-x-auto rounded-lg border border-border bg-surface p-1">
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

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-3 p-5">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-10" />
              ))}
            </div>
          ) : !data || data.creditNotes.length === 0 ? (
            <EmptyState
              icon={Receipt}
              title="No credit notes yet"
              description="Issue a credit note against an invoice to record a refund or adjustment."
              action={
                <Button asChild size="sm">
                  <Link to="/app/credit-notes/new">New Credit Note</Link>
                </Button>
              }
            />
          ) : (
            <Table>
              <THead>
                <TR>
                  <TH>Credit Note #</TH>
                  <TH>Customer</TH>
                  <TH>Invoice</TH>
                  <TH>Date</TH>
                  <TH>Amount</TH>
                  <TH>Status</TH>
                  <TH></TH>
                </TR>
              </THead>
              <TBody>
                {data.creditNotes.map((cn) => (
                  <TR key={cn.id}>
                    <TD>
                      <Link to={`/app/credit-notes/${cn.id}`} className="font-medium text-brand-600 hover:underline">
                        {cn.number}
                      </Link>
                    </TD>
                    <TD>{cn.customer.name}</TD>
                    <TD>
                      {cn.invoice ? (
                        <Link to={`/app/invoices/${cn.invoice.id}`} className="text-brand-600 hover:underline">
                          {cn.invoice.number}
                        </Link>
                      ) : (
                        "—"
                      )}
                    </TD>
                    <TD>{formatDate(cn.issueDate)}</TD>
                    <TD>{formatCurrency(cn.total, cn.currency)}</TD>
                    <TD>
                      <StatusBadge status={cn.status} />
                    </TD>
                    <TD>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className="rounded-md p-1.5 text-fg-muted hover:bg-surface-hover hover:text-fg">
                            <MoreHorizontal className="h-4 w-4" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent>
                          <DropdownMenuItem onClick={() => downloadCreditNotePdf(cn.id, cn.number)}>
                            <Download className="mr-2 h-4 w-4" /> Download PDF
                          </DropdownMenuItem>
                          {cn.status === "DRAFT" && (
                            <DropdownMenuItem
                              onClick={async () => {
                                try {
                                  await issue.mutateAsync(cn.id);
                                  toast.success("Credit note issued");
                                } catch (err: any) {
                                  toast.error(err.response?.data?.error || "Could not issue credit note");
                                }
                              }}
                            >
                              <Send className="mr-2 h-4 w-4" /> Issue
                            </DropdownMenuItem>
                          )}
                          {cn.status === "ISSUED" && (
                            <DropdownMenuItem
                              onClick={async () => {
                                await voidNote.mutateAsync(cn.id);
                                toast.success("Credit note voided");
                              }}
                            >
                              <Ban className="mr-2 h-4 w-4" /> Void
                            </DropdownMenuItem>
                          )}
                          {cn.status === "DRAFT" && (
                            <DropdownMenuItem
                              onClick={async () => {
                                await deleteNote.mutateAsync(cn.id);
                                toast.success("Credit note deleted");
                              }}
                            >
                              <Trash2 className="mr-2 h-4 w-4" /> Delete
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
