// Stripe's documented zero-decimal currencies -- amounts for these must NOT be multiplied by 100.
export const ZERO_DECIMAL = new Set([
  "BIF", "CLP", "DJF", "GNF", "ISK", "HUF", "JPY", "KMF", "KRW", "MGA",
  "PYG", "RWF", "TWD", "UGX", "VND", "VUV", "XAF", "XOF", "XPF",
]);

export function toStripeAmount(dollars: number, currency: string): number {
  const minor = ZERO_DECIMAL.has(currency.toUpperCase()) ? dollars : dollars * 100;
  return Math.round(minor);
}
