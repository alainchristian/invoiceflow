import type { Prisma } from "@prisma/client";
import { round2 } from "../invoices/invoice-math.js";

type InvoiceWithCustomer = Prisma.InvoiceGetPayload<{ include: { customer: true } }>;

function money(amount: number, currency: string) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(amount);
}

// Notifies every member of the invoice's organization about an overdue (or soon-due)
// invoice. Used both by the automatic scheduler (first detection) and the manual
// "Send reminder" action (any time after, unlimited, no dedup -- see plan non-goals).
export async function createInvoiceReminderNotifications(
  tx: Prisma.TransactionClient,
  invoice: InvoiceWithCustomer,
  now: Date
): Promise<number> {
  const members = await tx.organizationMember.findMany({
    where: { organizationId: invoice.organizationId },
    select: { id: true },
  });
  if (members.length === 0) return 0;

  const amountDue = round2(invoice.total - invoice.amountPaid);
  const isOverdue = invoice.dueDate < now;
  const title = isOverdue ? `Invoice ${invoice.number} is overdue` : `Reminder: invoice ${invoice.number} is due soon`;
  const message = `${invoice.customer.name} owes ${money(amountDue, invoice.currency)} on invoice ${invoice.number}, due ${invoice.dueDate.toLocaleDateString()}.`;

  await tx.notification.createMany({
    data: members.map((m) => ({
      organizationMemberId: m.id,
      type: "INVOICE_OVERDUE" as const,
      title,
      message,
      invoiceId: invoice.id,
    })),
  });

  return members.length;
}
