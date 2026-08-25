import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/db.js";
import { requireAuth, requireOrgMember, type AuthedRequest } from "../../middleware/auth.js";
import { computeInvoiceTotals } from "../invoices/invoice-math.js";
import { nextCreditNoteNumber } from "./credit-note-number.js";
import { renderDocumentPdfToBuffer } from "../invoices/renderInvoicePdf.js";
import { sendEmail } from "../../lib/email.js";
import { creditNoteEmail } from "../email/templates.js";
import { toApiNumbers } from "../../lib/serialize.js";

const router = Router();

const STATUS_VALUES = ["DRAFT", "ISSUED", "VOID"] as const;
const INCLUDE = {
  customer: true,
  items: { orderBy: { sortOrder: "asc" as const } },
  invoice: { select: { id: true, number: true } },
};

router.use(requireAuth, requireOrgMember);

router.get("/", async (req: AuthedRequest, res, next) => {
  try {
    const { status, customerId } = req.query as Record<string, string>;
    const where: any = { organizationId: req.organizationId };
    if (status && STATUS_VALUES.includes(status as any)) where.status = status;
    if (customerId) where.customerId = customerId;

    const creditNotes = await prisma.creditNote.findMany({
      where,
      include: INCLUDE,
      orderBy: { createdAt: "desc" },
    });

    res.json({ creditNotes: toApiNumbers(creditNotes) });
  } catch (err) {
    next(err);
  }
});

