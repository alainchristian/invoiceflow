import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/db.js";
import { requireApiKey } from "../../middleware/apiKey.js";
import { toApiNumbers } from "../../lib/serialize.js";
import type { AuthedRequest } from "../../middleware/auth.js";

const router = Router();
router.use(requireApiKey);

router.get("/", async (req: AuthedRequest, res, next) => {
  try {
    const customers = await prisma.customer.findMany({
      where: { organizationId: req.organizationId },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    res.json(toApiNumbers(customers));
  } catch (err) {
    next(err);
  }
});

router.get("/:id", async (req: AuthedRequest, res, next) => {
  try {
    const customer = await prisma.customer.findFirst({
      where: { id: req.params.id, organizationId: req.organizationId },
    });
    if (!customer) return res.status(404).json({ error: "Customer not found" });
    res.json(toApiNumbers(customer));
  } catch (err) {
    next(err);
  }
});

const customerSchema = z.object({
  name: z.string().min(1),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  company: z.string().optional(),
  address: z.string().optional(),
});

router.post("/", async (req: AuthedRequest, res, next) => {
  try {
    const parsed = customerSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
    }
    const customer = await prisma.customer.create({
      data: { ...parsed.data, organizationId: req.organizationId as string },
    });
    res.status(201).json(toApiNumbers(customer));
  } catch (err) {
    next(err);
  }
});

export default router;
