import { prisma } from "../../lib/db.js";
import { createInvoiceReminderNotifications } from "./notify.js";

const POLL_INTERVAL_MS = 60 * 60 * 1000; // hourly, matches recurring-invoices' cadence

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

export function startReminderScheduler() {
  checkOverdueInvoices().catch((err) => console.error("[reminders] boot run failed", err));
  setInterval(() => {
    checkOverdueInvoices().catch((err) => console.error("[reminders] scheduled run failed", err));
  }, POLL_INTERVAL_MS);
}
