import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { CreditCard, Download } from "lucide-react";
import api from "@/lib/api";
import { publicInvoicePdfUrl } from "@/hooks/useInvoices";
import { usePublicCheckout } from "@/hooks/useCheckout";
import { useToast } from "@/components/ui/Toast";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { StatusBadge } from "@/components/ui/Badge";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { Invoice, Organization } from "@/types";

type PublicInvoice = Invoice & { organization: Organization };

const POLL_ATTEMPTS = 5;
const POLL_INTERVAL_MS = 2000;

export default function PublicInvoicePage() {
  const { token } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const toast = useToast();
  const checkout = usePublicCheckout(token);

  const [invoice, setInvoice] = useState<PublicInvoice | null>(null);
  const [error, setError] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [payFull, setPayFull] = useState(true);
  const [customAmount, setCustomAmount] = useState("");
  const pollAttempts = useRef(0);

  const fetchInvoice = () =>
    api
      .get(`/public/invoices/${token}`)
      .then(({ data }) => setInvoice(data))
      .catch(() => setError("This invoice link is invalid or has expired."));

  useEffect(() => {
    fetchInvoice();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // Default to paying the deposit (pre-filled) rather than the full balance,
  // when this invoice has one configured and nothing has been paid yet --
  // but only once, on the invoice's first successful load. Guarded by a ref
  // so a later refetch mid-payment-confirmation poll doesn't clobber
  // whatever the customer has since chosen.
  const depositDefaultApplied = useRef(false);
  useEffect(() => {
    if (!invoice || depositDefaultApplied.current) return;
    depositDefaultApplied.current = true;
    if (invoice.depositAmount != null && invoice.amountPaid === 0) {
      setPayFull(false);
      setCustomAmount(String(invoice.depositAmount));
    }
  }, [invoice]);

  useEffect(() => {
    if (searchParams.get("payment") === "success") {
      setConfirming(true);
      navigate(`/i/${token}`, { replace: true });
    } else if (searchParams.get("payment") === "cancelled") {
      toast.error("Checkout was cancelled.");
      navigate(`/i/${token}`, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!confirming || !invoice) return;
    if (invoice.status === "PAID") {
      setConfirming(false);
      return;
    }
    if (pollAttempts.current >= POLL_ATTEMPTS) {
      setConfirming(false);
      return;
    }
    const timer = setTimeout(() => {
      pollAttempts.current += 1;
      fetchInvoice();
    }, POLL_INTERVAL_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [confirming, invoice]);

  async function handlePayNow() {
    const amount = payFull ? undefined : Number(customAmount);
    if (!payFull && (!amount || amount <= 0)) {
      toast.error("Enter an amount to pay");
      return;
    }
    try {
      const { url } = await checkout.mutateAsync(amount);
      window.location.href = url;
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Could not start checkout. Please try again.");
    }
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-fg-secondary">{error}</div>
    );
  }
  if (!invoice) {
    return <div className="flex min-h-screen items-center justify-center bg-background text-fg-secondary">Loading...</div>;
  }

  const brandColor = invoice.organization.brandColor || "#4f46e5";
  const balanceDue = invoice.total - invoice.amountPaid;
  const depositApplies = invoice.depositAmount != null && invoice.amountPaid === 0;

  const canPay = invoice.status !== "PAID" && invoice.status !== "CANCELLED" && balanceDue > 0;

  return (
    <div className="min-h-screen bg-background py-10">
      <div className="mx-auto max-w-2xl rounded-xl border border-border bg-surface p-8 shadow-sm">
        {confirming && (
          <div className="mb-6 rounded-lg border border-border bg-surface-hover px-4 py-3 text-sm text-fg-secondary">
            {invoice.status === "PAID"
              ? "Payment received — thank you!"
              : "Payment received — confirming with our system, this page will update shortly..."}
          </div>
        )}
        <div className="mb-6 flex items-start justify-between">
          <div className="flex items-center gap-3">
            {invoice.organization.logoUrl && <img src={invoice.organization.logoUrl} alt="" className="h-12 w-auto" />}
            <div>
              <p className="text-lg font-bold text-fg">{invoice.organization.name}</p>
              {invoice.organization.address && <p className="text-xs text-fg-muted">{invoice.organization.address}</p>}
            </div>
          </div>
          <div className="text-right">
            <p className="text-xl font-bold" style={{ color: brandColor }}>
              INVOICE
            </p>
            <p className="text-sm text-fg-muted">#{invoice.number}</p>
            <div className="mt-1">
              <StatusBadge status={invoice.status} />
            </div>
          </div>
        </div>

        <div className="mb-6 h-0.5" style={{ backgroundColor: brandColor }} />

        <div className="mb-6 flex justify-between">
          <div>
            <p className="text-xs font-medium text-fg-muted">BILL TO</p>
            <p className="text-sm font-medium text-fg">{invoice.customer.name}</p>
            {invoice.customer.company && <p className="text-sm text-fg-secondary">{invoice.customer.company}</p>}
            {invoice.poNumber && <p className="mt-1 text-xs text-fg-muted">PO #: {invoice.poNumber}</p>}
          </div>
          <div className="text-right">
            <p className="text-xs font-medium text-fg-muted">DUE</p>
            <p className="text-sm text-fg">{formatDate(invoice.dueDate)}</p>
          </div>
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
            {invoice.items.map((item, index) => (
              <tr key={item.id} className={index % 2 === 1 ? "bg-surface-hover" : ""}>
                <td className="px-3 py-2">{item.description}</td>
                <td className="px-3 py-2">{item.quantity}</td>
                <td className="px-3 py-2">{formatCurrency(item.unitPrice, invoice.currency)}</td>
                <td className="px-3 py-2 text-right">{formatCurrency(item.total, invoice.currency)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="ml-auto flex max-w-xs flex-col gap-1 text-sm">
          <div className="flex justify-between text-fg-secondary">
            <span>Subtotal</span>
            <span>{formatCurrency(invoice.subtotal, invoice.currency)}</span>
          </div>
          {invoice.discount > 0 && (
            <div className="flex justify-between text-fg-secondary">
              <span>Item discounts</span>
              <span>-{formatCurrency(invoice.discount, invoice.currency)}</span>
            </div>
          )}
          {invoice.taxTotal > 0 && (
            <div className="flex justify-between text-fg-secondary">
              <span>Tax</span>
              <span>{formatCurrency(invoice.taxTotal, invoice.currency)}</span>
            </div>
          )}
          {invoice.invoiceDiscountValue > 0 && (
            <div className="flex justify-between text-fg-secondary">
              <span>Discount{invoice.invoiceDiscountType === "PERCENT" ? ` (${invoice.invoiceDiscountValue}%)` : ""}</span>
              <span>
                -
                {formatCurrency(
                  invoice.invoiceDiscountType === "PERCENT"
                    ? invoice.subtotal * (invoice.invoiceDiscountValue / 100)
                    : invoice.invoiceDiscountValue,
                  invoice.currency
                )}
              </span>
            </div>
          )}
          <div className="flex justify-between border-t border-border pt-1 text-base font-bold text-fg">
            <span>Total</span>
            <span>{formatCurrency(invoice.total, invoice.currency)}</span>
          </div>
          {invoice.amountPaid > 0 && (
            <div className="flex justify-between text-fg-secondary">
              <span>Balance due</span>
              <span className="font-semibold text-fg">{formatCurrency(balanceDue, invoice.currency)}</span>
            </div>
          )}
        </div>

        {invoice.notes && (
          <div className="mt-6 text-sm">
            <p className="text-xs font-medium text-fg-muted">NOTES</p>
            <p className="text-fg-secondary">{invoice.notes}</p>
          </div>
        )}

        {canPay && depositApplies && (
          <p className="mt-6 text-sm text-fg-secondary">
            Deposit due: <span className="font-semibold text-fg">{formatCurrency(invoice.depositAmount!, invoice.currency)}</span>
            {" · "}Balance due after deposit:{" "}
            <span className="font-semibold text-fg">
              {formatCurrency(balanceDue - invoice.depositAmount!, invoice.currency)}
            </span>
          </p>
        )}

        {canPay && (
          <div className="mt-3 flex items-center gap-4 text-sm">
            <label className="flex cursor-pointer items-center gap-1.5 text-fg-secondary">
              <input type="radio" checked={payFull} onChange={() => setPayFull(true)} />
              Pay in full
            </label>
            <label className="flex cursor-pointer items-center gap-1.5 text-fg-secondary">
              <input type="radio" checked={!payFull} onChange={() => setPayFull(false)} />
              {depositApplies ? `Pay deposit (${formatCurrency(invoice.depositAmount!, invoice.currency)})` : "Pay a different amount"}
            </label>
            {!payFull && (
              <Input
                type="number"
                min={0.01}
                max={balanceDue}
                step="0.01"
                value={customAmount}
                onChange={(e) => setCustomAmount(e.target.value)}
                placeholder={balanceDue.toFixed(2)}
                className="h-8 w-28"
              />
            )}
          </div>
        )}

        <div className="mt-4 flex gap-3">
          {canPay && (
            <Button
              onClick={handlePayNow}
              disabled={checkout.isPending}
              style={{ backgroundColor: brandColor }}
            >
              <CreditCard className="h-4 w-4" />
              {checkout.isPending
                ? "Redirecting..."
                : `Pay ${formatCurrency(payFull ? balanceDue : Number(customAmount || 0), invoice.currency)}`}
            </Button>
          )}
          <Button asChild variant={canPay ? "secondary" : "primary"} style={canPay ? undefined : { backgroundColor: brandColor }}>
            <a href={publicInvoicePdfUrl(invoice.publicToken)} target="_blank" rel="noreferrer">
              <Download className="h-4 w-4" /> Download PDF
            </a>
          </Button>
        </div>
      </div>
    </div>
  );
}
