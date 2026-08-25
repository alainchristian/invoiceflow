import { Prisma } from "@prisma/client";

// Use Prisma's own re-exported Decimal (the exact class it returns for Decimal
// fields on query results) rather than a separately-installed decimal.js --
// a standalone decimal.js instance would throw on a Prisma-returned Decimal
// value, since its constructor only fast-paths `instanceof` its own class.
export const Decimal = Prisma.Decimal;
export type Decimal = Prisma.Decimal;

export interface LineItemInput {
  description: string;
  quantity: number;
  unitPrice: Prisma.Decimal.Value;
  taxRate?: number;
  discount?: Prisma.Decimal.Value;
}

export interface ComputedLineItem {
  description: string;
  quantity: number;
  unitPrice: Decimal;
  taxRate: number;
  discount: Decimal;
  total: Decimal;
}

export interface InvoiceLevelDiscount {
  type: "FLAT" | "PERCENT";
  value: Prisma.Decimal.Value;
}

export interface InvoiceTotals {
  items: ComputedLineItem[];
  subtotal: Decimal;
  discount: Decimal;
  invoiceDiscountAmount: Decimal;
  taxTotal: Decimal;
  total: Decimal;
}

// Rounds to 2dp, half-up -- the same rounding Math.round(n*100)/100 did
// pre-Decimal, applied at the same points in the pipeline below. Deliberately
// NOT switched to "round once at the end": that would change already-persisted
// invoice totals if this function is ever called again on the same inputs
// (e.g. a future edit-and-recompute), which is a bigger behavioral risk than
// keeping the current (documented) step-rounding behavior.
export const round2 = (n: Prisma.Decimal.Value): Decimal =>
  new Decimal(n).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

// Shared math for invoice, quote, credit-note, and recurring-invoice totals.
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
    const unitPrice = new Decimal(item.unitPrice);
    const discount = new Decimal(item.discount ?? 0);
    const taxable = unitPrice.times(item.quantity).minus(discount);
    const total = round2(taxable.plus(taxable.times(taxRate / 100)));
    return { description: item.description, quantity: item.quantity, unitPrice, taxRate, discount, total };
  });

  const subtotal = round2(
    computed.reduce((sum, i) => sum.plus(i.unitPrice.times(i.quantity)), new Decimal(0))
  );
  const discount = round2(computed.reduce((sum, i) => sum.plus(i.discount), new Decimal(0)));
  const taxTotal = round2(
    computed.reduce(
      (sum, i) => sum.plus(i.unitPrice.times(i.quantity).minus(i.discount).times(i.taxRate / 100)),
      new Decimal(0)
    )
  );
  const invoiceDiscountAmount = round2(
    !invoiceDiscount || new Decimal(invoiceDiscount.value).lessThanOrEqualTo(0)
      ? 0
      : invoiceDiscount.type === "PERCENT"
        ? subtotal.times(new Decimal(invoiceDiscount.value).div(100))
        : invoiceDiscount.value
  );
  const total = round2(subtotal.minus(discount).plus(taxTotal).minus(invoiceDiscountAmount));

  return { items: computed, subtotal, discount, invoiceDiscountAmount, taxTotal, total };
}
