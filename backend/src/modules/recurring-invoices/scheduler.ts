import type { Prisma, RecurringFrequency } from "@prisma/client";
import { prisma } from "../../lib/db.js";
import { computeInvoiceTotals } from "../invoices/invoice-math.js";
import { nextInvoiceNumber } from "../invoices/invoice-number.js";
import { renderDocumentPdfToBuffer } from "../invoices/renderInvoicePdf.js";
import { hasInvoiceQuotaAvailable } from "../billing/limits.js";
import { sendEmail } from "../../lib/email.js";
import { invoiceEmail } from "../email/templates.js";

const POLL_INTERVAL_MS = 60 * 60 * 1000; // hourly

type ScheduleWithItems = Prisma.RecurringInvoiceGetPayload<{ include: { items: true } }>;

// Advances a date by one billing period, clamping to the last day of the
// target month so e.g. Jan 31 + MONTHLY lands on Feb 28/29, never overflows to March.
export function addInterval(date: Date, frequency: RecurringFrequency): Date {
  const d = new Date(date);
  if (frequency === "WEEKLY") {
    d.setDate(d.getDate() + 7);
    return d;
  }
  const monthsToAdd = frequency === "MONTHLY" ? 1 : frequency === "QUARTERLY" ? 3 : 12;
  const targetDay = d.getDate();
  const firstOfTargetMonth = new Date(
    d.getFullYear(),
    d.getMonth() + monthsToAdd,
    1,
    d.getHours(),
    d.getMinutes(),
    d.getSeconds()
  );
  const daysInTargetMonth = new Date(firstOfTargetMonth.getFullYear(), firstOfTargetMonth.getMonth() + 1, 0).getDate();
  firstOfTargetMonth.setDate(Math.min(targetDay, daysInTargetMonth));
  return firstOfTargetMonth;
}

// Generates one invoice for a due schedule, then advances nextRunDate past ALL missed
// periods in a single pass -- so a schedule that's been stale for months (e.g. the
// server was down, or a paused schedule reactivated late) backfills exactly ONE
// invoice, never one per missed period. This is what makes the design safe under
// `nodemon --watch src`, which restarts the process on every source file save: after
// generating, nextRunDate always ends up strictly after "now", so a restart moments
// later sees nextRunDate > now and does nothing.
function advanceNextRunDate(schedule: ScheduleWithItems, now: Date) {
  let next = addInterval(schedule.nextRunDate, schedule.frequency);
  while (next <= now) next = addInterval(next, schedule.frequency);
  return next;
}

async function createScheduledInvoice(tx: Prisma.TransactionClient, schedule: ScheduleWithItems, now: Date) {
  const totals = computeInvoiceTotals(schedule.items);
  const number = await nextInvoiceNumber(tx, schedule.organizationId);
  const dueDate = new Date(now);
  dueDate.setDate(dueDate.getDate() + schedule.dueInDays);

  return tx.invoice.create({
    data: {
      organizationId: schedule.organizationId,
      customerId: schedule.customerId,
      recurringInvoiceId: schedule.id,
      number,
      issueDate: now,
      dueDate,
      currency: schedule.currency,
      status: schedule.generateAsDraft ? "DRAFT" : "SENT",
      notes: schedule.notes,
      terms: schedule.terms,
      subtotal: totals.subtotal,
      discount: totals.discount,
      taxTotal: totals.taxTotal,
      total: totals.total,
      items: {
        create: totals.items.map((item, index) => ({
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          taxRate: item.taxRate,
          discount: item.discount,
          total: item.total,
          sortOrder: index,
        })),
      },
    },
    include: {
      customer: true,
      items: { orderBy: { sortOrder: "asc" } },
      organization: { select: { name: true, brandColor: true } },
    },
  });
}

// Best-effort: emails the customer when a schedule generated a non-draft invoice.
// Must be called AFTER the enclosing DB transaction has committed -- network I/O
// to the email provider has no business running inside a DB transaction.
export async function sendRecurringInvoiceEmailIfNeeded(
  invoice: Awaited<ReturnType<typeof createScheduledInvoice>>
): Promise<void> {
  if (invoice.status !== "SENT" || !invoice.customer.email) return;
  try {
    const pdf = await renderDocumentPdfToBuffer({ ...invoice, status: "SENT" });
    const { subject, html } = invoiceEmail(invoice.organization, invoice, invoice.customer);
    await sendEmail({
      to: invoice.customer.email,
      subject,
      html,
      attachments: [{ filename: `invoice-${invoice.number}.pdf`, content: pdf }],
    });
  } catch (err) {
    console.error(`[recurring-invoices] failed to email invoice ${invoice.number}`, err);
  }
}

export type GenerateResult =
  | { status: "created"; invoice: Awaited<ReturnType<typeof createScheduledInvoice>> }
  | { status: "ended" }
  | { status: "quota_exceeded" };

export async function generateInvoiceFromSchedule(
  tx: Prisma.TransactionClient,
  schedule: ScheduleWithItems,
  now: Date = new Date(),
  options: { advanceOnQuotaExceeded?: boolean } = {}
): Promise<GenerateResult> {
  if (schedule.endDate && schedule.endDate <= now) {
    await tx.recurringInvoice.update({ where: { id: schedule.id }, data: { status: "ENDED" } });
    return { status: "ended" };
  }

  if (!(await hasInvoiceQuotaAvailable(schedule.organizationId))) {
    if (options.advanceOnQuotaExceeded !== false) {
      const next = advanceNextRunDate(schedule, now);
      const endedByAdvance = !!schedule.endDate && next > schedule.endDate;
      await tx.recurringInvoice.update({
        where: { id: schedule.id },
        data: { nextRunDate: next, status: endedByAdvance ? "ENDED" : schedule.status },
      });
    }
    return { status: "quota_exceeded" };
  }

  const invoice = await createScheduledInvoice(tx, schedule, now);

  const next = advanceNextRunDate(schedule, now);
  const endedByAdvance = !!schedule.endDate && next > schedule.endDate;
  await tx.recurringInvoice.update({
    where: { id: schedule.id },
    data: { nextRunDate: next, lastRunAt: now, status: endedByAdvance ? "ENDED" : schedule.status },
  });

  return { status: "created", invoice };
}

export async function runDueSchedules(now: Date = new Date()) {
  const due = await prisma.recurringInvoice.findMany({
    where: { status: "ACTIVE", nextRunDate: { lte: now } },
    include: { items: true },
  });

  for (const schedule of due) {
    const result = await prisma.$transaction(async (tx) => {
      // Re-check inside the transaction in case a concurrent manual run-now already advanced it.
      const fresh = await tx.recurringInvoice.findUnique({
        where: { id: schedule.id },
        include: { items: true },
      });
      if (!fresh || fresh.status !== "ACTIVE" || fresh.nextRunDate > now) return null;
      const outcome = await generateInvoiceFromSchedule(tx, fresh, now);
      if (outcome.status === "quota_exceeded") {
        console.warn(
          `[recurring-invoices] skipped schedule ${fresh.id}: organization ${fresh.organizationId} is over its plan's invoice quota`
        );
      }
      return outcome;
    });

    if (result?.status === "created") {
      await sendRecurringInvoiceEmailIfNeeded(result.invoice);
    }
  }
}

export function startRecurringInvoiceScheduler() {
  runDueSchedules().catch((err) => console.error("[recurring-invoices] boot run failed", err));
  setInterval(() => {
    runDueSchedules().catch((err) => console.error("[recurring-invoices] scheduled run failed", err));
  }, POLL_INTERVAL_MS);
}
