import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type Stripe from "stripe";
import { prisma } from "../lib/db.js";
import { handleCheckoutSessionCompleted } from "../modules/payments/stripe-webhook.routes.js";

function buildCheckoutSessionCompletedEvent(opts: {
  invoiceId: string;
  paymentIntentId: string;
  amountTotalCents: number;
}): Stripe.Event {
  return {
    id: `evt_test_${Math.random().toString(36).slice(2)}`,
    type: "checkout.session.completed",
    data: {
      object: {
        metadata: { invoiceId: opts.invoiceId },
        payment_intent: opts.paymentIntentId,
        payment_status: "paid",
        amount_total: opts.amountTotalCents,
        currency: "usd",
      },
    },
  } as unknown as Stripe.Event;
}

describe("Stripe webhook idempotency", () => {
  let org: { id: string };
  let customer: { id: string };
  let invoice: { id: string };
  const paymentIntentId = `pi_test_${Date.now()}`;

  beforeAll(async () => {
    org = await prisma.organization.create({
      data: { name: "Webhook Test Org", slug: `webhook-test-org-${Date.now()}` },
    });
    customer = await prisma.customer.create({ data: { name: "Webhook Customer", organizationId: org.id } });
    invoice = await prisma.invoice.create({
      data: {
        organizationId: org.id,
        customerId: customer.id,
        number: "TEST-WH-0001",
        dueDate: new Date(),
        subtotal: 100,
        total: 100,
        status: "SENT",
      },
    });
  });

  afterAll(async () => {
    await prisma.payment.deleteMany({ where: { invoiceId: invoice.id } });
    await prisma.invoice.deleteMany({ where: { organizationId: org.id } });
    await prisma.customer.deleteMany({ where: { organizationId: org.id } });
    await prisma.organization.deleteMany({ where: { id: org.id } });
  });

  it("replaying the identical event twice creates exactly one Payment and credits the invoice once", async () => {
    const event = buildCheckoutSessionCompletedEvent({
      invoiceId: invoice.id,
      paymentIntentId,
      amountTotalCents: 10000, // $100.00
    });

    await handleCheckoutSessionCompleted(event);
    await handleCheckoutSessionCompleted(event); // replay -- must not throw or double-credit

    const payments = await prisma.payment.findMany({ where: { providerRef: paymentIntentId } });
    expect(payments).toHaveLength(1);
    expect(payments[0].amount.toNumber()).toBe(100);

    const updated = await prisma.invoice.findUniqueOrThrow({ where: { id: invoice.id } });
    expect(updated.amountPaid.toNumber()).toBe(100);
    expect(updated.status).toBe("PAID");
  });
});
