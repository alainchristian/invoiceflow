import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/db.js";
import { requireAuth, requireOrgMember, type AuthedRequest } from "../../middleware/auth.js";
import { computeInvoiceTotals } from "../invoices/invoice-math.js";
import { nextInvoiceNumber } from "../invoices/invoice-number.js";
import { renderDocumentPdfToBuffer } from "../invoices/renderInvoicePdf.js";
import { nextQuoteNumber } from "./quote-number.js";
import { assertInvoiceQuotaAvailable, QuotaExceededError } from "../billing/limits.js";
import { sendEmail } from "../../lib/email.js";
import { quoteEmail } from "../email/templates.js";
import { toApiNumbers } from "../../lib/serialize.js";

const router = Router();
const publicRouter = Router();

const STATUS_VALUES = ["DRAFT", "SENT", "VIEWED", "ACCEPTED", "REJECTED", "EXPIRED", "CONVERTED"] as const;
const INCLUDE = { customer: true, items: { orderBy: { sortOrder: "asc" as const } } };
const PUBLIC_INCLUDE = {
  customer: true,
  items: { orderBy: { sortOrder: "asc" as const } },
  organization: {
    select: { name: true, logoUrl: true, brandColor: true, address: true, phone: true, email: true },
  },
};
const INVOICE_INCLUDE = { customer: true, items: { orderBy: { sortOrder: "asc" as const } }, payments: true };

// Lazily flips a stale DRAFT/SENT/VIEWED quote to EXPIRED on read -- no scheduler needed for quote expiry.
async function expireIfNeeded<T extends { id: string; status: string; expiryDate: Date | null }>(quote: T): Promise<T> {
  if (["DRAFT", "SENT", "VIEWED"].includes(quote.status) && quote.expiryDate && quote.expiryDate < new Date()) {
    await prisma.quote.update({ where: { id: quote.id }, data: { status: "EXPIRED" } });
    quote.status = "EXPIRED";
  }
  return quote;
}

router.use(requireAuth, requireOrgMember);

router.get("/", async (req: AuthedRequest, res, next) => {
  try {
    const { status, search, page = "1", pageSize = "20" } = req.query as Record<string, string>;
    const where: any = { organizationId: req.organizationId };
    if (status && STATUS_VALUES.includes(status as any)) where.status = status;
    if (search) {
      where.OR = [
        { number: { contains: search, mode: "insensitive" } },
        { customer: { name: { contains: search, mode: "insensitive" } } },
      ];
    }

    const take = Math.min(parseInt(pageSize, 10) || 20, 100);
    const skip = (Math.max(parseInt(page, 10) || 1, 1) - 1) * take;

    const [quotes, total] = await Promise.all([
      prisma.quote.findMany({ where, include: INCLUDE, orderBy: { createdAt: "desc" }, take, skip }),
      prisma.quote.count({ where }),
    ]);

    res.json({ quotes: toApiNumbers(quotes), total, page: Number(page), pageSize: take });
  } catch (err) {
    next(err);
  }
});

