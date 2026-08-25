import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/db.js";
import { requireAuth, requireOrgMember, type AuthedRequest } from "../../middleware/auth.js";
import { generateInvoiceFromSchedule, sendRecurringInvoiceEmailIfNeeded } from "./scheduler.js";
import { assertRecurringInvoicesAllowed, QuotaExceededError } from "../billing/limits.js";
import { toApiNumbers } from "../../lib/serialize.js";

const router = Router();

const FREQUENCY_VALUES = ["WEEKLY", "MONTHLY", "QUARTERLY", "YEARLY"] as const;
const STATUS_VALUES = ["ACTIVE", "PAUSED", "ENDED"] as const;
const INCLUDE = { customer: true, items: { orderBy: { sortOrder: "asc" as const } } };

router.use(requireAuth, requireOrgMember);

router.get("/", async (req: AuthedRequest, res, next) => {
  try {
    const { status, customerId } = req.query as Record<string, string>;
    const where: any = { organizationId: req.organizationId };
    if (status && STATUS_VALUES.includes(status as any)) where.status = status;
    if (customerId) where.customerId = customerId;

    const schedules = await prisma.recurringInvoice.findMany({
      where,
      include: INCLUDE,
      orderBy: { createdAt: "desc" },
    });

    res.json({ schedules: toApiNumbers(schedules) });
  } catch (err) {
    next(err);
  }
});

router.get("/:id", async (req: AuthedRequest, res, next) => {
  try {
    const schedule = await prisma.recurringInvoice.findFirst({
      where: { id: req.params.id, organizationId: req.organizationId },
      include: INCLUDE,
    });
    if (!schedule) return res.status(404).json({ error: "Recurring invoice not found" });
    res.json(toApiNumbers(schedule));
  } catch (err) {
    next(err);
  }
});

const lineItemSchema = z.object({
  description: z.string().min(1),
  quantity: z.number().positive(),
  unitPrice: z.number().min(0),
  taxRate: z.number().min(0).optional(),
  discount: z.number().min(0).optional(),
});

const scheduleSchema = z.object({
  customerId: z.string().min(1),
  frequency: z.enum(FREQUENCY_VALUES),
  currency: z.string().default("USD"),
  dueInDays: z.number().int().min(0).default(14),
  generateAsDraft: z.boolean().default(false),
  notes: z.string().optional(),
  terms: z.string().optional(),
  startDate: z.string().min(1),
  endDate: z.string().optional(),
  items: z.array(lineItemSchema).min(1),
});

router.post("/", async (req: AuthedRequest, res, next) => {
  try {
    const parsed = scheduleSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
    }
    const data = parsed.data;

    const customer = await prisma.customer.findFirst({
      where: { id: data.customerId, organizationId: req.organizationId },
    });
    if (!customer) return res.status(404).json({ error: "Customer not found" });

    try {
      await assertRecurringInvoicesAllowed(req.organizationId as string);
    } catch (err) {
      if (err instanceof QuotaExceededError) return res.status(402).json({ error: err.message });
      return next(err);
    }

    const startDate = new Date(data.startDate);
    const schedule = await prisma.recurringInvoice.create({
      data: {
        organizationId: req.organizationId as string,
        customerId: data.customerId,
        frequency: data.frequency,
        currency: data.currency,
        dueInDays: data.dueInDays,
        generateAsDraft: data.generateAsDraft,
        notes: data.notes,
        terms: data.terms,
        startDate,
        nextRunDate: startDate,
        endDate: data.endDate ? new Date(data.endDate) : null,
        items: {
          create: data.items.map((item, index) => ({
            description: item.description,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            taxRate: item.taxRate ?? 0,
            discount: item.discount ?? 0,
            sortOrder: index,
          })),
        },
      },
      include: INCLUDE,
    });

    res.status(201).json(toApiNumbers(schedule));
  } catch (err) {
    next(err);
  }
});

router.put("/:id", async (req: AuthedRequest, res, next) => {
  try {
    const existing = await prisma.recurringInvoice.findFirst({
      where: { id: req.params.id, organizationId: req.organizationId },
    });
    if (!existing) return res.status(404).json({ error: "Recurring invoice not found" });

    const parsed = scheduleSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
    }
    const data = parsed.data;

    const customer = await prisma.customer.findFirst({
      where: { id: data.customerId, organizationId: req.organizationId },
    });
    if (!customer) return res.status(404).json({ error: "Customer not found" });

    const schedule = await prisma.$transaction(async (tx) => {
      await tx.recurringInvoiceItem.deleteMany({ where: { recurringInvoiceId: existing.id } });
      return tx.recurringInvoice.update({
        where: { id: existing.id },
        data: {
          customerId: data.customerId,
          frequency: data.frequency,
          currency: data.currency,
          dueInDays: data.dueInDays,
          generateAsDraft: data.generateAsDraft,
          notes: data.notes,
          terms: data.terms,
          endDate: data.endDate ? new Date(data.endDate) : null,
          items: {
            create: data.items.map((item, index) => ({
              description: item.description,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              taxRate: item.taxRate ?? 0,
              discount: item.discount ?? 0,
              sortOrder: index,
            })),
          },
        },
        include: INCLUDE,
      });
    });

    res.json(toApiNumbers(schedule));
  } catch (err) {
    next(err);
  }
});

router.delete("/:id", async (req: AuthedRequest, res, next) => {
  try {
    const existing = await prisma.recurringInvoice.findFirst({
      where: { id: req.params.id, organizationId: req.organizationId },
    });
    if (!existing) return res.status(404).json({ error: "Recurring invoice not found" });

    await prisma.recurringInvoice.delete({ where: { id: existing.id } });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

const statusSchema = z.object({ status: z.enum(STATUS_VALUES) });

router.patch("/:id/status", async (req: AuthedRequest, res, next) => {
  try {
    const parsed = statusSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Invalid status" });

    const existing = await prisma.recurringInvoice.findFirst({
      where: { id: req.params.id, organizationId: req.organizationId },
    });
    if (!existing) return res.status(404).json({ error: "Recurring invoice not found" });

    const schedule = await prisma.recurringInvoice.update({
      where: { id: existing.id },
      data: { status: parsed.data.status },
    });
    res.json(toApiNumbers(schedule));
  } catch (err) {
    next(err);
  }
});

router.post("/:id/run-now", async (req: AuthedRequest, res, next) => {
  try {
    const existing = await prisma.recurringInvoice.findFirst({
      where: { id: req.params.id, organizationId: req.organizationId },
      include: { items: true },
    });
    if (!existing) return res.status(404).json({ error: "Recurring invoice not found" });
    if (existing.status !== "ACTIVE") {
      return res.status(400).json({ error: "Only active schedules can be run" });
    }

    const result = await prisma.$transaction((tx) =>
      generateInvoiceFromSchedule(tx, existing, new Date(), { advanceOnQuotaExceeded: false })
    );
    if (result.status === "ended") {
      return res.status(400).json({ error: "This schedule's end date has passed; it has been ended." });
    }
    if (result.status === "quota_exceeded") {
      return res.status(402).json({
        error: "This organization has reached its plan's invoice limit for this month. Upgrade for unlimited invoices.",
      });
    }

    await sendRecurringInvoiceEmailIfNeeded(result.invoice);
    res.status(201).json(toApiNumbers(result.invoice));
  } catch (err) {
    next(err);
  }
});

export default router;
