import express, { Router } from "express";
import type Stripe from "stripe";
import { Prisma } from "@prisma/client";
import { prisma } from "../../lib/db.js";
import { requireStripe, StripeNotConfiguredError, sendStripeNotConfigured } from "../../lib/stripe.js";
import { round2 } from "../invoices/invoice-math.js";
import { ZERO_DECIMAL } from "../invoices/currency.js";
import { planForStripePriceId } from "../billing/plans.js";
import { sendEmail } from "../../lib/email.js";
import { paymentReceiptEmail } from "../email/templates.js";
import { toApiNumbers } from "../../lib/serialize.js";

const router = Router();

// Extracted from the route handler so tests can exercise the business logic
// directly with a hand-built event, without needing a real Stripe signature.
export async function handleCheckoutSessionCompleted(event: Stripe.Event): Promise<void> {
  const session = event.data.object as Stripe.Checkout.Session;
  const invoiceId = session.metadata?.invoiceId;
  const paymentIntentId =
    typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id;

  if (!(invoiceId && paymentIntentId && session.payment_status === "paid")) return;

  const already = await prisma.payment.findUnique({ where: { providerRef: paymentIntentId } });
  if (already) return;

  const invoice = await prisma.invoice.findUnique({ where: { id: invoiceId } });
  if (!invoice || invoice.status === "PAID" || invoice.status === "CANCELLED") return;

  const currency = session.currency?.toUpperCase() || "USD";
  const amount = round2((session.amount_total ?? 0) / (ZERO_DECIMAL.has(currency) ? 1 : 100));
  const newAmountPaid = round2(invoice.amountPaid.plus(amount));

  let updatedInvoice;
  try {
    [, updatedInvoice] = await prisma.$transaction([
      prisma.payment.create({
        data: {
          invoiceId: invoice.id,
          amount,
          method: "CARD",
          provider: "stripe",
          providerRef: paymentIntentId,
          paidAt: new Date(),
        },
      }),
      prisma.invoice.update({
        where: { id: invoice.id },
        data: {
          amountPaid: newAmountPaid,
          status: newAmountPaid.greaterThanOrEqualTo(invoice.total) ? "PAID" : invoice.status,
          paidAt: newAmountPaid.greaterThanOrEqualTo(invoice.total) ? new Date() : invoice.paidAt,
          stripeCheckoutSessionId: null,
        },
        include: {
          customer: true,
          organization: { select: { name: true, brandColor: true } },
        },
      }),
    ]);
  } catch (err) {
    // A concurrent delivery of the same event can race past the findUnique
    // check above; Payment.providerRef is @unique, so the loser hits P2002.
    // Treat that as "already processed" rather than crashing -- this is what
    // makes replay of the same event idempotent even under a race, not just
    // sequentially.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") return;
    throw err;
  }

  if (updatedInvoice.customer.email) {
    const { subject, html } = paymentReceiptEmail(
      updatedInvoice.organization,
      toApiNumbers(updatedInvoice),
      updatedInvoice.customer,
      amount.toNumber()
    );
    await sendEmail({ to: updatedInvoice.customer.email, subject, html }).catch((err) =>
      console.error("[stripe-webhook] failed to send payment receipt email", err)
    );
  }
}

router.post("/", express.raw({ type: "application/json" }), async (req, res) => {
  const signature = req.headers["stripe-signature"];
  let event: Stripe.Event;
  try {
    event = requireStripe().webhooks.constructEvent(
      req.body,
      signature as string,
      process.env.STRIPE_WEBHOOK_SECRET as string
    );
  } catch (err: any) {
    if (err instanceof StripeNotConfiguredError) return sendStripeNotConfigured(res);
    console.error("Stripe webhook signature verification failed:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === "checkout.session.completed") {
    await handleCheckoutSessionCompleted(event);
  } else if (event.type === "checkout.session.expired") {
    const session = event.data.object as Stripe.Checkout.Session;
    const invoiceId = session.metadata?.invoiceId;
    if (invoiceId) {
      await prisma.invoice
        .updateMany({
          where: { id: invoiceId, stripeCheckoutSessionId: session.id },
          data: { stripeCheckoutSessionId: null },
        })
        .catch(() => {});
    }
  } else if (event.type === "customer.subscription.created" || event.type === "customer.subscription.updated") {
    // Subscription billing (ServicePilot charging its own tenants) -- unrelated to the
    // invoice-payment handling above. subscription.metadata is set via
    // subscription_data.metadata at Checkout-creation time in billing.routes.ts.
    const subscription = event.data.object as Stripe.Subscription;
    const organizationId = subscription.metadata?.organizationId;
    if (organizationId) {
      const priceId = subscription.items.data[0]?.price.id;
      const planId = priceId ? planForStripePriceId(priceId) : null;
      await prisma.organization
        .update({
          where: { id: organizationId },
          data: {
            stripeSubscriptionId: subscription.id,
            subscriptionStatus: subscription.status,
            currentPeriodEnd: new Date(subscription.current_period_end * 1000),
            ...(planId ? { plan: planId } : {}),
          },
        })
        .catch((err) => console.error("[stripe-webhook] failed to sync subscription", err));
    }
  } else if (event.type === "customer.subscription.deleted") {
    const subscription = event.data.object as Stripe.Subscription;
    const organizationId = subscription.metadata?.organizationId;
    if (organizationId) {
      // Only revert if this deleted subscription is still the one on file for the org --
      // an org can briefly have a stale/superseded subscription canceled (e.g. a duplicate
      // from a race, or a Portal plan-switch that cancels+recreates) whose deletion must not
      // clobber a different, still-active subscription's state.
      await prisma.organization
        .updateMany({
          where: { id: organizationId, stripeSubscriptionId: subscription.id },
          data: { plan: "STARTER", subscriptionStatus: "canceled", stripeSubscriptionId: null },
        })
        .catch((err) => console.error("[stripe-webhook] failed to revert subscription", err));
    }
  }

  res.json({ received: true });
});

export default router;
