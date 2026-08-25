import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/db.js";
import { stripe } from "../../lib/stripe.js";
import { requireAuth, requireOrgMember, requireRole, type AuthedRequest } from "../../middleware/auth.js";
import { PLANS, planRank, getStripePriceId } from "./plans.js";

const router = Router();

router.use(requireAuth, requireOrgMember);

function startOfCurrentMonth(): Date {
  const d = new Date();
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d;
}

// View-only, no requireRole gate: every member already sees Billing settings in the
// sidebar, and the payload has nothing sensitive -- the usage numbers are exactly
// what a non-owner needs to understand why an action just got a 402.
router.get("/", async (req: AuthedRequest, res, next) => {
  try {
    const organization = await prisma.organization.findUniqueOrThrow({ where: { id: req.organizationId } });
    const def = PLANS[organization.plan];

    const [invoicesThisMonth, seatsUsed] = await Promise.all([
      prisma.invoice.count({
        where: { organizationId: req.organizationId, createdAt: { gte: startOfCurrentMonth() } },
      }),
      prisma.organizationMember.count({ where: { organizationId: req.organizationId } }),
    ]);

    res.json({
      plan: organization.plan,
      subscriptionStatus: organization.subscriptionStatus,
      currentPeriodEnd: organization.currentPeriodEnd,
      hasStripeCustomer: !!organization.stripeCustomerId,
      hasActiveSubscription: !!organization.stripeSubscriptionId,
      usage: {
        invoicesThisMonth,
        invoiceCap: def.invoiceCapPerMonth,
        seatsUsed,
        seatCap: def.seatCap,
      },
    });
  } catch (err) {
    next(err);
  }
});

const checkoutSchema = z.object({ plan: z.enum(["PROFESSIONAL", "BUSINESS"]) });

router.post("/checkout", requireRole("OWNER", "ADMIN"), async (req: AuthedRequest, res, next) => {
  try {
    const parsed = checkoutSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "A valid plan is required" });

    const organization = await prisma.organization.findUniqueOrThrow({ where: { id: req.organizationId } });

    if (planRank(parsed.data.plan) <= planRank(organization.plan)) {
      return res.status(400).json({ error: "You're already on this plan or higher." });
    }
    if (organization.stripeSubscriptionId) {
      return res
        .status(400)
        .json({ error: "You already have an active subscription. Use Manage Subscription to change plans." });
    }

    let customerId = organization.stripeCustomerId;
    if (!customerId) {
      const owner = await prisma.organizationMember.findFirst({
        where: { organizationId: organization.id, role: "OWNER" },
        include: { user: true },
        orderBy: { createdAt: "asc" },
      });
      const customer = await stripe.customers.create({
        email: owner?.user.email,
        name: organization.name,
        metadata: { organizationId: organization.id },
      });
      customerId = customer.id;
      await prisma.organization.update({ where: { id: organization.id }, data: { stripeCustomerId: customerId } });
    }

    const priceId = getStripePriceId(parsed.data.plan);
    if (!priceId) return res.status(500).json({ error: "This plan isn't configured yet. Contact support." });

    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      metadata: { organizationId: organization.id, plan: parsed.data.plan },
      subscription_data: { metadata: { organizationId: organization.id, plan: parsed.data.plan } },
      success_url: `${frontendUrl}/app/settings/billing?upgrade=success`,
      cancel_url: `${frontendUrl}/app/settings/billing?upgrade=cancelled`,
    });

    res.json({ url: session.url });
  } catch (err) {
    next(err);
  }
});

router.post("/portal", requireRole("OWNER", "ADMIN"), async (req: AuthedRequest, res, next) => {
  try {
    const organization = await prisma.organization.findUniqueOrThrow({ where: { id: req.organizationId } });
    if (!organization.stripeCustomerId) {
      return res.status(400).json({ error: "You haven't subscribed to a paid plan yet." });
    }

    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
    const session = await stripe.billingPortal.sessions.create({
      customer: organization.stripeCustomerId,
      return_url: `${frontendUrl}/app/settings/billing`,
    });

    res.json({ url: session.url });
  } catch (err) {
    next(err);
  }
});

export default router;
