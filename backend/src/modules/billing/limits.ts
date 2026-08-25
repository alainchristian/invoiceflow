import { prisma } from "../../lib/db.js";
import { PLANS } from "./plans.js";

export class QuotaExceededError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "QuotaExceededError";
  }
}

function startOfCurrentMonth(): Date {
  const d = new Date();
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d;
}

// Throws QuotaExceededError if the org's plan doesn't allow creating another invoice
// this calendar month. No-ops for unlimited plans (Professional/Business).
export async function assertInvoiceQuotaAvailable(organizationId: string): Promise<void> {
  const org = await prisma.organization.findUniqueOrThrow({
    where: { id: organizationId },
    select: { plan: true },
  });
  const cap = PLANS[org.plan].invoiceCapPerMonth;
  if (cap === null) return;

  const count = await prisma.invoice.count({
    where: { organizationId, createdAt: { gte: startOfCurrentMonth() } },
  });
  if (count >= cap) {
    throw new QuotaExceededError(
      `You've reached the ${PLANS[org.plan].name} plan's limit of ${cap} invoices this month. Upgrade for unlimited invoices.`
    );
  }
}

// Boolean variant for callers that can't/shouldn't throw (the recurring-invoice scheduler).
export async function hasInvoiceQuotaAvailable(organizationId: string): Promise<boolean> {
  try {
    await assertInvoiceQuotaAvailable(organizationId);
    return true;
  } catch {
    return false;
  }
}

// Throws QuotaExceededError if the org's plan doesn't allow creating recurring
// invoice schedules at all. Does not affect schedules already created before a
// downgrade -- the scheduler keeps running them, capped by the invoice quota above.
export async function assertRecurringInvoicesAllowed(organizationId: string): Promise<void> {
  const org = await prisma.organization.findUniqueOrThrow({
    where: { id: organizationId },
    select: { plan: true },
  });
  if (!PLANS[org.plan].recurringInvoicesAllowed) {
    throw new QuotaExceededError(
      "Recurring invoices are a Professional plan feature. Upgrade to automate your billing."
    );
  }
}

export async function assertSeatAvailable(organizationId: string): Promise<void> {
  const org = await prisma.organization.findUniqueOrThrow({
    where: { id: organizationId },
    select: { plan: true },
  });
  const cap = PLANS[org.plan].seatCap;
  if (cap === null) return;

  const count = await prisma.organizationMember.count({ where: { organizationId } });
  if (count >= cap) {
    throw new QuotaExceededError(
      `You've reached the ${PLANS[org.plan].name} plan's limit of ${cap} team member${cap === 1 ? "" : "s"}. Upgrade to add more.`
    );
  }
}
