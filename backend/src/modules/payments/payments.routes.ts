import { Router } from "express";
import { prisma } from "../../lib/db.js";
import { requireAuth, requireOrgMember, type AuthedRequest } from "../../middleware/auth.js";
import { toApiNumbers } from "../../lib/serialize.js";
import { toCsv, sendCsv } from "../../lib/csv.js";

const router = Router();
router.use(requireAuth, requireOrgMember);

router.get("/", async (req: AuthedRequest, res, next) => {
  try {
    const payments = await prisma.payment.findMany({
      where: { invoice: { organizationId: req.organizationId } },
      include: { invoice: { include: { customer: true } } },
      orderBy: { paidAt: "desc" },
    });
    res.json(toApiNumbers(payments));
  } catch (err) {
    next(err);
  }
});

router.get("/export.csv", async (req: AuthedRequest, res, next) => {
  try {
    const payments = toApiNumbers(
      await prisma.payment.findMany({
        where: { invoice: { organizationId: req.organizationId } },
        include: { invoice: { include: { customer: true } } },
        orderBy: { paidAt: "desc" },
      })
    );
    const csv = toCsv(
      [
        { key: "date", header: "Date" },
        { key: "invoiceNumber", header: "Invoice Number" },
        { key: "customer", header: "Customer" },
        { key: "amount", header: "Amount" },
        { key: "method", header: "Method" },
        { key: "type", header: "Type" },
      ],
      payments.map((p: any) => ({
        date: p.paidAt.toISOString().slice(0, 10),
        invoiceNumber: p.invoice.number,
        customer: p.invoice.customer.name,
        amount: p.amount,
        method: p.method,
        type: p.type,
      }))
    );
    sendCsv(res, "payments", csv);
  } catch (err) {
    next(err);
  }
});

export default router;