router.get("/:id", async (req: AuthedRequest, res, next) => {
  try {
    const quote = await prisma.quote.findFirst({
      where: { id: req.params.id, organizationId: req.organizationId },
      include: INCLUDE,
    });
    if (!quote) return res.status(404).json({ error: "Quote not found" });
    res.json(toApiNumbers(await expireIfNeeded(quote)));
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

const quoteSchema = z.object({
  customerId: z.string().min(1),
  issueDate: z.string().optional(),
  expiryDate: z.string().optional(),
  currency: z.string().default("USD"),
  poNumber: z.string().optional(),
  notes: z.string().optional(),
  terms: z.string().optional(),
  invoiceDiscountType: z.enum(["FLAT", "PERCENT"]).default("FLAT"),
  invoiceDiscountValue: z.number().min(0).default(0),
  items: z.array(lineItemSchema).min(1),
});

router.post("/", async (req: AuthedRequest, res, next) => {
  try {
    const parsed = quoteSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
    }
    const data = parsed.data;

    const customer = await prisma.customer.findFirst({
      where: { id: data.customerId, organizationId: req.organizationId },
    });
    if (!customer) return res.status(404).json({ error: "Customer not found" });

    const totals = computeInvoiceTotals(data.items, {
      type: data.invoiceDiscountType,
      value: data.invoiceDiscountValue,
    });

    const quote = await prisma.$transaction(async (tx) => {
      const number = await nextQuoteNumber(tx, req.organizationId as string);
      return tx.quote.create({
        data: {
          organizationId: req.organizationId as string,
          customerId: data.customerId,
          number,
          issueDate: data.issueDate ? new Date(data.issueDate) : new Date(),
          expiryDate: data.expiryDate ? new Date(data.expiryDate) : null,
          currency: data.currency,
          poNumber: data.poNumber,
          notes: data.notes,
          terms: data.terms,
          subtotal: totals.subtotal,
          discount: totals.discount,
          invoiceDiscountType: data.invoiceDiscountType,
          invoiceDiscountValue: data.invoiceDiscountValue,
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

    res.status(201).json(toApiNumbers(quote));
  } catch (err) {
    next(err);
  }
});

router.put("/:id", async (req: AuthedRequest, res, next) => {
  try {
    const existing = await prisma.quote.findFirst({
      where: { id: req.params.id, organizationId: req.organizationId },
    });
    if (!existing) return res.status(404).json({ error: "Quote not found" });
    if (["ACCEPTED", "REJECTED", "CONVERTED"].includes(existing.status)) {
      return res.status(400).json({ error: `Cannot edit a ${existing.status.toLowerCase()} quote` });
    }

    const parsed = quoteSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
    }
    const data = parsed.data;

    const customer = await prisma.customer.findFirst({
      where: { id: data.customerId, organizationId: req.organizationId },
    });
    if (!customer) return res.status(404).json({ error: "Customer not found" });

    const totals = computeInvoiceTotals(data.items, {
      type: data.invoiceDiscountType,
      value: data.invoiceDiscountValue,
    });

    const quote = await prisma.$transaction(async (tx) => {
      await tx.quoteItem.deleteMany({ where: { quoteId: existing.id } });
      return tx.quote.update({
        where: { id: existing.id },
        data: {
          customerId: data.customerId,
          issueDate: data.issueDate ? new Date(data.issueDate) : existing.issueDate,
          expiryDate: data.expiryDate ? new Date(data.expiryDate) : null,
          currency: data.currency,
          poNumber: data.poNumber,
          notes: data.notes,
          terms: data.terms,
          subtotal: totals.subtotal,
          discount: totals.discount,
          invoiceDiscountType: data.invoiceDiscountType,
          invoiceDiscountValue: data.invoiceDiscountValue,
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

    res.json(toApiNumbers(quote));
  } catch (err) {
    next(err);
  }
});

router.delete("/:id", async (req: AuthedRequest, res, next) => {
  try {
    const existing = await prisma.quote.findFirst({
      where: { id: req.params.id, organizationId: req.organizationId },
    });
    if (!existing) return res.status(404).json({ error: "Quote not found" });
    if (existing.status !== "DRAFT") {
      return res.status(400).json({ error: "Only draft quotes can be deleted." });
    }

    await prisma.quote.delete({ where: { id: existing.id } });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

router.post("/:id/duplicate", async (req: AuthedRequest, res, next) => {
  try {
    const existing = await prisma.quote.findFirst({
      where: { id: req.params.id, organizationId: req.organizationId },
      include: { items: true },
    });
    if (!existing) return res.status(404).json({ error: "Quote not found" });

    const duplicate = await prisma.$transaction(async (tx) => {
      const number = await nextQuoteNumber(tx, req.organizationId as string);
      return tx.quote.create({
        data: {
          organizationId: req.organizationId as string,
          customerId: existing.customerId,
          number,
          expiryDate: existing.expiryDate,
          currency: existing.currency,
          poNumber: existing.poNumber,
          notes: existing.notes,
          terms: existing.terms,
          subtotal: existing.subtotal,
          discount: existing.discount,
          invoiceDiscountType: existing.invoiceDiscountType,
          invoiceDiscountValue: existing.invoiceDiscountValue,
          taxTotal: existing.taxTotal,
          total: existing.total,
          items: {
            create: existing.items.map((item) => ({
              description: item.description,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              taxRate: item.taxRate,
              discount: item.discount,
              total: item.total,
              sortOrder: item.sortOrder,
            })),
          },
        },
        include: INCLUDE,
      });
    });

    res.status(201).json(toApiNumbers(duplicate));
  } catch (err) {
    next(err);
  }
});

router.post("/:id/send", async (req: AuthedRequest, res, next) => {
  try {
    const existing = await prisma.quote.findFirst({
      where: { id: req.params.id, organizationId: req.organizationId },
      include: PUBLIC_INCLUDE,
    });
    if (!existing) return res.status(404).json({ error: "Quote not found" });
    if (existing.status !== "DRAFT" && existing.status !== "EXPIRED") {
      return res.status(400).json({ error: "Only draft or expired quotes can be sent" });
    }
    if (!existing.customer.email) {
      return res.status(400).json({ error: "This customer has no email address on file" });
    }

    try {
      const numericExisting = toApiNumbers(existing);
      const pdf = await renderDocumentPdfToBuffer({
        ...numericExisting,
        status: "SENT",
        kind: "QUOTE",
        dueDate: existing.expiryDate,
        dueDateLabel: "VALID UNTIL",
        amountPaid: 0,
      });
      const { subject, html } = quoteEmail(existing.organization, numericExisting, existing.customer);
      await sendEmail({
        to: existing.customer.email,
        subject,
        html,
        attachments: [{ filename: `quote-${existing.number}.pdf`, content: pdf }],
      });
    } catch (err: any) {
      return res.status(502).json({ error: err.message || "Failed to send quote email" });
    }

    const quote = await prisma.quote.update({ where: { id: existing.id }, data: { status: "SENT" } });
    res.json(toApiNumbers(quote));
  } catch (err) {
    next(err);
  }
});

const statusSchema = z.object({ status: z.enum(STATUS_VALUES) });

router.patch("/:id/status", async (req: AuthedRequest, res, next) => {
  try {
    const parsed = statusSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Invalid status" });
    if (parsed.data.status === "CONVERTED") {
      return res.status(400).json({ error: "Use the convert action to mark a quote as converted." });
    }

    const existing = await prisma.quote.findFirst({
      where: { id: req.params.id, organizationId: req.organizationId },
    });
    if (!existing) return res.status(404).json({ error: "Quote not found" });
    if (existing.status === "CONVERTED") {
      return res.status(400).json({ error: "Cannot change the status of a converted quote" });
    }

    const respondedNow = parsed.data.status === "ACCEPTED" || parsed.data.status === "REJECTED";
    const quote = await prisma.quote.update({
      where: { id: existing.id },
      data: {
        status: parsed.data.status,
        respondedAt: respondedNow ? new Date() : existing.respondedAt,
      },
    });
    res.json(toApiNumbers(quote));
  } catch (err) {
    next(err);
  }
});

router.post("/:id/convert", async (req: AuthedRequest, res, next) => {
  try {
    const existing = await prisma.quote.findFirst({
      where: { id: req.params.id, organizationId: req.organizationId },
      include: { items: true },
    });
    if (!existing) return res.status(404).json({ error: "Quote not found" });
    if (existing.status === "CONVERTED") {
      return res.status(400).json({ error: "This quote has already been converted" });
    }

    try {
      await assertInvoiceQuotaAvailable(req.organizationId as string);
    } catch (err) {
      if (err instanceof QuotaExceededError) return res.status(402).json({ error: err.message });
      return next(err);
    }

    const result = await prisma.$transaction(async (tx) => {
      const number = await nextInvoiceNumber(tx, req.organizationId as string);
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 14);

      const invoice = await tx.invoice.create({
        data: {
          organizationId: req.organizationId as string,
          customerId: existing.customerId,
          number,
          dueDate,
          currency: existing.currency,
          status: "DRAFT",
          poNumber: existing.poNumber,
          notes: existing.notes,
          terms: existing.terms,
          subtotal: existing.subtotal,
          discount: existing.discount,
          invoiceDiscountType: existing.invoiceDiscountType,
          invoiceDiscountValue: existing.invoiceDiscountValue,
          taxTotal: existing.taxTotal,
          total: existing.total,
          items: {
            create: existing.items.map((item, index) => ({
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
        include: INVOICE_INCLUDE,
      });

      const quote = await tx.quote.update({
        where: { id: existing.id },
        data: { status: "CONVERTED", convertedInvoiceId: invoice.id },
        include: INCLUDE,
      });

      return { quote, invoice };
    });

    res.status(201).json(toApiNumbers(result));
  } catch (err) {
    next(err);
  }
});

router.get("/:id/pdf", async (req: AuthedRequest, res) => {
  try {
    const quote = await prisma.quote.findFirst({
      where: { id: req.params.id, organizationId: req.organizationId },
      include: PUBLIC_INCLUDE,
    });
    if (!quote) return res.status(404).json({ error: "Quote not found" });

    const buffer = await renderDocumentPdfToBuffer({
      ...toApiNumbers(quote),
      kind: "QUOTE",
      dueDate: quote.expiryDate,
      dueDateLabel: "VALID UNTIL",
      amountPaid: 0,
    });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="quote-${quote.number}.pdf"`);
    res.send(buffer);
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to generate PDF" });
  }
});

// Unauthenticated routes for the client-facing shareable quote link.
publicRouter.get("/:token", async (req, res, next) => {
  try {
    let quote = await prisma.quote.findUnique({
      where: { publicToken: req.params.token },
      include: PUBLIC_INCLUDE,
    });
    if (!quote) return res.status(404).json({ error: "Quote not found" });

    quote = await expireIfNeeded(quote);

    if (!quote.viewedAt && (quote.status === "DRAFT" || quote.status === "SENT")) {
      await prisma.quote.update({
        where: { id: quote.id },
        data: { viewedAt: new Date(), status: quote.status === "SENT" ? "VIEWED" : quote.status },
      });
      quote.viewedAt = new Date();
      if (quote.status === "SENT") quote.status = "VIEWED";
    }

    res.json(toApiNumbers(quote));
  } catch (err) {
    next(err);
  }
});

publicRouter.get("/:token/pdf", async (req, res) => {
  try {
    let quote = await prisma.quote.findUnique({
      where: { publicToken: req.params.token },
      include: PUBLIC_INCLUDE,
    });
    if (!quote) return res.status(404).json({ error: "Quote not found" });
    quote = await expireIfNeeded(quote);

    const buffer = await renderDocumentPdfToBuffer({
      ...toApiNumbers(quote),
      kind: "QUOTE",
      dueDate: quote.expiryDate,
      dueDateLabel: "VALID UNTIL",
      amountPaid: 0,
    });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="quote-${quote.number}.pdf"`);
    res.send(buffer);
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to generate PDF" });
  }
});

const respondSchema = z.object({ decision: z.enum(["ACCEPT", "REJECT"]) });

publicRouter.post("/:token/respond", async (req, res, next) => {
  try {
    const parsed = respondSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Invalid response" });

    let quote = await prisma.quote.findUnique({ where: { publicToken: req.params.token } });
    if (!quote) return res.status(404).json({ error: "Quote not found" });

    quote = await expireIfNeeded(quote);

    if (quote.status !== "SENT" && quote.status !== "VIEWED") {
      return res.status(400).json({ error: "This quote is no longer available to respond to." });
    }

    const updated = await prisma.quote.update({
      where: { id: quote.id },
      data: {
        status: parsed.data.decision === "ACCEPT" ? "ACCEPTED" : "REJECTED",
        respondedAt: new Date(),
      },
      include: PUBLIC_INCLUDE,
    });

    res.json(toApiNumbers(updated));
  } catch (err) {
    next(err);
  }
});

export default router;
export { publicRouter };
