import type { Prisma } from "@prisma/client";
import { prisma } from "./db.js";

// Fans a notification out to every member of an organization -- same pattern
// as reminders/notify.ts's createInvoiceReminderNotifications, generalized
// for any event type. Accepts a transaction client when called alongside a
// state-changing write, but a plain prisma call is fine too since this never
// needs to be atomic with the triggering write (a notification arriving a
// beat late is harmless, unlike a webhook or payment record).
export async function notifyOrganization(
  organizationId: string,
  data: { type: "INVOICE_VIEWED" | "INVOICE_PAID" | "QUOTE_ACCEPTED"; title: string; message: string; invoiceId?: string; quoteId?: string },
  client: Prisma.TransactionClient | typeof prisma = prisma
): Promise<void> {
  const members = await client.organizationMember.findMany({
    where: { organizationId },
    select: { id: true },
  });
  if (members.length === 0) return;

  await client.notification.createMany({
    data: members.map((m) => ({
      organizationMemberId: m.id,
      type: data.type,
      title: data.title,
      message: data.message,
      invoiceId: data.invoiceId,
      quoteId: data.quoteId,
    })),
  });
}
