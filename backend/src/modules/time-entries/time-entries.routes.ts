import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/db.js";
import { requireAuth, requireOrgMember, type AuthedRequest } from "../../middleware/auth.js";
import { toApiNumbers } from "../../lib/serialize.js";

const router = Router();
router.use(requireAuth, requireOrgMember);

router.get("/", async (req: AuthedRequest, res, next) => {
  try {
    const { customerId, billed } = req.query;
    const entries = await prisma.timeEntry.findMany({
      where: {
        organizationId: req.organizationId,
        ...(typeof customerId === "string" ? { customerId } : {}),
        ...(billed === "true" ? { billed: true } : billed === "false" ? { billed: false } : {}),
      },
      include: { customer: { select: { id: true, name: true } } },
      orderBy: { occurredAt: "desc" },
    });
    res.json(toApiNumbers(entries));
  } catch (err) {
    next(err);
  }
});

const timeEntrySchema = z.object({
  customerId: z.string().min(1),
  description: z.string().min(1),
  minutes: z.number().int().positive(),
  hourlyRate: z.number().min(0),
  occurredAt: z.string().min(1),
});

router.post("/", async (req: AuthedRequest, res, next) => {
  try {
    const parsed = timeEntrySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
    }

    const customer = await prisma.customer.findFirst({
      where: { id: parsed.data.customerId, organizationId: req.organizationId },
    });
    if (!customer) return res.status(404).json({ error: "Customer not found" });

    const entry = await prisma.timeEntry.create({
      data: {
        organizationId: req.organizationId as string,
        customerId: parsed.data.customerId,
        description: parsed.data.description,
        minutes: parsed.data.minutes,
        hourlyRate: parsed.data.hourlyRate,
        occurredAt: new Date(parsed.data.occurredAt),
      },
      include: { customer: { select: { id: true, name: true } } },
    });
    res.status(201).json(toApiNumbers(entry));
  } catch (err) {
    next(err);
  }
});

router.delete("/:id", async (req: AuthedRequest, res, next) => {
  try {
    const existing = await prisma.timeEntry.findFirst({
      where: { id: req.params.id, organizationId: req.organizationId },
    });
    if (!existing) return res.status(404).json({ error: "Time entry not found" });
    if (existing.billed) {
      return res.status(400).json({ error: "Billed time entries can't be deleted" });
    }

    await prisma.timeEntry.delete({ where: { id: existing.id } });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

export default router;
