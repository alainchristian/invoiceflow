import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/db.js";
import { stripe } from "../../lib/stripe.js";
import { requireAuth, requireOrgMember, requireRole, type AuthedRequest } from "../../middleware/auth.js";
import { computeInvoiceTotals, round2 } from "./invoice-math.js";
import { nextInvoiceNumber } from "./invoice-number.js";
import { renderDocumentPdfToBuffer } from "./renderInvoicePdf.js";
import { toStripeAmount } from "./currency.js";
import { createInvoiceReminderNotifications } from "../reminders/notify.js";
import { assertInvoiceQuotaAvailable, QuotaExceededError } from "../billing/limits.js";
import { sendEmail } from "../../lib/email.js";
import { invoiceEmail, paymentReminderEmail } from "../email/templates.js";

const router = Router();
const publicRouter = Router();

const STATUS_VALUES = ["DRAFT", "SENT", "VIEWED", "PAID", "OVERDUE", "CANCELLED"] as const;
const INCLUDE = { customer: true, items: { orderBy: { sortOrder: "asc" as const } }, payments: true };
const PUBLIC_INCLUDE = {
  customer: true,
  items: { orderBy: { sortOrder: "asc" as const } },
  organization: {
    select: { name: true, logoUrl: true, brandColor: true, address: true, phone: true, email: true },
  },
};

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

    const [invoices, total] = await Promise.all([
      prisma.invoice.findMany({ where, include: INCLUDE, orderBy: { createdAt: "desc" }, take, skip }),
      prisma.invoice.count({ where }),
    ]);

    res.json({ invoices, total, page: Number(page), pageSize: take });
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
    res.json(invoice);
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

