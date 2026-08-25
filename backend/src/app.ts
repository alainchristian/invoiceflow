import express from "express";
import cors from "cors";

import authRoutes from "./modules/auth/auth.routes.js";
import organizationsRoutes from "./modules/organizations/organizations.routes.js";
import customersRoutes from "./modules/customers/customers.routes.js";
import productsRoutes from "./modules/products/products.routes.js";
import invoicesRoutes, { publicRouter as publicInvoicesRoutes } from "./modules/invoices/invoices.routes.js";
import dashboardRoutes from "./modules/dashboard/dashboard.routes.js";
import paymentsRoutes from "./modules/payments/payments.routes.js";
import stripeWebhookRoutes from "./modules/payments/stripe-webhook.routes.js";
import quotesRoutes, { publicRouter as publicQuotesRoutes } from "./modules/quotes/quotes.routes.js";
import recurringInvoicesRoutes from "./modules/recurring-invoices/recurring-invoices.routes.js";
import notificationsRoutes from "./modules/notifications/notifications.routes.js";
import remindersRoutes from "./modules/reminders/reminders.routes.js";
import billingRoutes from "./modules/billing/billing.routes.js";
import creditNotesRoutes from "./modules/credit-notes/credit-notes.routes.js";
import adminRoutes from "./modules/admin/admin.routes.js";

// Builds the Express app without starting it listening or starting the
// background schedulers -- lets tests (supertest) exercise real routes/
// middleware without a live server or running cron jobs. index.ts is the
// only place that calls .listen() and starts the schedulers.
export function createApp() {
  const app = express();

  // Needed so req.ip reflects the real client (not the proxy) once deployed
  // behind a load balancer/reverse proxy -- used for admin audit-log IP capture.
  app.set("trust proxy", 1);

  app.use(cors());

  // Mounted before express.json() so Stripe's raw request body is preserved for signature verification.
  app.use("/api/webhooks/stripe", stripeWebhookRoutes);

  app.use(express.json({ limit: "2mb" })); // logo data URLs can be a few hundred KB

  app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  app.use("/api/auth", authRoutes);
  app.use("/api/organizations", organizationsRoutes);
  app.use("/api/customers", customersRoutes);
  app.use("/api/products", productsRoutes);
  app.use("/api/invoices", invoicesRoutes);
  app.use("/api/dashboard", dashboardRoutes);
  app.use("/api/payments", paymentsRoutes);
  app.use("/api/public/invoices", publicInvoicesRoutes);
  app.use("/api/quotes", quotesRoutes);
  app.use("/api/recurring-invoices", recurringInvoicesRoutes);
  app.use("/api/public/quotes", publicQuotesRoutes);
  app.use("/api/notifications", notificationsRoutes);
  app.use("/api/reminders", remindersRoutes);
  app.use("/api/billing", billingRoutes);
  app.use("/api/credit-notes", creditNotesRoutes);
  app.use("/api/admin", adminRoutes);

  app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  });

  return app;
}
