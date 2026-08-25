import Stripe from "stripe";

export const stripe: Stripe | null = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: "2024-06-20" })
  : null;

// Thrown by requireStripe() when STRIPE_SECRET_KEY isn't configured -- route
// handlers catch this specifically and respond 503 rather than letting it
// fall through to the generic 500 handler (see sendStripeNotConfigured).
export class StripeNotConfiguredError extends Error {
  constructor() {
    super("Stripe is not configured");
    this.name = "StripeNotConfiguredError";
  }
}

export function requireStripe(): Stripe {
  if (!stripe) throw new StripeNotConfiguredError();
  return stripe;
}

export function sendStripeNotConfigured(res: { status: (code: number) => { json: (body: unknown) => void } }) {
  res.status(503).json({ error: "Payments aren't configured yet. Contact support." });
}
