import { prisma } from "../../lib/db.js";
import type { Prisma } from "@prisma/client";

// Atomically reserves the next credit note number for an organization, e.g. CN-2026-0001.
export async function nextCreditNoteNumber(tx: Prisma.TransactionClient, organizationId: string) {
  const org = await tx.organization.update({
    where: { id: organizationId },
    data: { nextCreditNoteSeq: { increment: 1 } },
  });
  const seq = org.nextCreditNoteSeq - 1;
  const year = new Date().getFullYear();
  const prefix = org.creditNotePrefix || "CN";
  return `${prefix}-${year}-${String(seq).padStart(4, "0")}`;
}
