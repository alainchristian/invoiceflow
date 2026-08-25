import type { Prisma } from "@prisma/client";

// Atomically reserves the next quote number for an organization, e.g. QUO-2026-0001.
export async function nextQuoteNumber(tx: Prisma.TransactionClient, organizationId: string) {
  const org = await tx.organization.update({
    where: { id: organizationId },
    data: { nextQuoteSeq: { increment: 1 } },
  });
  const seq = org.nextQuoteSeq - 1;
  const year = new Date().getFullYear();
  const prefix = org.quotePrefix || "QUO";
  return `${prefix}-${year}-${String(seq).padStart(4, "0")}`;
}
