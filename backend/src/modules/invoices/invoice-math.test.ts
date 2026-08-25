import { describe, it, expect } from "vitest";
import { computeInvoiceTotals } from "./invoice-math.js";

describe("computeInvoiceTotals", () => {
  it("applies line-level tax after a line-level flat discount", () => {
    // qty=2 * $50 = $100, minus $5 discount = $95 taxable, +10% tax = $104.50
    const totals = computeInvoiceTotals([
      { description: "Widget", quantity: 2, unitPrice: 50, taxRate: 10, discount: 5 },
    ]);
    expect(totals.subtotal.toNumber()).toBe(100);
    expect(totals.discount.toNumber()).toBe(5);
    expect(totals.taxTotal.toNumber()).toBe(9.5);
    expect(totals.total.toNumber()).toBe(104.5);
    expect(totals.items[0].total.toNumber()).toBe(104.5);
  });

  it("applies an invoice-level FLAT discount after tax", () => {
    const totals = computeInvoiceTotals(
      [{ description: "Service", quantity: 1, unitPrice: 200, taxRate: 0 }],
      { type: "FLAT", value: 20 }
    );
    expect(totals.subtotal.toNumber()).toBe(200);
    expect(totals.invoiceDiscountAmount.toNumber()).toBe(20);
    expect(totals.total.toNumber()).toBe(180);
  });

  it("applies an invoice-level PERCENT discount computed off the pre-discount subtotal", () => {
    const totals = computeInvoiceTotals(
      [{ description: "Service", quantity: 1, unitPrice: 200, taxRate: 0 }],
      { type: "PERCENT", value: 15 }
    );
    expect(totals.invoiceDiscountAmount.toNumber()).toBe(30);
    expect(totals.total.toNumber()).toBe(170);
  });

  it("defaults invoiceDiscountAmount to 0 when no invoice-level discount is passed", () => {
    // Mirrors how CreditNotes and RecurringInvoices call this function.
    const totals = computeInvoiceTotals([{ description: "Item", quantity: 1, unitPrice: 10, taxRate: 0 }]);
    expect(totals.invoiceDiscountAmount.toNumber()).toBe(0);
    expect(totals.total.toNumber()).toBe(10);
  });

  // This is exactly the class of input that silently drifted under plain
  // Float/Math.round math pre-Decimal: many small line items whose
  // fractional-cent tax remainders would otherwise accumulate binary
  // floating-point error. 20 lines * $0.03 = $0.60 subtotal; 8.25% tax on
  // $0.60 is $0.0495, which rounds half-up to $0.05.
  it("stays exact for many small line items with a percentage tax rate", () => {
    const items = Array.from({ length: 20 }, () => ({
      description: "Micro-item",
      quantity: 1,
      unitPrice: 0.03,
      taxRate: 8.25,
    }));
    const totals = computeInvoiceTotals(items);
    expect(totals.subtotal.toNumber()).toBe(0.6);
    expect(totals.taxTotal.toNumber()).toBe(0.05);
    expect(totals.total.toNumber()).toBe(0.65);
  });
});
