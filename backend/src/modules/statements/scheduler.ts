import { prisma } from "../../lib/db.js";
import { round2 } from "../invoices/invoice-math.js";
import { renderDocumentPdfToBuffer } from "../invoices/renderInvoicePdf.js";
import { sendEmail } from "../../lib/email.js";
import { statementEmail } from "../email/templates.js";

const POLL_INTERVAL_MS = 60 * 60 * 1000; // hourly, matches the other schedulers

interface OpenInvoiceRow {
  id: string;
  number: string;
  currency: string;
  total: number;
  amountPaid: number;
  dueDate: Date;
  customerId: string;
  customer: { id: string; name: string; email: string | null };
}

interface OrgBranding {
  name: string;
  logoUrl: string | null;
  brandColor: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
}

function buildStatementDocument(org: OrgBranding, customer: { name: string; email: string | null }, currency: string, invoices: OpenInvoiceRow[]) {
  const items = invoices.map((inv) => {
    const balance = round2(inv.total - inv.amountPaid);
    return {
      description: `Invoice ${inv.number} — due ${new Date(inv.dueDate).toLocaleDateString()}`,
      quantity: 1,
      unitPrice: balance,
      taxRate: 0,
      discount: 0,
      total: balance,
    };
  });
  const total = round2(items.reduce((sum, i) => sum + i.total, 0));

  return {
    kind: "STATEMENT" as const,
    number: new Date().toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }),
    status: "",
    issueDate: new Date(),
    dueDate: null,
    subtotal: total,
    discount: 0,
    taxTotal: 0,
    total,
    amountPaid: 0,
    notes: null,
    terms: null,
    items,
    customer,
    organization: org,
  };
}

// Sends one statement email per (customer, currency) pair -- a customer with open
// invoices in more than one currency gets a separate statement per currency rather
// than a single total that blindly sums mismatched currencies together.
async function sendStatementsForOrganization(
  org: { id: string; statementRecipients: "ALL" | "OVERDUE_ONLY" } & OrgBranding,
  now: Date
): Promise<number> {
  // "Open" here means actually sent to the customer and still outstanding --
  // DRAFT invoices haven't been sent yet, so they must never appear on a
  // customer-facing statement even though they're technically unpaid.
  const openInvoices = await prisma.invoice.findMany({
    where: { organizationId: org.id, status: { in: ["SENT", "VIEWED", "OVERDUE"] } },
    select: {
      id: true,
      number: true,
      currency: true,
      total: true,
      amountPaid: true,
      dueDate: true,
      customerId: true,
      customer: { select: { id: true, name: true, email: true } },
    },
  });

  const byCustomer = new Map<string, OpenInvoiceRow[]>();
  for (const inv of openInvoices) {
    const list = byCustomer.get(inv.customerId) ?? [];
    list.push(inv);
    byCustomer.set(inv.customerId, list);
  }

  let sentCount = 0;
  for (const invoices of byCustomer.values()) {
    const customer = invoices[0].customer;
    if (!customer.email) continue;

    const hasOverdue = invoices.some((inv) => inv.dueDate < now);
    if (org.statementRecipients === "OVERDUE_ONLY" && !hasOverdue) continue;

    const byCurrency = new Map<string, OpenInvoiceRow[]>();
    for (const inv of invoices) {
      const list = byCurrency.get(inv.currency) ?? [];
      list.push(inv);
      byCurrency.set(inv.currency, list);
    }

    for (const [currency, currencyInvoices] of byCurrency) {
      const document = buildStatementDocument(org, customer, currency, currencyInvoices);
      try {
        const pdf = await renderDocumentPdfToBuffer(document);
        const { subject, html } = statementEmail(
          org,
          { totalDue: document.total, currency, openInvoiceCount: currencyInvoices.length },
          customer
        );
        await sendEmail({
          to: customer.email,
          subject,
          html,
          attachments: [{ filename: `statement-${document.number.replace(/[,\s]/g, "-")}.pdf`, content: pdf }],
        });
        sentCount += 1;
      } catch (err) {
        console.error(`[statements] failed to send statement to customer ${customer.id} for org ${org.id}`, err);
      }
    }
  }

  return sentCount;
}

export async function runDueStatements(now: Date = new Date()) {
  const dueOrgs = await prisma.organization.findMany({
    where: { statementsEnabled: true, nextStatementRunAt: { lte: now } },
    select: {
      id: true,
      name: true,
      logoUrl: true,
      brandColor: true,
      address: true,
      phone: true,
      email: true,
      statementRecipients: true,
      statementFrequencyDays: true,
    },
  });

  for (const org of dueOrgs) {
    const sentCount = await sendStatementsForOrganization(org, now);
    const next = new Date(now);
    next.setDate(next.getDate() + org.statementFrequencyDays);
    await prisma.organization.update({ where: { id: org.id }, data: { nextStatementRunAt: next } });
    console.log(`[statements] sent ${sentCount} statement(s) for organization ${org.id}`);
  }
}

export function startStatementScheduler() {
  runDueStatements().catch((err) => console.error("[statements] boot run failed", err));
  setInterval(() => {
    runDueStatements().catch((err) => console.error("[statements] scheduled run failed", err));
  }, POLL_INTERVAL_MS);
}
