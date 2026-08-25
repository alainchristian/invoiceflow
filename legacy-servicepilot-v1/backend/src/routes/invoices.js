import { Router } from "express";
import { prisma } from "../db.js";
import { requireAuth } from "../middleware/auth.js";
import { renderInvoicePdfToBuffer } from "../renderInvoicePdf.js";

const router = Router();
const publicRouter = Router();

const VALID_STATUSES = ["draft", "sent", "paid", "overdue"];
const INCLUDE = { client: true, items: true };
const PUBLIC_INCLUDE = {
  client: true,
  items: true,
  owner: {
    select: { businessName: true, logoUrl: true, brandColor: true, address: true, phone: true, name: true, email: true },
  },
};

function computeAmount(items, discount, taxRate) {
  const subtotal = items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  const taxed = (subtotal - discount) * (1 + taxRate / 100);
  return Math.round(taxed * 100) / 100;
}

router.use(requireAuth);

router.get("/", async (req, res, next) => {
  try {
    const invoices = await prisma.invoice.findMany({
      where: { ownerId: req.userId },
      include: INCLUDE,
      orderBy: { createdAt: "desc" },
    });
    res.json(invoices);
  } catch (err) {
    next(err);
  }
});

router.get("/:id", async (req, res, next) => {
  try {
    const invoice = await prisma.invoice.findFirst({
      where: { id: req.params.id, ownerId: req.userId },
      include: INCLUDE,
    });
    if (!invoice) return res.status(404).json({ error: "Invoice not found" });
    res.json(invoice);
  } catch (err) {
    next(err);
  }
});

router.post("/", async (req, res, next) => {
  try {
    const { clientId, number, dueDate, items, taxRate, discount, notes } = req.body;
    if (!clientId || !number || !dueDate || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        error: "clientId, number, dueDate, and at least one item are required",
      });
    }

    const client = await prisma.client.findFirst({
      where: { id: clientId, ownerId: req.userId },
    });
    if (!client) return res.status(404).json({ error: "Client not found" });

    const finalTaxRate = taxRate ?? 0;
    const finalDiscount = discount ?? 0;
    const amount = computeAmount(items, finalDiscount, finalTaxRate);

    const invoice = await prisma.invoice.create({
      data: {
        clientId,
        ownerId: req.userId,
        number,
        dueDate: new Date(dueDate),
        amount,
        taxRate: finalTaxRate,
        discount: finalDiscount,
        notes: notes || null,
        items: {
          create: items.map((item) => ({
            description: item.description,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
          })),
        },
      },
      include: INCLUDE,
    });
    res.status(201).json(invoice);
  } catch (err) {
    next(err);
  }
});

router.patch("/:id/status", async (req, res, next) => {
  try {
    const { status } = req.body;
    if (!VALID_STATUSES.includes(status)) {
      return res.status(400).json({ error: `status must be one of ${VALID_STATUSES.join(", ")}` });
    }

    const existing = await prisma.invoice.findFirst({
      where: { id: req.params.id, ownerId: req.userId },
    });
    if (!existing) return res.status(404).json({ error: "Invoice not found" });

    const invoice = await prisma.invoice.update({
      where: { id: req.params.id },
      data: {
        status,
        paidAt: status === "paid" ? new Date() : existing.paidAt,
      },
    });
    res.json(invoice);
  } catch (err) {
    next(err);
  }
});

router.post("/:id/create-payment-intent", async (req, res, next) => {
  try {
    const invoice = await prisma.invoice.findFirst({
      where: { id: req.params.id, ownerId: req.userId },
    });
    if (!invoice) return res.status(404).json({ error: "Invoice not found" });

    const stripeKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeKey || stripeKey === "sk_test_placeholder") {
      return res.status(200).json({
        simulated: true,
        clientSecret: "pi_simulated_client_secret",
        amount: invoice.amount,
        message: "Add a real STRIPE_SECRET_KEY to .env to create live PaymentIntents.",
      });
    }

    const { default: Stripe } = await import("stripe");
    const stripe = new Stripe(stripeKey);

    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(invoice.amount * 100),
      currency: "usd",
      metadata: { invoiceId: invoice.id },
    });

    await prisma.invoice.update({
      where: { id: invoice.id },
      data: { stripePaymentIntentId: paymentIntent.id },
    });

    res.json({
      simulated: false,
      clientSecret: paymentIntent.client_secret,
      amount: invoice.amount,
    });
  } catch (err) {
    next(err);
  }
});

router.get("/:id/pdf", async (req, res, next) => {
  try {
    const invoice = await prisma.invoice.findFirst({
      where: { id: req.params.id, ownerId: req.userId },
      include: PUBLIC_INCLUDE,
    });
    if (!invoice) return res.status(404).json({ error: "Invoice not found" });
    const buffer = await renderInvoicePdfToBuffer(invoice);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="invoice-${invoice.number}.pdf"`);
    res.send(buffer);
  } catch (err) {
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
    res.json(invoice);
  } catch (err) {
    next(err);
  }
});

publicRouter.get("/:token/pdf", async (req, res, next) => {
  try {
    const invoice = await prisma.invoice.findUnique({
      where: { publicToken: req.params.token },
      include: PUBLIC_INCLUDE,
    });
    if (!invoice) return res.status(404).json({ error: "Invoice not found" });
    const buffer = await renderInvoicePdfToBuffer(invoice);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="invoice-${invoice.number}.pdf"`);
    res.send(buffer);
  } catch (err) {
    res.status(500).json({ error: err.message || "Failed to generate PDF" });
  }
});

export default router;
export { publicRouter };
