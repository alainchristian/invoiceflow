import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/db.js";
import { requireAuth, requireOrgMember, type AuthedRequest } from "../../middleware/auth.js";
import { toApiNumbers } from "../../lib/serialize.js";

const router = Router();
router.use(requireAuth, requireOrgMember);

router.get("/", async (req: AuthedRequest, res, next) => {
  try {
    const products = await prisma.product.findMany({
      where: { organizationId: req.organizationId },
      orderBy: { createdAt: "desc" },
    });
    res.json(toApiNumbers(products));
  } catch (err) {
    next(err);
  }
});

const productSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  type: z.enum(["PRODUCT", "SERVICE"]).default("SERVICE"),
  defaultPrice: z.number().min(0).default(0),
  taxRate: z.number().min(0).default(0),
  sku: z.string().optional(),
  active: z.boolean().default(true),
});

router.post("/", async (req: AuthedRequest, res, next) => {
  try {
    const parsed = productSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "name is required" });

    const product = await prisma.product.create({
      data: { ...parsed.data, organizationId: req.organizationId as string },
    });
    res.status(201).json(toApiNumbers(product));
  } catch (err) {
    next(err);
  }
});

router.put("/:id", async (req: AuthedRequest, res, next) => {
  try {
    const existing = await prisma.product.findFirst({
      where: { id: req.params.id, organizationId: req.organizationId },
    });
    if (!existing) return res.status(404).json({ error: "Product not found" });

    const parsed = productSchema.partial().safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Invalid input" });

    const product = await prisma.product.update({ where: { id: existing.id }, data: parsed.data });
    res.json(toApiNumbers(product));
  } catch (err) {
    next(err);
  }
});

router.delete("/:id", async (req: AuthedRequest, res, next) => {
  try {
    const existing = await prisma.product.findFirst({
      where: { id: req.params.id, organizationId: req.organizationId },
    });
    if (!existing) return res.status(404).json({ error: "Product not found" });

    await prisma.product.delete({ where: { id: existing.id } });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

export default router;
