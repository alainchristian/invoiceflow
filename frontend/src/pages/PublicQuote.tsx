import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { CheckCircle2, Download, XCircle } from "lucide-react";
import api from "@/lib/api";
import { publicQuotePdfUrl } from "@/hooks/useQuotes";
import { useToast } from "@/components/ui/Toast";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/Badge";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { Quote, Organization } from "@/types";

type PublicQuote = Quote & { organization: Organization };

export default function PublicQuotePage() {
  const { token } = useParams();
  const toast = useToast();

  const [quote, setQuote] = useState<PublicQuote | null>(null);
  const [error, setError] = useState("");
  const [responding, setResponding] = useState(false);

  const fetchQuote = () =>
    api
      .get(`/public/quotes/${token}`)
      .then(({ data }) => setQuote(data))
      .catch(() => setError("This quote link is invalid or has expired."));

  useEffect(() => {
    fetchQuote();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function handleRespond(decision: "ACCEPT" | "REJECT") {
    setResponding(true);
    try {
      const { data } = await api.post(`/public/quotes/${token}/respond`, { decision });
      setQuote(data);
      toast.success(decision === "ACCEPT" ? "Quote accepted" : "Quote rejected");
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Could not submit your response. Please try again.");
    } finally {
      setResponding(false);
    }
  }

  if (error) {
    return <div className="flex min-h-screen items-center justify-center bg-background text-fg-secondary">{error}</div>;
  }
  if (!quote) {
    return <div className="flex min-h-screen items-center justify-center bg-background text-fg-secondary">Loading...</div>;
  }

  const brandColor = quote.organization.brandColor || "#4f46e5";
  const canRespond = quote.status === "SENT" || quote.status === "VIEWED";

  return (
    <div className="min-h-screen bg-background py-10">
      <div className="mx-auto max-w-2xl rounded-xl border border-border bg-surface p-8 shadow-sm">
        {quote.status === "ACCEPTED" && (
          <div className="mb-6 rounded-lg border border-success/20 bg-success-bg px-4 py-3 text-sm text-success">
            You accepted this quote.
          </div>
        )}
        {quote.status === "REJECTED" && (
          <div className="mb-6 rounded-lg border border-border bg-surface-hover px-4 py-3 text-sm text-fg-secondary">
            You rejected this quote.
          </div>
        )}
        <div className="mb-6 flex items-start justify-between">
          <div className="flex items-center gap-3">
            {quote.organization.logoUrl && <img src={quote.organization.logoUrl} alt="" className="h-12 w-auto" />}
            <div>
              <p className="text-lg font-bold text-fg">{quote.organization.name}</p>
              {quote.organization.address && <p className="text-xs text-fg-muted">{quote.organization.address}</p>}
            </div>
          </div>
          <div className="text-right">
            <p className="text-xl font-bold" style={{ color: brandColor }}>
              QUOTE
            </p>
            <p className="text-sm text-fg-muted">#{quote.number}</p>
            <div className="mt-1">
              <StatusBadge status={quote.status} />
            </div>
          </div>
        </div>

        <div className="mb-6 h-0.5" style={{ backgroundColor: brandColor }} />

        <div className="mb-6 flex justify-between">
          <div>
            <p className="text-xs font-medium text-fg-muted">PREPARED FOR</p>
            <p className="text-sm font-medium text-fg">{quote.customer.name}</p>
            {quote.customer.company && <p className="text-sm text-fg-secondary">{quote.customer.company}</p>}
            {quote.poNumber && <p className="mt-1 text-xs text-fg-muted">PO #: {quote.poNumber}</p>}
          </div>
          {quote.expiryDate && (
            <div className="text-right">
              <p className="text-xs font-medium text-fg-muted">VALID UNTIL</p>
              <p className="text-sm text-fg">{formatDate(quote.expiryDate)}</p>
            </div>
          )}
        </div>

        <table className="mb-6 w-full text-sm">
          <thead>
            <tr className="text-white" style={{ backgroundColor: brandColor }}>
              <th className="px-3 py-2 text-left font-medium">Description</th>
              <th className="px-3 py-2 text-left font-medium">Qty</th>
              <th className="px-3 py-2 text-left font-medium">Price</th>
              <th className="px-3 py-2 text-right font-medium">Amount</th>
            </tr>
          </thead>
          <tbody>
            {quote.items.map((item, index) => (
              <tr key={item.id} className={index % 2 === 1 ? "bg-surface-hover" : ""}>
                <td className="px-3 py-2">{item.description}</td>
                <td className="px-3 py-2">{item.quantity}</td>
                <td className="px-3 py-2">{formatCurrency(item.unitPrice, quote.currency)}</td>
                <td className="px-3 py-2 text-right">{formatCurrency(item.total, quote.currency)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="ml-auto flex max-w-xs flex-col gap-1 text-sm">
          <div className="flex justify-between text-fg-secondary">
            <span>Subtotal</span>
            <span>{formatCurrency(quote.subtotal, quote.currency)}</span>
          </div>
          {quote.discount > 0 && (
            <div className="flex justify-between text-fg-secondary">
              <span>Item discounts</span>
              <span>-{formatCurrency(quote.discount, quote.currency)}</span>
            </div>
          )}
          {quote.taxTotal > 0 && (
            <div className="flex justify-between text-fg-secondary">
              <span>Tax</span>
              <span>{formatCurrency(quote.taxTotal, quote.currency)}</span>
            </div>
          )}
          {quote.invoiceDiscountValue > 0 && (
            <div className="flex justify-between text-fg-secondary">
              <span>Discount{quote.invoiceDiscountType === "PERCENT" ? ` (${quote.invoiceDiscountValue}%)` : ""}</span>
              <span>
                -
                {formatCurrency(
                  quote.invoiceDiscountType === "PERCENT"
                    ? quote.subtotal * (quote.invoiceDiscountValue / 100)
                    : quote.invoiceDiscountValue,
                  quote.currency
                )}
              </span>
            </div>
          )}
          <div className="flex justify-between border-t border-border pt-1 text-base font-bold text-fg">
            <span>Total</span>
            <span>{formatCurrency(quote.total, quote.currency)}</span>
          </div>
        </div>

        {quote.notes && (
          <div className="mt-6 text-sm">
            <p className="text-xs font-medium text-fg-muted">NOTES</p>
            <p className="text-fg-secondary">{quote.notes}</p>
          </div>
        )}

        <div className="mt-6 flex gap-3">
          {canRespond && (
            <>
              <Button onClick={() => handleRespond("ACCEPT")} disabled={responding} style={{ backgroundColor: brandColor }}>
                <CheckCircle2 className="h-4 w-4" /> Accept quote
              </Button>
              <Button onClick={() => handleRespond("REJECT")} disabled={responding} variant="secondary">
                <XCircle className="h-4 w-4" /> Reject
              </Button>
            </>
          )}
          <Button asChild variant={canRespond ? "secondary" : "primary"} style={canRespond ? undefined : { backgroundColor: brandColor }}>
            <a href={publicQuotePdfUrl(quote.publicToken)} target="_blank" rel="noreferrer">
              <Download className="h-4 w-4" /> Download PDF
            </a>
          </Button>
        </div>
      </div>
    </div>
  );
}
