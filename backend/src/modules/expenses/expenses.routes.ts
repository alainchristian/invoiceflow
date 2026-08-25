import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/db.js";
import { requireAuth, requireOrgMember, type AuthedRequest } from "../../middleware/auth.js";
import { toApiNumbers } from "../../lib/serialize.js";

const router = Router();
router.use(requireAuth, requireOrgMember);

router.get("/", async (req: AuthedRequest, res, next) => {
  try {
    const { customerId, billable, billed } = req.query;
    const expenses = await prisma.expense.findMany({
      where: {
        organizationId: req.organizationId,
        ...(typeof customerId === "string" ? { customerId } : {}),
        ...(billable === "true" ? { billable: true } : billable === "false" ? { billable: false } : {}),
        ...(billed === "true" ? { billed: true } : billed === "false" ? { billed: false } : {}),
      },
      include: { customer: { select: { id: true, name: true } } },
      orderBy: { occurredAt: "desc" },
    });
    res.json(toApiNumbers(expenses));
  } catch (err) {
    next(err);
  }
});

const expenseSchema = z
  .object({
    customerId: z.string().min(1).optional(),
    description: z.string().min(1),
    amount: z.number().min(0),
    billable: z.boolean().default(true),
    occurredAt: z.string().min(1),
  })
  .refine((data) => !data.billable || !!data.customerId, {
    message: "A customer is required for a billable expense",
    path: ["customerId"],
  });

router.post("/", async (req: AuthedRequest, res, next) => {
  try {
    const parsed = expenseSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
    }

    if (parsed.data.customerId) {
      const customer = await prisma.customer.findFirst({
        where: { id: parsed.data.customerId, organizationId: req.organizationId },
      });
      if (!customer) return res.status(404).json({ error: "Customer not found" });
    }

    const expense = await prisma.expense.create({
      data: {
        organizationId: req.organizationId as string,
        customerId: parsed.data.customerId,
        description: parsed.data.description,
        amount: parsed.data.amount,
        billable: parsed.data.billable,
        occurredAt: new Date(parsed.data.occurredAt),
      },
      include: { customer: { select: { id: true, name: true } } },
    });
    res.status(201).json(toApiNumbers(expense));
  } catch (err) {
    next(err);
  }
});

router.put("/:id", async (req: AuthedRequest, res, next) => {
  try {
    const existing = await prisma.expense.findFirst({
      where: { id: req.params.id, organizationId: req.organizationId },
    });
    if (!existing) return res.status(404).json({ error: "Expense not found" });
    if (existing.billed) {
      return res.status(400).json({ error: "A billed expense can't be edited" });
    }

    const parsed = expenseSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
    }

    if (parsed.data.customerId) {
      const customer = await prisma.customer.findFirst({
        where: { id: parsed.data.customerId, organizationId: req.organizationId },
      });
      if (!customer) return res.status(404).json({ error: "Customer not found" });
    }

    const expense = await prisma.expense.update({
      where: { id: existing.id },
      data: {
        customerId: parsed.data.customerId ?? null,
        description: parsed.data.description,
        amount: parsed.data.amount,
        billable: parsed.data.billable,
        occurredAt: new Date(parsed.data.occurredAt),
      },
      include: { customer: { select: { id: true, name: true } } },
    });
    res.json(toApiNumbers(expense));
  } catch (err) {
    next(err);
  }
});

router.delete("/:id", async (req: AuthedRequest, res, next) => {
  try {
    const existing = await prisma.expense.findFirst({
      where: { id: req.params.id, organizationId: req.organizationId },
    });
    if (!existing) return res.status(404).json({ error: "Expense not found" });
    if (existing.billed) {
      return res.status(400).json({ error: "Billed expenses can't be deleted" });
    }

    await prisma.expense.delete({ where: { id: existing.id } });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

export default router;