router.get("/:id", async (req: AuthedRequest, res, next) => {
  try {
    const creditNote = await prisma.creditNote.findFirst({
      where: { id: req.params.id, organizationId: req.organizationId },
      include: INCLUDE,
    });
    if (!creditNote) return res.status(404).json({ error: "Credit note not found" });
    res.json(toApiNumbers(creditNote));
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

const creditNoteSchema = z.object({
  customerId: z.string().min(1),
  invoiceId: z.string().optional(),
  currency: z.string().default("USD"),
  reason: z.string().optional(),
  notes: z.string().optional(),
  items: z.array(lineItemSchema).min(1),
});

router.post("/", async (req: AuthedRequest, res, next) => {
  try {
    const parsed = creditNoteSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
    }
    const data = parsed.data;

    const customer = await prisma.customer.findFirst({
      where: { id: data.customerId, organizationId: req.organizationId },
    });
    if (!customer) return res.status(404).json({ error: "Customer not found" });

    if (data.invoiceId) {
      const invoice = await prisma.invoice.findFirst({
        where: { id: data.invoiceId, organizationId: req.organizationId },
      });
      if (!invoice) return res.status(404).json({ error: "Invoice not found" });
    }

    const totals = computeInvoiceTotals(data.items);

    const creditNote = await prisma.$transaction(async (tx) => {
      const number = await nextCreditNoteNumber(tx, req.organizationId as string);
      return tx.creditNote.create({
        data: {
          organizationId: req.organizationId as string,
          customerId: data.customerId,
          invoiceId: data.invoiceId,
          number,
          currency: data.currency,
          reason: data.reason,
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

    res.status(201).json(toApiNumbers(creditNote));
  } catch (err) {
    next(err);
  }
});

router.put("/:id", async (req: AuthedRequest, res, next) => {
  try {
    const existing = await prisma.creditNote.findFirst({
      where: { id: req.params.id, organizationId: req.organizationId },
    });
    if (!existing) return res.status(404).json({ error: "Credit note not found" });
    if (existing.status !== "DRAFT") {
      return res.status(400).json({ error: "Only draft credit notes can be edited" });
    }

    const parsed = creditNoteSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
    }
    const data = parsed.data;

    const customer = await prisma.customer.findFirst({
      where: { id: data.customerId, organizationId: req.organizationId },
    });
    if (!customer) return res.status(404).json({ error: "Customer not found" });

    const totals = computeInvoiceTotals(data.items);

    const creditNote = await prisma.$transaction(async (tx) => {
      await tx.creditNoteItem.deleteMany({ where: { creditNoteId: existing.id } });
      return tx.creditNote.update({
        where: { id: existing.id },
        data: {
          customerId: data.customerId,
          invoiceId: data.invoiceId,
          currency: data.currency,
          reason: data.reason,
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

    res.json(toApiNumbers(creditNote));
  } catch (err) {
    next(err);
  }
});

router.delete("/:id", async (req: AuthedRequest, res, next) => {
  try {
    const existing = await prisma.creditNote.findFirst({
      where: { id: req.params.id, organizationId: req.organizationId },
    });
    if (!existing) return res.status(404).json({ error: "Credit note not found" });
    if (existing.status !== "DRAFT") {
      return res.status(400).json({ error: "Only draft credit notes can be deleted. Void it instead." });
    }

    await prisma.creditNote.delete({ where: { id: existing.id } });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

router.post("/:id/issue", async (req: AuthedRequest, res, next) => {
  try {
    const existing = await prisma.creditNote.findFirst({
      where: { id: req.params.id, organizationId: req.organizationId },
      include: {
        customer: true,
        items: { orderBy: { sortOrder: "asc" } },
        organization: {
          select: { name: true, logoUrl: true, brandColor: true, address: true, phone: true, email: true, pdfTemplate: true },
        },
      },
    });
    if (!existing) return res.status(404).json({ error: "Credit note not found" });
    if (existing.status !== "DRAFT") {
      return res.status(400).json({ error: "Only draft credit notes can be issued" });
    }
    if (!existing.customer.email) {
      return res.status(400).json({ error: "This customer has no email address on file" });
    }

    try {
      const numericExisting = toApiNumbers(existing);
      const pdf = await renderDocumentPdfToBuffer({
        ...numericExisting,
        kind: "CREDIT NOTE",
        status: "ISSUED",
        dueDate: null,
        amountPaid: 0,
      });
      const { subject, html } = creditNoteEmail(existing.organization, numericExisting, existing.customer);
      await sendEmail({
        to: existing.customer.email,
        subject,
        html,
        attachments: [{ filename: `credit-note-${existing.number}.pdf`, content: pdf }],
      });
    } catch (err: any) {
      return res.status(502).json({ error: err.message || "Failed to send credit note email" });
    }

    const creditNote = await prisma.creditNote.update({
      where: { id: existing.id },
      data: { status: "ISSUED", issueDate: new Date() },
      include: INCLUDE,
    });
    res.json(toApiNumbers(creditNote));
  } catch (err) {
    next(err);
  }
});

router.post("/:id/void", async (req: AuthedRequest, res, next) => {
  try {
    const existing = await prisma.creditNote.findFirst({
      where: { id: req.params.id, organizationId: req.organizationId },
    });
    if (!existing) return res.status(404).json({ error: "Credit note not found" });
    if (existing.status !== "ISSUED") {
      return res.status(400).json({ error: "Only issued credit notes can be voided" });
    }

    const creditNote = await prisma.creditNote.update({
      where: { id: existing.id },
      data: { status: "VOID" },
      include: INCLUDE,
    });
    res.json(toApiNumbers(creditNote));
  } catch (err) {
    next(err);
  }
});

router.get("/:id/pdf", async (req: AuthedRequest, res) => {
  try {
    const creditNote = await prisma.creditNote.findFirst({
      where: { id: req.params.id, organizationId: req.organizationId },
      include: {
        customer: true,
        items: { orderBy: { sortOrder: "asc" } },
        organization: {
          select: { name: true, logoUrl: true, brandColor: true, address: true, phone: true, email: true, pdfTemplate: true },
        },
      },
    });
    if (!creditNote) return res.status(404).json({ error: "Credit note not found" });

    const buffer = await renderDocumentPdfToBuffer({
      ...toApiNumbers(creditNote),
      kind: "CREDIT NOTE",
      dueDate: null,
      amountPaid: 0,
    });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="credit-note-${creditNote.number}.pdf"`);
    res.send(buffer);
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to generate PDF" });
  }
});

export default router;
