import { prisma } from "../../lib/db.js";
import type { Prisma } from "@prisma/client";

// Atomically reserves the next invoice number for an organization, e.g. INV-2026-0001.
export async function nextInvoiceNumber(tx: Prisma.TransactionClient, organizationId: string) {
  const org = await tx.organization.update({
    where: { id: organizationId },
    data: { nextInvoiceSeq: { increment: 1 } },
  });
  const seq = org.nextInvoiceSeq - 1;
  const year = new Date().getFullYear();
  const prefix = org.invoicePrefix || "INV";
  return `${prefix}-${year}-${String(seq).padStart(4, "0")}`;
}
