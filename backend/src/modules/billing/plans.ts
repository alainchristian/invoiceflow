export type PlanId = "STARTER" | "PROFESSIONAL" | "BUSINESS";

export interface PlanDefinition {
  id: PlanId;
  name: string;
  priceMonthly: number; // USD; 0 for Starter
  description: string;
  features: string[];
  invoiceCapPerMonth: number | null; // null = unlimited
  seatCap: number | null; // null = unlimited
  recurringInvoicesAllowed: boolean;
  stripePriceEnvVar: "STRIPE_PRICE_PROFESSIONAL" | "STRIPE_PRICE_BUSINESS" | null;
}

// Mirrored in frontend/src/lib/plans.ts for UI display (marketing page + billing
// settings) -- browser code can't import this file, so keep both copies' plan
// name/price/description/features/caps identical. This file is authoritative for
// enforcement (invoiceCapPerMonth, seatCap) and Stripe Price mapping.
export const PLANS: Record<PlanId, PlanDefinition> = {
  STARTER: {
    id: "STARTER",
    name: "Starter",
    priceMonthly: 0,
    description: "For freelancers just getting started.",
    features: ["5 invoices per month", "1 user", "Basic templates"],
    invoiceCapPerMonth: 5,
    seatCap: 1,
    recurringInvoicesAllowed: false,
    stripePriceEnvVar: null,
  },
  PROFESSIONAL: {
    id: "PROFESSIONAL",
    name: "Professional",
    priceMonthly: 15,
    description: "For growing businesses.",
    features: ["Unlimited invoices", "Recurring invoices", "Advanced analytics", "Multiple users"],
    invoiceCapPerMonth: null,
    seatCap: null,
    recurringInvoicesAllowed: true,
    stripePriceEnvVar: "STRIPE_PRICE_PROFESSIONAL",
  },
  BUSINESS: {
    id: "BUSINESS",
    name: "Business",
    priceMonthly: 29,
    description: "For larger teams.",
    features: ["Everything in Professional", "Team collaboration", "Advanced permissions", "Priority support"],
    invoiceCapPerMonth: null,
    seatCap: null,
    recurringInvoicesAllowed: true,
    stripePriceEnvVar: "STRIPE_PRICE_BUSINESS",
  },
};

export const PLAN_ORDER: PlanId[] = ["STARTER", "PROFESSIONAL", "BUSINESS"];

export function planRank(id: PlanId): number {
  return PLAN_ORDER.indexOf(id);
}

export function getStripePriceId(planId: PlanId): string | null {
  const envVar = PLANS[planId].stripePriceEnvVar;
  return envVar ? process.env[envVar] || null : null;
}

// Maps a Stripe Price ID (from a webhook payload) back to our internal Plan.
export function planForStripePriceId(priceId: string): PlanId | null {
  for (const def of Object.values(PLANS)) {
    if (def.stripePriceEnvVar && process.env[def.stripePriceEnvVar] === priceId) return def.id;
  }
  return null;
}
