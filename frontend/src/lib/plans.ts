// Keep in sync with backend/src/modules/billing/plans.ts -- same three tiers, same copy.
export type PlanId = "STARTER" | "PROFESSIONAL" | "BUSINESS";

export interface PlanDefinition {
  id: PlanId;
  name: string;
  priceMonthly: number;
  description: string;
  features: string[];
  invoiceCapPerMonth: number | null;
  seatCap: number | null;
  recurringInvoicesAllowed: boolean;
}

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
  },
};

export const PLAN_ORDER: PlanId[] = ["STARTER", "PROFESSIONAL", "BUSINESS"];

export function planRank(id: PlanId): number {
  return PLAN_ORDER.indexOf(id);
}
