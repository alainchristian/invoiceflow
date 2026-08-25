import { Prisma } from "@prisma/client";

// Recursively converts every Prisma.Decimal instance in a value (including
// nested objects/arrays) to a plain JS number. Needed at every boundary where
// a Prisma query result carrying Decimal fields crosses out of the DB layer:
//   - JSON API responses (Decimal serializes to a STRING via toJSON, not a
//     number, silently changing the type the frontend receives)
//   - the PDF-rendering worker thread (structured clone throws outright on a
//     Decimal instance -- see renderInvoicePdf.ts's workerData usage)
//   - email templates and other display-only formatting (they type money
//     fields as `number` and do plain arithmetic on them)
//
// Precision-critical money math that gets recomputed and persisted back to
// the database (payment/refund/webhook balance tracking) must NOT go through
// this first -- do that arithmetic with Prisma.Decimal directly and only
// convert at the boundary, after the write.
export function toApiNumbers(value: any): any {
  if (value instanceof Prisma.Decimal) {
    return value.toNumber();
  }
  if (value instanceof Date) {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((v) => toApiNumbers(v));
  }
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      out[k] = toApiNumbers(v);
    }
    return out;
  }
  return value;
}
