export interface LineItemInput {
  description: string;
  quantity: number;
  unitPrice: number;
  taxRate?: number;
  discount?: number;
}

export interface ComputedLineItem extends LineItemInput {
  taxRate: number;
  discount: number;
  total: number;
}

export interface InvoiceLevelDiscount {
  type: "FLAT" | "PERCENT";
  value: number;
}

export interface InvoiceTotals {
  items: ComputedLineItem[];
  subtotal: number;
  discount: number;
  invoiceDiscountAmount: number;
  taxTotal: number;
  total: number;
}

export const round2 = (n: number) => Math.round(n * 100) / 100;

// Shared math for invoice creation, edits, and the live preview on the frontend.
// Each line item can carry its own tax rate and flat discount; on top of that,
// an optional invoice-level discount is applied as a final deduction on the
// post-tax total (not re-split across line items or their tax), matching a
// simple "negotiated discount off the whole invoice" model.
export function computeInvoiceTotals(
  items: LineItemInput[],
  invoiceDiscount?: InvoiceLevelDiscount
): InvoiceTotals {
  const computed: ComputedLineItem[] = items.map((item) => {
    const taxRate = item.taxRate ?? 0;
    const discount = item.discount ?? 0;
    const taxable = item.quantity * item.unitPrice - discount;
    const total = round2(taxable + taxable * (taxRate / 100));
    return { ...item, taxRate, discount, total };
  });

  const subtotal = round2(computed.reduce((sum, i) => sum + i.quantity * i.unitPrice, 0));
  const discount = round2(computed.reduce((sum, i) => sum + i.discount, 0));
  const taxTotal = round2(
    computed.reduce((sum, i) => sum + (i.quantity * i.unitPrice - i.discount) * (i.taxRate / 100), 0)
  );
  const invoiceDiscountAmount = round2(
    !invoiceDiscount || invoiceDiscount.value <= 0
      ? 0
      : invoiceDiscount.type === "PERCENT"
        ? subtotal * (invoiceDiscount.value / 100)
        : invoiceDiscount.value
  );
  const total = round2(subtotal - discount + taxTotal - invoiceDiscountAmount);

  return { items: computed, subtotal, discount, invoiceDiscountAmount, taxTotal, total };
}