const invoiceSchema = z.object({
  customerId: z.string().min(1),
  issueDate: z.string().optional(),
  dueDate: z.string().min(1),
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
    const parsed = invoiceSchema.safeParse(req.body);
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

    const totals = computeInvoiceTotals(data.items, {
      type: data.invoiceDiscountType,
      value: data.invoiceDiscountValue,
    });

    const invoice = await prisma.$transaction(async (tx) => {
      const number = await nextInvoiceNumber(tx, req.organizationId as string);
      return tx.invoice.create({
        data: {
          organizationId: req.organizationId as string,
          customerId: data.customerId,
          number,
          issueDate: data.issueDate ? new Date(data.issueDate) : new Date(),
          dueDate: new Date(data.dueDate),
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

    res.status(201).json(invoice);
  } catch (err) {
    next(err);
  }
});

router.put("/:id", async (req: AuthedRequest, res, next) => {
  try {
    const existing = await prisma.invoice.findFirst({
      where: { id: req.params.id, organizationId: req.organizationId },
    });
    if (!existing) return res.status(404).json({ error: "Invoice not found" });
    if (existing.status === "PAID" || existing.status === "CANCELLED") {
      return res.status(400).json({ error: `Cannot edit a ${existing.status.toLowerCase()} invoice` });
    }

    const parsed = invoiceSchema.safeParse(req.body);
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

    const invoice = await prisma.$transaction(async (tx) => {
      await tx.invoiceItem.deleteMany({ where: { invoiceId: existing.id } });
      return tx.invoice.update({
        where: { id: existing.id },
        data: {
          customerId: data.customerId,
          issueDate: data.issueDate ? new Date(data.issueDate) : existing.issueDate,
          dueDate: new Date(data.dueDate),
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

    res.json(invoice);
  } catch (err) {
    next(err);
  }
});

router.delete("/:id", async (req: AuthedRequest, res, next) => {
  try {
    const existing = await prisma.invoice.findFirst({
      where: { id: req.params.id, organizationId: req.organizationId },
    });
    if (!existing) return res.status(404).json({ error: "Invoice not found" });
    if (existing.status !== "DRAFT") {
      return res.status(400).json({ error: "Only draft invoices can be deleted. Cancel it instead." });
    }

    await prisma.invoice.delete({ where: { id: existing.id } });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

router.post("/:id/duplicate", async (req: AuthedRequest, res, next) => {
  try {
    const existing = await prisma.invoice.findFirst({
      where: { id: req.params.id, organizationId: req.organizationId },
      include: { items: true },
    });
    if (!existing) return res.status(404).json({ error: "Invoice not found" });

    const duplicate = await prisma.$transaction(async (tx) => {
      const number = await nextInvoiceNumber(tx, req.organizationId as string);
      return tx.invoice.create({
        data: {
          organizationId: req.organizationId as string,
          customerId: existing.customerId,
          number,
          dueDate: existing.dueDate,
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

    res.status(201).json(duplicate);
  } catch (err) {
    next(err);
  }
});

router.post("/:id/send", async (req: AuthedRequest, res, next) => {
  try {
    const existing = await prisma.invoice.findFirst({
      where: { id: req.params.id, organizationId: req.organizationId },
      include: PUBLIC_INCLUDE,
    });
    if (!existing) return res.status(404).json({ error: "Invoice not found" });
    if (existing.status !== "DRAFT") {
      return res.status(400).json({ error: "Only draft invoices can be sent" });
    }
    if (!existing.customer.email) {
      return res.status(400).json({ error: "This customer has no email address on file" });
    }

    try {
      const pdf = await renderDocumentPdfToBuffer({ ...existing, status: "SENT" });
      const { subject, html } = invoiceEmail(existing.organization, existing, existing.customer);
      await sendEmail({
        to: existing.customer.email,
        subject,
        html,
        attachments: [{ filename: `invoice-${existing.number}.pdf`, content: pdf }],
      });
    } catch (err: any) {
      return res.status(502).json({ error: err.message || "Failed to send invoice email" });
    }

    const invoice = await prisma.invoice.update({ where: { id: existing.id }, data: { status: "SENT" } });
    res.json(invoice);
  } catch (err) {
    next(err);
  }
});

router.post("/:id/remind", async (req: AuthedRequest, res, next) => {
  try {
    const existing = await prisma.invoice.findFirst({
      where: { id: req.params.id, organizationId: req.organizationId },
      include: PUBLIC_INCLUDE,
    });
    if (!existing) return res.status(404).json({ error: "Invoice not found" });
    if (existing.status === "DRAFT" || existing.status === "PAID" || existing.status === "CANCELLED") {
      return res.status(400).json({ error: "Reminders can only be sent for outstanding invoices that have been sent" });
    }

    // The customer-facing reminder email is best-effort: the internal team
    // notification below is the pre-existing behavior this route always had,
    // and a broken/unconfigured email provider shouldn't block it.
    let emailSent = false;
    if (existing.customer.email) {
      try {
        const { subject, html } = paymentReminderEmail(existing.organization, existing, existing.customer);
        await sendEmail({ to: existing.customer.email, subject, html });
        emailSent = true;
      } catch (err) {
        console.error("[invoices] failed to send reminder email", err);
      }
    }

    const now = new Date();
    const notifiedCount = await prisma.$transaction(async (tx) => {
      await tx.invoice.update({ where: { id: existing.id }, data: { lastReminderSentAt: now } });
      return createInvoiceReminderNotifications(tx, existing, now);
    });

    res.json({ invoice: { ...existing, lastReminderSentAt: now }, notifiedCount, emailSent });
  } catch (err) {
    next(err);
  }
});

const statusSchema = z.object({ status: z.enum(STATUS_VALUES) });

router.patch("/:id/status", async (req: AuthedRequest, res, next) => {
  try {
    const parsed = statusSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Invalid status" });

    const existing = await prisma.invoice.findFirst({
      where: { id: req.params.id, organizationId: req.organizationId },
    });
    if (!existing) return res.status(404).json({ error: "Invoice not found" });

    const invoice = await prisma.invoice.update({
      where: { id: existing.id },
      data: {
        status: parsed.data.status,
        paidAt: parsed.data.status === "PAID" ? new Date() : existing.paidAt,
        amountPaid: parsed.data.status === "PAID" ? existing.total : existing.amountPaid,
      },
    });
    res.json(invoice);
  } catch (err) {
    next(err);
  }
});

const paymentSchema = z.object({
  amount: z.number().positive(),
  method: z.enum(["BANK_TRANSFER", "CASH", "CARD", "MOBILE_MONEY", "OTHER"]).default("OTHER"),
  paidAt: z.string().optional(),
  notes: z.string().optional(),
});

router.post("/:id/payments", async (req: AuthedRequest, res, next) => {
  try {
    const parsed = paymentSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "A positive amount is required" });

    const existing = await prisma.invoice.findFirst({
      where: { id: req.params.id, organizationId: req.organizationId },
    });
    if (!existing) return res.status(404).json({ error: "Invoice not found" });

    const newAmountPaid = existing.amountPaid + parsed.data.amount;
    const [payment, invoice] = await prisma.$transaction([
      prisma.payment.create({
        data: {
          invoiceId: existing.id,
          amount: parsed.data.amount,
          method: parsed.data.method,
          paidAt: parsed.data.paidAt ? new Date(parsed.data.paidAt) : new Date(),
          notes: parsed.data.notes,
        },
      }),
      prisma.invoice.update({
        where: { id: existing.id },
        data: {
          amountPaid: newAmountPaid,
          status: newAmountPaid >= existing.total ? "PAID" : existing.status,
          paidAt: newAmountPaid >= existing.total ? new Date() : existing.paidAt,
        },
        include: INCLUDE,
      }),
    ]);

    res.status(201).json({ payment, invoice });
  } catch (err) {
    next(err);
  }
});

const refundSchema = z.object({
  amount: z.number().positive(),
  reason: z.string().optional(),
});

router.post("/:id/refunds", async (req: AuthedRequest, res, next) => {
  try {
    const parsed = refundSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "A positive amount is required" });

    const existing = await prisma.invoice.findFirst({
      where: { id: req.params.id, organizationId: req.organizationId },
      include: { payments: { where: { type: "PAYMENT" } } },
    });
    if (!existing) return res.status(404).json({ error: "Invoice not found" });

    const amount = round2(parsed.data.amount);
    if (amount > existing.amountPaid) {
      return res.status(400).json({ error: "Refund amount cannot exceed the amount paid." });
    }

    // Best-effort: if a single Stripe-paid payment on this invoice covers the
    // refund amount, actually refund the card via Stripe. Otherwise this is a
    // manual/ledger-only adjustment (cash/bank-transfer refunds, or an amount
    // that doesn't map cleanly onto one original charge).
    const stripePayment = existing.payments.find(
      (p) => p.provider === "stripe" && p.providerRef && p.amount >= amount
    );
    let stripeRefundId: string | undefined;
    if (stripePayment?.providerRef) {
      try {
        const refund = await stripe.refunds.create({
          payment_intent: stripePayment.providerRef,
          amount: toStripeAmount(amount, existing.currency),
        });
        stripeRefundId = refund.id;
      } catch (err: any) {
        return res.status(502).json({ error: err.message || "Stripe refund failed" });
      }
    }

    const now = new Date();
    const newAmountPaid = round2(existing.amountPaid - amount);
    const stillFullyPaid = newAmountPaid >= existing.total;
    const newStatus =
      existing.status === "PAID" && !stillFullyPaid ? (existing.dueDate < now ? "OVERDUE" : "SENT") : existing.status;

    const [refundPayment, invoice] = await prisma.$transaction([
      prisma.payment.create({
        data: {
          invoiceId: existing.id,
          amount,
          type: "REFUND",
          method: stripePayment ? "CARD" : "OTHER",
          provider: stripeRefundId ? "stripe" : undefined,
          providerRef: stripeRefundId,
          notes: parsed.data.reason,
        },
      }),
      prisma.invoice.update({
        where: { id: existing.id },
        data: {
          amountPaid: newAmountPaid,
          status: newStatus,
          paidAt: stillFullyPaid ? existing.paidAt : null,
        },
        include: INCLUDE,
      }),
    ]);

    res.status(201).json({ payment: refundPayment, invoice });
  } catch (err) {
    next(err);
  }
});

router.get("/:id/pdf", async (req: AuthedRequest, res) => {
  try {
    const invoice = await prisma.invoice.findFirst({
      where: { id: req.params.id, organizationId: req.organizationId },
      include: PUBLIC_INCLUDE,
    });
    if (!invoice) return res.status(404).json({ error: "Invoice not found" });

    const buffer = await renderDocumentPdfToBuffer(invoice);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="invoice-${invoice.number}.pdf"`);
    res.send(buffer);
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to generate PDF" });
  }
});

// Unauthenticated routes for the client-facing shareable invoice link.
publicRouter.get("/:token", async (req, res, next) => {
  try {
    const invoice = await prisma.invoice.findUnique({
      where: { publicToken: req.params.token },
      include: PUBLIC_INCLUDE,
    });
    if (!invoice) return res.status(404).json({ error: "Invoice not found" });

    if (!invoice.viewedAt && (invoice.status === "DRAFT" || invoice.status === "SENT")) {
      await prisma.invoice.update({
        where: { id: invoice.id },
        data: { viewedAt: new Date(), status: invoice.status === "SENT" ? "VIEWED" : invoice.status },
      });
      invoice.viewedAt = new Date();
      if (invoice.status === "SENT") invoice.status = "VIEWED";
    }

    res.json(invoice);
  } catch (err) {
    next(err);
  }
});

publicRouter.get("/:token/pdf", async (req, res) => {
  try {
    const invoice = await prisma.invoice.findUnique({
      where: { publicToken: req.params.token },
      include: PUBLIC_INCLUDE,
    });
    if (!invoice) return res.status(404).json({ error: "Invoice not found" });

    const buffer = await renderDocumentPdfToBuffer(invoice);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="invoice-${invoice.number}.pdf"`);
    res.send(buffer);
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to generate PDF" });
  }
});

publicRouter.post("/:token/checkout", async (req, res, next) => {
  try {
    const invoice = await prisma.invoice.findUnique({
      where: { publicToken: req.params.token },
      include: PUBLIC_INCLUDE,
    });
    if (!invoice) return res.status(404).json({ error: "Invoice not found" });

    if (invoice.status === "PAID") {
      return res.status(400).json({ error: "This invoice has already been paid." });
    }
    if (invoice.status === "CANCELLED") {
      return res.status(400).json({ error: "This invoice has been cancelled." });
    }

    const balanceDue = round2(invoice.total - invoice.amountPaid);
    if (balanceDue <= 0) {
      return res.status(400).json({ error: "There is no outstanding balance on this invoice." });
    }

    const requestedAmountRaw = req.body?.amount;
    const amountProvided = typeof requestedAmountRaw === "number" && Number.isFinite(requestedAmountRaw);
    if (amountProvided && requestedAmountRaw <= 0) {
      return res.status(400).json({ error: "Enter an amount between $0.01 and the balance due." });
    }
    const isPartial = amountProvided;
    const amount = isPartial ? round2(requestedAmountRaw) : balanceDue;
    if (amount > balanceDue) {
      return res.status(400).json({ error: "Enter an amount between $0.01 and the balance due." });
    }

    // Only reuse a cached session for a repeat "pay in full" click -- a
    // customer-chosen partial amount always gets its own fresh session so we
    // never hand back a session for the wrong amount.
    if (!isPartial && invoice.stripeCheckoutSessionId) {
      const existing = await stripe.checkout.sessions
        .retrieve(invoice.stripeCheckoutSessionId)
        .catch(() => null);
      if (existing && existing.status === "open" && existing.url) {
        return res.json({ url: existing.url });
      }
    }

    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
    const productName = isPartial
      ? `Invoice ${invoice.number} — ${invoice.organization.name} (partial payment)`
      : `Invoice ${invoice.number} — ${invoice.organization.name}`;
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      customer_email: invoice.customer.email || undefined,
      line_items: [
        {
          price_data: {
            currency: invoice.currency.toLowerCase(),
            unit_amount: toStripeAmount(amount, invoice.currency),
            product_data: { name: productName },
          },
          quantity: 1,
        },
      ],
      metadata: { invoiceId: invoice.id, publicToken: invoice.publicToken },
      success_url: `${frontendUrl}/i/${invoice.publicToken}?payment=success`,
      cancel_url: `${frontendUrl}/i/${invoice.publicToken}?payment=cancelled`,
    });

    // Never cache a partial-amount session for reuse -- only a "pay in full" session
    // is safe to hand back to a later request, so leave the cached id untouched
    // (or cleared) when this was a partial payment.
    if (!isPartial) {
      await prisma.invoice.update({
        where: { id: invoice.id },
        data: { stripeCheckoutSessionId: session.id },
      });
    }

    res.json({ url: session.url });
  } catch (err) {
    next(err);
  }
});

export default router;
export { publicRouter };
