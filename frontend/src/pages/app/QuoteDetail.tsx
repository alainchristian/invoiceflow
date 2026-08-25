import { useNavigate, useParams, Link } from "react-router-dom";
import { Download, Send, ArrowRightLeft, Copy, Pencil, XCircle, Link2, Trash2 } from "lucide-react";
import {
  useQuote,
  useSendQuote,
  useDuplicateQuote,
  useUpdateQuoteStatus,
  useDeleteQuote,
  useConvertQuote,
  downloadQuotePdf,
} from "@/hooks/useQuotes";
import { PageHeader } from "@/components/layout/Topbar";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { StatusBadge } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import { InvoicePreview } from "@/components/invoices/InvoicePreview";
import { useToast } from "@/components/ui/Toast";
import { formatCurrency, formatDate } from "@/lib/utils";

export default function QuoteDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { data: quote, isLoading } = useQuote(id);
  const send = useSendQuote();
  const duplicate = useDuplicateQuote();
  const updateStatus = useUpdateQuoteStatus();
  const deleteQuote = useDeleteQuote();
  const convert = useConvertQuote();

  if (isLoading || !quote) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  const publicUrl = `${window.location.origin}/q/${quote.publicToken}`;
  const canEdit = ["DRAFT", "SENT", "VIEWED", "EXPIRED"].includes(quote.status);
  const canSend = quote.status === "DRAFT" || quote.status === "EXPIRED";
  const canConvert = quote.status !== "CONVERTED";
  const canMarkRejected = ["SENT", "VIEWED", "EXPIRED"].includes(quote.status);
  const canDelete = quote.status === "DRAFT";

  return (
    <div>
      <PageHeader
        title={`Quote ${quote.number}`}
        subtitle={`Created ${formatDate(quote.createdAt)}`}
        actions={
          <>
            <Button variant="secondary" size="sm" onClick={() => downloadQuotePdf(quote.id, quote.number)}>
              <Download className="h-4 w-4" /> PDF
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                navigator.clipboard.writeText(publicUrl);
                toast.success("Client link copied to clipboard");
              }}
            >
              <Link2 className="h-4 w-4" /> Copy link
            </Button>
            {canEdit && (
              <Button variant="secondary" size="sm" asChild>
                <Link to={`/app/quotes/${quote.id}/edit`}>
                  <Pencil className="h-4 w-4" /> Edit
                </Link>
              </Button>
            )}
            {canSend && (
              <Button
                size="sm"
                onClick={async () => {
                  await send.mutateAsync(quote.id);
                  toast.success("Quote sent");
                }}
              >
                <Send className="h-4 w-4" /> Send
              </Button>
            )}
          </>
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <InvoicePreview
            customer={quote.customer}
            issueDate={quote.issueDate}
            dueDate={quote.expiryDate ?? undefined}
            currency={quote.currency}
            items={quote.items}
            notes={quote.notes ?? undefined}
            terms={quote.terms ?? undefined}
            invoiceNumber={quote.number}
            kind="QUOTE"
            dateLabel="VALID UNTIL"
          />
        </div>

        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Status</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <StatusBadge status={quote.status} />
              <div className="text-sm">
                <div className="flex justify-between text-fg-secondary">
                  <span>Total</span>
                  <span className="font-medium text-fg">{formatCurrency(quote.total, quote.currency)}</span>
                </div>
              </div>

              {quote.status === "CONVERTED" && quote.convertedInvoiceId ? (
                <Button size="sm" asChild>
                  <Link to={`/app/invoices/${quote.convertedInvoiceId}`}>View Invoice</Link>
                </Button>
              ) : (
                canConvert && (
                  <Button
                    size="sm"
                    onClick={async () => {
                      const result = await convert.mutateAsync(quote.id);
                      toast.success("Quote converted to invoice");
                      navigate(`/app/invoices/${result.invoice.id}`);
                    }}
                  >
                    <ArrowRightLeft className="h-4 w-4" /> Convert to Invoice
                  </Button>
                )
              )}
              <Button
                size="sm"
                variant="secondary"
                onClick={async () => {
                  const dup = await duplicate.mutateAsync(quote.id);
                  toast.success("Quote duplicated");
                  navigate(`/app/quotes/${dup.id}`);
                }}
              >
                <Copy className="h-4 w-4" /> Duplicate
              </Button>
              {canDelete && (
                <Button
                  size="sm"
                  variant="danger"
                  onClick={async () => {
                    await deleteQuote.mutateAsync(quote.id);
                    toast.success("Quote deleted");
                    navigate("/app/quotes");
                  }}
                >
                  <Trash2 className="h-4 w-4" /> Delete draft
                </Button>
              )}
              {canMarkRejected && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={async () => {
                    await updateStatus.mutateAsync({ id: quote.id, status: "REJECTED" });
                    toast.success("Quote marked as rejected");
                  }}
                >
                  <XCircle className="h-4 w-4" /> Mark as rejected
                </Button>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
