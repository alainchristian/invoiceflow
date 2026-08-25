import { useCurrentOrganization } from "@/hooks/useOrganization";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { InvoiceFormItem } from "@/hooks/useInvoices";

interface PreviewCustomer {
  name?: string;
  company?: string | null;
  email?: string | null;
}

export function InvoicePreview({
  customer,
  issueDate,
  dueDate,
  currency,
  items,
  notes,
  terms,
  invoiceNumber,
  poNumber,
  invoiceDiscountType = "FLAT",
  invoiceDiscountValue = 0,
  kind = "INVOICE",
  dateLabel = "DUE",
}: {
  customer: PreviewCustomer | null;
  issueDate?: string;
  dueDate?: string;
  currency: string;
  items: InvoiceFormItem[];
  notes?: string;
  terms?: string;
  invoiceNumber?: string;
  poNumber?: string;
  invoiceDiscountType?: "FLAT" | "PERCENT";
  invoiceDiscountValue?: number;
  kind?: "INVOICE" | "QUOTE" | "CREDIT NOTE";
  dateLabel?: string;
}) {
  const { data: org } = useCurrentOrganization();
  const brandColor = org?.brandColor || "#4f46e5";

  // Approximate preview only -- plain float math with no rounding at each step,
  // unlike the backend's invoice-math.ts (which uses Decimal and rounds at
  // every intermediate step). The authoritative total is always recomputed
  // server-side on save, so this can drift from it by fractions of a cent.
  // Not worth porting to a Decimal library here purely for a live, unpersisted
  // preview.
  const subtotal = items.reduce((sum, i) => sum + (i.quantity || 0) * (i.unitPrice || 0), 0);
  const discount = items.reduce((sum, i) => sum + (i.discount || 0), 0);
  const taxTotal = items.reduce(
    (sum, i) => sum + ((i.quantity || 0) * (i.unitPrice || 0) - (i.discount || 0)) * ((i.taxRate || 0) / 100),
    0
  );
  const invoiceDiscountAmount =
    invoiceDiscountValue > 0
      ? invoiceDiscountType === "PERCENT"
        ? subtotal * (invoiceDiscountValue / 100)
        : invoiceDiscountValue
      : 0;
  const total = subtotal - discount + taxTotal - invoiceDiscountAmount;

  return (
    <div className="rounded-xl border border-border bg-surface p-8 shadow-sm">
      <div className="mb-6 flex items-start justify-between">
        <div className="flex items-center gap-3">
          {org?.logoUrl && <img src={org.logoUrl} alt="" className="h-10 w-auto" />}
          <div>
            <p className="font-semibold text-fg">{org?.name}</p>
            {org?.address && <p className="text-xs text-fg-muted">{org.address}</p>}
          </div>
        </div>
        <div className="text-right">
          <p className="text-xl font-bold" style={{ color: brandColor }}>
            {kind}
          </p>
          <p className="text-xs text-fg-muted">{invoiceNumber || "Will be assigned"}</p>
        </div>
      </div>

      <div className="mb-6 h-0.5" style={{ backgroundColor: brandColor }} />

      <div className="mb-6 flex justify-between text-sm">
        <div>
          <p className="text-xs font-medium text-fg-muted">BILL TO</p>
          <p className="font-medium text-fg">{customer?.name || "Select a customer"}</p>
          {customer?.company && <p className="text-fg-secondary">{customer.company}</p>}
          {poNumber && <p className="mt-1 text-xs text-fg-muted">PO #: {poNumber}</p>}
        </div>
        <div className="text-right">
          <p className="text-xs font-medium text-fg-muted">ISSUED</p>
          <p className="text-fg">{issueDate ? formatDate(issueDate) : "-"}</p>
          <p className="mt-1 text-xs font-medium text-fg-muted">{dateLabel}</p>
          <p className="text-fg">{dueDate ? formatDate(dueDate) : "-"}</p>
        </div>
      </div>

      <table className="mb-6 w-full text-sm">
        <thead>
          <tr className="text-white" style={{ backgroundColor: brandColor }}>
            <th className="rounded-l-md px-3 py-2 text-left font-medium">Item</th>
            <th className="px-3 py-2 text-left font-medium">Qty</th>
            <th className="px-3 py-2 text-left font-medium">Price</th>
            <th className="rounded-r-md px-3 py-2 text-right font-medium">Total</th>
          </tr>
        </thead>
        <tbody>
          {items.length === 0 ? (
            <tr>
              <td colSpan={4} className="px-3 py-6 text-center text-fg-muted">
                Add a line item to see it here
              </td>
            </tr>
          ) : (
            items.map((item, i) => {
              const taxable = (item.quantity || 0) * (item.unitPrice || 0) - (item.discount || 0);
              const lineTotal = taxable + taxable * ((item.taxRate || 0) / 100);
              return (
                <tr key={i} className={i % 2 === 1 ? "bg-surface-hover" : ""}>
                  <td className="px-3 py-2">{item.description || "Untitled item"}</td>
                  <td className="px-3 py-2">{item.quantity || 0}</td>
                  <td className="px-3 py-2">{formatCurrency(item.unitPrice || 0, currency)}</td>
                  <td className="px-3 py-2 text-right">{formatCurrency(lineTotal, currency)}</td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>

      <div className="ml-auto flex max-w-xs flex-col gap-1 text-sm">
        <div className="flex justify-between text-fg-secondary">
          <span>Subtotal</span>
          <span>{formatCurrency(subtotal, currency)}</span>
        </div>
        {discount > 0 && (
          <div className="flex justify-between text-fg-secondary">
            <span>Item discounts</span>
            <span>-{formatCurrency(discount, currency)}</span>
          </div>
        )}
        {taxTotal > 0 && (
          <div className="flex justify-between text-fg-secondary">
            <span>Tax</span>
            <span>{formatCurrency(taxTotal, currency)}</span>
          </div>
        )}
        {invoiceDiscountAmount > 0 && (
          <div className="flex justify-between text-fg-secondary">
            <span>Discount{invoiceDiscountType === "PERCENT" ? ` (${invoiceDiscountValue}%)` : ""}</span>
            <span>-{formatCurrency(invoiceDiscountAmount, currency)}</span>
          </div>
        )}
        <div className="flex justify-between border-t border-border pt-1 text-base font-bold text-fg">
          <span>Total</span>
          <span>{formatCurrency(total, currency)}</span>
        </div>
      </div>

      {notes && (
        <div className="mt-6 text-sm">
          <p className="text-xs font-medium text-fg-muted">NOTES</p>
          <p className="text-fg-secondary">{notes}</p>
        </div>
      )}
      {terms && (
        <div className="mt-3 text-sm">
          <p className="text-xs font-medium text-fg-muted">TERMS</p>
          <p className="text-fg-secondary">{terms}</p>
        </div>
      )}
    </div>
  );
}
