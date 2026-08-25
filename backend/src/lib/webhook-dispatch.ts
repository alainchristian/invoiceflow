import crypto from "node:crypto";
import { prisma } from "./db.js";

const DELIVERY_TIMEOUT_MS = 5000;

// Fire-and-forget: looks up this org's active endpoints subscribed to
// `event`, POSTs the payload to each with an HMAC-SHA256 signature header
// mirroring Stripe's own convention (t=<timestamp>,v1=<hmac>) so
// integrators can reuse existing Stripe-webhook verification code. Never
// awaited by the caller -- delivery failures are logged, not surfaced,
// so a slow/dead customer endpoint can never block the request that
// triggered the event.
export async function dispatchWebhook(organizationId: string, event: string, payload: unknown): Promise<void> {
  const endpoints = await prisma.webhookEndpoint.findMany({
    where: { organizationId, active: true, subscribedEvents: { has: event } },
  });
  if (endpoints.length === 0) return;

  const timestamp = Math.floor(Date.now() / 1000);
  const body = JSON.stringify({ event, timestamp, payload });

  await Promise.all(
    endpoints.map(async (endpoint) => {
      const signature = crypto.createHmac("sha256", endpoint.secret).update(`${timestamp}.${body}`).digest("hex");
      try {
        const res = await fetch(endpoint.url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-InvoiceFlow-Signature": `t=${timestamp},v1=${signature}`,
          },
          body,
          signal: AbortSignal.timeout(DELIVERY_TIMEOUT_MS),
        });
        if (!res.ok) {
          console.error(`[webhooks] delivery to ${endpoint.url} for event ${event} returned ${res.status}`);
        }
      } catch (err) {
        console.error(`[webhooks] delivery to ${endpoint.url} for event ${event} failed`, err);
      }
    })
  );
}
