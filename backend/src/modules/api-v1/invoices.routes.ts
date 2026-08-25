import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/db.js";
import { requireApiKey } from "../../middleware/apiKey.js";
import { toApiNumbers } from "../../lib/serialize.js";
import { computeInvoiceTotals } from "../invoices/invoice-math.js";
import { nextInvoiceNumber } from "../invoices/invoice-number.js";
import { assertInvoiceQuotaAvailable, QuotaExceededError } from "../billing/limits.js";
import type { AuthedRequest } from "../../middleware/auth.js";

const router = Router();
router.use(requireApiKey);

const INCLUDE = { customer: true, items: { orderBy: { sortOrder: "asc" as const } } };

router.get("/", async (req: AuthedRequest, res, next) => {
  try {
    const invoices = await prisma.invoice.findMany({
      where: { organizationId: req.organizationId },
      include: INCLUDE,
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    res.json(toApiNumbers(invoices));
  } catch (err) {
    next(err);
  }
});

router.get("/:id", async (req: AuthedRequest, res, next) => {
  try {
    const invoice = await prisma.invoice.findFirst({
      where: { id: req.params.id, organizationId: req.organizationId },
      include: INCLUDE,
    });
    if (!invoice) return res.status(404).json({ error: "Invoice not found" });
    res.json(toApiNumbers(invoice));
  } catch (err) {
    next(err);
  }
});

const lineItemSchema = z.object({
  description: z.string().min(1),
  quantity: z.number().positive(),
  unitPrice: z.number().min(0),
  taxRate: z.number().min(0).optional(),
  discount: z.number().min(0).optional(),
});

const createSchema = z.object({
  customerId: z.string().min(1),
  dueDate: z.string().min(1),
  currency: z.string().default("USD"),
  notes: z.string().optional(),
  items: z.array(lineItemSchema).min(1),
});

router.post("/", async (req: AuthedRequest, res, next) => {
  try {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
    }
    const data = parsed.data;

    const customer = await prisma.customer.findFirst({
      where: { id: data.customerId, organizationId: req.organizationId },
    });
    if (!customer) return res.status(404).json({ error: "Customer not found" });

    try {
      await assertInvoiceQuotaAvailable(req.organizationId as string);
    } catch (err) {
      if (err instanceof QuotaExceededError) return res.status(402).json({ error: err.message });
      return next(err);
    }

    const totals = computeInvoiceTotals(data.items);

    const invoice = await prisma.$transaction(async (tx) => {
      const number = await nextInvoiceNumber(tx, req.organizationId as string);
      return tx.invoice.create({
        data: {
          organizationId: req.organizationId as string,
          customerId: data.customerId,
          number,
          dueDate: new Date(data.dueDate),
          currency: data.currency,
          notes: data.notes,
          subtotal: totals.subtotal,
          discount: totals.discount,
          taxTotal: totals.taxTotal,
          total: totals.total,
          items: {
            create: totals.items.map((item, index) => ({
              description: item.description,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              taxRate: item.taxRate,
              discount: item.discount,
              total: item.total,
              sortOrder: index,
            })),
          },
        },
        include: INCLUDE,
      });
    });

    res.status(201).json(toApiNumbers(invoice));
  } catch (err) {
    next(err);
  }
});

export default router;
