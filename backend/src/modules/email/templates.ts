interface OrgBranding {
  name: string;
  brandColor?: string | null;
}

interface CustomerLike {
  name: string;
  email?: string | null;
}

interface EmailResult {
  subject: string;
  html: string;
}

function money(amount: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(amount);
}

function frontendUrl() {
  return process.env.FRONTEND_URL || "http://localhost:5173";
}

// Minimal, dependency-free HTML layout -- no templating engine needed for four
// short transactional emails. Inline styles only, for email-client compatibility.
function layout(org: OrgBranding, bodyHtml: string): string {
  const color = org.brandColor || "#4f46e5";
  return `<!doctype html>
<html>
  <body style="margin:0;padding:24px;background:#f4f5f7;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1f2430;">
    <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:10px;overflow:hidden;border:1px solid #e5e7eb;">
      <div style="background:${color};padding:20px 28px;">
        <span style="color:#ffffff;font-size:18px;font-weight:600;">${org.name}</span>
      </div>
      <div style="padding:28px;font-size:15px;line-height:1.55;">${bodyHtml}</div>
    </div>
  </body>
</html>`;
}

function payButton(url: string, color: string, label: string): string {
  return `<p style="margin:24px 0;"><a href="${url}" style="display:inline-block;background:${color};color:#ffffff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600;">${label}</a></p>`;
}

export function invoiceEmail(
  org: OrgBranding,
  invoice: { number: string; total: number; amountPaid: number; currency: string; dueDate: Date | string | null; publicToken: string },
  customer: CustomerLike
): EmailResult {
  const balanceDue = invoice.total - invoice.amountPaid;
  const payUrl = `${frontendUrl()}/i/${invoice.publicToken}`;
  const dueLine = invoice.dueDate
    ? `, due ${new Date(invoice.dueDate).toLocaleDateString()}`
    : "";
  const body = `
    <p>Hi ${customer.name},</p>
    <p>${org.name} has sent you invoice <strong>#${invoice.number}</strong> for <strong>${money(balanceDue, invoice.currency)}</strong>${dueLine}.</p>
    ${payButton(payUrl, org.brandColor || "#4f46e5", "View & Pay Invoice")}
    <p style="color:#6b7280;font-size:13px;">The invoice is also attached to this email as a PDF.</p>
  `;
  return { subject: `Invoice #${invoice.number} from ${org.name}`, html: layout(org, body) };
}

// Sent by a platform admin to a tenant's owner (e.g. a billing notice or support
// follow-up) -- reuses the same layout as every other transactional email, just
// with ServicePilot itself as the "org" so the header reads as a platform message.
export function platformMessageEmail(recipientName: string, subject: string, message: string): EmailResult {
  const body = `
    <p>Hi ${recipientName},</p>
    <p>${message.replace(/\n/g, "<br/>")}</p>
  `;
  return { subject, html: layout({ name: "InvoiceFlow", brandColor: "#4f46e5" }, body) };
}

export function quoteEmail(
  org: OrgBranding,
  quote: { number: string; total: number; currency: string; expiryDate: Date | string | null; publicToken: string },
  customer: CustomerLike
): EmailResult {
  const viewUrl = `${frontendUrl()}/q/${quote.publicToken}`;
  const expiryLine = quote.expiryDate
    ? `, valid until ${new Date(quote.expiryDate).toLocaleDateString()}`
    : "";
  const body = `
    <p>Hi ${customer.name},</p>
    <p>${org.name} has sent you quote <strong>#${quote.number}</strong> for <strong>${money(quote.total, quote.currency)}</strong>${expiryLine}.</p>
    ${payButton(viewUrl, org.brandColor || "#4f46e5", "View Quote")}
    <p style="color:#6b7280;font-size:13px;">The quote is also attached to this email as a PDF.</p>
  `;
  return { subject: `Quote #${quote.number} from ${org.name}`, html: layout(org, body) };
}

export function paymentReminderEmail(
  org: OrgBranding,
  invoice: { number: string; total: number; amountPaid: number; currency: string; dueDate: Date | string | null; publicToken: string },
  customer: CustomerLike
): EmailResult {
  const balanceDue = invoice.total - invoice.amountPaid;
  const payUrl = `${frontendUrl()}/i/${invoice.publicToken}`;
  const isOverdue = !!invoice.dueDate && new Date(invoice.dueDate) < new Date();
  const dueLine = invoice.dueDate
    ? isOverdue
      ? `was due ${new Date(invoice.dueDate).toLocaleDateString()} and is now overdue`
      : `is due ${new Date(invoice.dueDate).toLocaleDateString()}`
    : "is outstanding";
  const body = `
    <p>Hi ${customer.name},</p>
    <p>This is a friendly reminder that invoice <strong>#${invoice.number}</strong> for <strong>${money(balanceDue, invoice.currency)}</strong> ${dueLine}.</p>
    ${payButton(payUrl, org.brandColor || "#4f46e5", "Pay Now")}
  `;
  return {
    subject: isOverdue ? `Overdue: Invoice #${invoice.number} from ${org.name}` : `Reminder: Invoice #${invoice.number} from ${org.name}`,
    html: layout(org, body),
  };
}

export function creditNoteEmail(
  org: OrgBranding,
  creditNote: { number: string; total: number; currency: string; reason?: string | null },
  customer: CustomerLike
): EmailResult {
  const body = `
    <p>Hi ${customer.name},</p>
    <p>${org.name} has issued you credit note <strong>#${creditNote.number}</strong> for <strong>${money(creditNote.total, creditNote.currency)}</strong>${creditNote.reason ? ` — ${creditNote.reason}` : ""}.</p>
    <p style="color:#6b7280;font-size:13px;">The credit note is attached to this email as a PDF for your records.</p>
  `;
  return { subject: `Credit Note #${creditNote.number} from ${org.name}`, html: layout(org, body) };
}

export function statementEmail(
  org: OrgBranding,
  statement: { totalDue: number; currency: string; openInvoiceCount: number },
  customer: CustomerLike
): EmailResult {
  const body = `
    <p>Hi ${customer.name},</p>
    <p>Here's your account statement from ${org.name}: <strong>${money(statement.totalDue, statement.currency)}</strong> outstanding across ${statement.openInvoiceCount} open invoice${statement.openInvoiceCount === 1 ? "" : "s"}.</p>
    <p style="color:#6b7280;font-size:13px;">The full statement is attached to this email as a PDF.</p>
  `;
  return { subject: `Account statement from ${org.name}`, html: layout(org, body) };
}

export function paymentReceiptEmail(
  org: OrgBranding,
  invoice: { number: string; total: number; amountPaid: number; currency: string; publicToken: string },
  customer: CustomerLike,
  amountJustPaid: number
): EmailResult {
  const viewUrl = `${frontendUrl()}/i/${invoice.publicToken}`;
  const remaining = invoice.total - invoice.amountPaid;
  const body = `
    <p>Hi ${customer.name},</p>
    <p>We've received your payment of <strong>${money(amountJustPaid, invoice.currency)}</strong> for invoice <strong>#${invoice.number}</strong>. Thank you!</p>
    ${remaining > 0 ? `<p>Remaining balance: <strong>${money(remaining, invoice.currency)}</strong>.</p>` : `<p>This invoice is now paid in full.</p>`}
    ${payButton(viewUrl, org.brandColor || "#4f46e5", "View Invoice")}
  `;
  return { subject: `Payment received for Invoice #${invoice.number}`, html: layout(org, body) };
}
