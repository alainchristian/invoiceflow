import { Router } from "express";
import crypto from "node:crypto";
import { z } from "zod";
import { prisma } from "../../lib/db.js";
import { requireAuth, requireOrgMember, requireRole, type AuthedRequest } from "../../middleware/auth.js";

export const WEBHOOK_EVENTS = ["invoice.sent", "invoice.paid", "quote.accepted"] as const;

const router = Router();
router.use(requireAuth, requireOrgMember);

router.get("/", async (req: AuthedRequest, res, next) => {
  try {
    const endpoints = await prisma.webhookEndpoint.findMany({
      where: { organizationId: req.organizationId },
      orderBy: { createdAt: "desc" },
    });
    res.json(endpoints);
  } catch (err) {
    next(err);
  }
});

const createSchema = z.object({
  url: z.string().url(),
  subscribedEvents: z.array(z.enum(WEBHOOK_EVENTS)).min(1),
});

router.post("/", requireRole("OWNER", "ADMIN"), async (req: AuthedRequest, res, next) => {
  try {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
    }

    const secret = `whsec_${crypto.randomBytes(24).toString("hex")}`;
    const endpoint = await prisma.webhookEndpoint.create({
      data: {
        organizationId: req.organizationId as string,
        url: parsed.data.url,
        subscribedEvents: parsed.data.subscribedEvents,
        secret,
      },
    });

    res.status(201).json(endpoint);
  } catch (err) {
    next(err);
  }
});

router.delete("/:id", requireRole("OWNER", "ADMIN"), async (req: AuthedRequest, res, next) => {
  try {
    const existing = await prisma.webhookEndpoint.findFirst({
      where: { id: req.params.id, organizationId: req.organizationId },
    });
    if (!existing) return res.status(404).json({ error: "Webhook endpoint not found" });

    await prisma.webhookEndpoint.delete({ where: { id: existing.id } });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

export default router;
