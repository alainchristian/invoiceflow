import { prisma } from "../../lib/db.js";
import { createInvoiceReminderNotifications } from "./notify.js";
import { computeInvoiceTotals, round2 } from "../invoices/invoice-math.js";

const POLL_INTERVAL_MS = 60 * 60 * 1000; // hourly, matches recurring-invoices' cadence
const DAY_MS = 24 * 60 * 60 * 1000;

// Flips SENT/VIEWED invoices past their due date to OVERDUE and notifies every
// member of the invoice's organization. Idempotent by construction: once an
// invoice becomes OVERDUE it permanently drops out of the `status IN (SENT, VIEWED)`
// filter below, so re-running this on every nodemon restart is a safe no-op for
// invoices already flipped -- no separate "already notified" flag is needed for
// this automatic path (see plan for the full reasoning).
export async function checkOverdueInvoices(now: Date = new Date(), organizationId?: string) {
  const due = await prisma.invoice.findMany({
    where: {
      status: { in: ["SENT", "VIEWED"] },
      dueDate: { lt: now },
      ...(organizationId ? { organizationId } : {}),
    },
    include: { customer: true },
  });

  for (const invoice of due) {
    await prisma.$transaction(async (tx) => {
      const fresh = await tx.invoice.findUnique({ where: { id: invoice.id }, include: { customer: true } });
      if (!fresh || (fresh.status !== "SENT" && fresh.status !== "VIEWED") || fresh.dueDate >= now) return;

      await tx.invoice.update({
        where: { id: fresh.id },
        data: { status: "OVERDUE", lastReminderSentAt: now },
      });
      await createInvoiceReminderNotifications(tx, fresh, now);
    });
  }

  return due.length;
}

// Adds a one-time "Late fee" line item to invoices that have been OVERDUE
// past their organization's configured grace period, then recomputes the
// invoice's totals. This runs as a separate pass from checkOverdueInvoices
// above: that function only fires at the SENT/VIEWED -> OVERDUE transition
// instant, while grace-period timing needs to keep re-checking already-
// OVERDUE invoices on every tick. Idempotent: re-checks for an existing
// "Late fee" item inside the transaction (same guard pattern as
// checkOverdueInvoices' fresh-refetch) before adding another, so this is
// safe to run every hour without ever double-charging a fee.
export async function applyLateFees(now: Date = new Date(), organizationId?: string) {
  const candidates = await prisma.invoice.findMany({
    where: {
      status: "OVERDUE",
      organization: { lateFeeEnabled: true },
      ...(organizationId ? { organizationId } : {}),
    },
    include: { items: true, organization: true },
  });

  const due = candidates.filter(
    (inv) => inv.dueDate.getTime() + inv.organization.lateFeeGraceDays * DAY_MS < now.getTime()
  );

  let appliedCount = 0;
  for (const invoice of due) {
    const applied = await prisma.$transaction(async (tx) => {
      const alreadyHasFee = await tx.invoiceItem.findFirst({
        where: { invoiceId: invoice.id, description: "Late fee" },
      });
      if (alreadyHasFee) return false;

      const org = invoice.organization;
      const feeAmount = round2(
        org.lateFeeType === "PERCENT" ? invoice.subtotal.times(org.lateFeeValue.div(100)) : org.lateFeeValue
      );
      if (feeAmount.lessThanOrEqualTo(0)) return false;

      const lineItems = [
        ...invoice.items.map((item) => ({
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          taxRate: item.taxRate,
          discount: item.discount,
        })),
        { description: "Late fee", quantity: 1, unitPrice: feeAmount, taxRate: 0, discount: 0 },
      ];
      const totals = computeInvoiceTotals(lineItems, {
        type: invoice.invoiceDiscountType,
        value: invoice.invoiceDiscountValue,
      });

      await tx.invoiceItem.create({
        data: {
          invoiceId: invoice.id,
          description: "Late fee",
          quantity: 1,
          unitPrice: feeAmount,
          taxRate: 0,
          discount: 0,
          total: feeAmount,
          sortOrder: invoice.items.length,
        },
      });
      await tx.invoice.update({
        where: { id: invoice.id },
        data: { subtotal: totals.subtotal, taxTotal: totals.taxTotal, total: totals.total },
      });
      return true;
    });
    if (applied) appliedCount += 1;
  }

  return appliedCount;
}

export function startReminderScheduler() {
  checkOverdueInvoices().catch((err) => console.error("[reminders] boot run failed", err));
  applyLateFees().catch((err) => console.error("[reminders] late fee boot run failed", err));
  setInterval(() => {
    checkOverdueInvoices().catch((err) => console.error("[reminders] scheduled run failed", err));
    applyLateFees().catch((err) => console.error("[reminders] late fee scheduled run failed", err));
  }, POLL_INTERVAL_MS);
}
