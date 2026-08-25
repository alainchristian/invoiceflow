import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/db.js";
import { slugify } from "../../lib/slug.js";
import { requireAuth, requireOrgMember, requireRole, type AuthedRequest } from "../../middleware/auth.js";
import { assertSeatAvailable, QuotaExceededError } from "../billing/limits.js";
import { toApiNumbers } from "../../lib/serialize.js";

const router = Router();
router.use(requireAuth);

router.post("/", async (req: AuthedRequest, res, next) => {
  try {
    const schema = z.object({ name: z.string().min(1) });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "name is required" });

    const organization = await prisma.organization.create({
      data: { name: parsed.data.name, slug: slugify(parsed.data.name) },
    });
    await prisma.organizationMember.create({
      data: { userId: req.userId as string, organizationId: organization.id, role: "OWNER" },
    });
    res.status(201).json({ id: organization.id, name: organization.name, slug: organization.slug, role: "OWNER" });
  } catch (err) {
    next(err);
  }
});

router.get("/current", requireOrgMember, async (req: AuthedRequest, res, next) => {
  try {
    const organization = await prisma.organization.findUnique({ where: { id: req.organizationId } });
    res.json(toApiNumbers(organization));
  } catch (err) {
    next(err);
  }
});

const updateOrgSchema = z.object({
  name: z.string().min(1).optional(),
  logoUrl: z.string().optional().nullable(),
  brandColor: z.string().optional(),
  address: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  email: z.string().optional().nullable(),
  taxId: z.string().optional().nullable(),
  invoicePrefix: z.string().optional(),
  quotePrefix: z.string().optional(),
  defaultCurrency: z.string().optional(),
  defaultTaxRate: z.number().optional(),
  defaultPaymentTerms: z.string().optional().nullable(),
  defaultNotes: z.string().optional().nullable(),
  pdfTemplate: z.enum(["classic", "modern"]).optional(),
  statementsEnabled: z.boolean().optional(),
  statementFrequencyDays: z.number().int().min(1).optional(),
  statementRecipients: z.enum(["ALL", "OVERDUE_ONLY"]).optional(),
  lateFeeEnabled: z.boolean().optional(),
  lateFeeType: z.enum(["FLAT", "PERCENT"]).optional(),
  lateFeeValue: z.number().min(0).optional(),
  lateFeeGraceDays: z.number().int().min(0).optional(),
});

router.put(
  "/current",
  requireOrgMember,
  requireRole("OWNER", "ADMIN"),
  async (req: AuthedRequest, res, next) => {
    try {
      const parsed = updateOrgSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: "Invalid input" });

      const data: typeof parsed.data & { nextStatementRunAt?: Date } = { ...parsed.data };
      // First-time enable: schedule the first run immediately rather than leaving
      // nextStatementRunAt null forever (the scheduler's `lte: now` filter never
      // matches null, so an org enabling statements would otherwise never send one).
      if (data.statementsEnabled) {
        const existing = await prisma.organization.findUnique({
          where: { id: req.organizationId },
          select: { nextStatementRunAt: true },
        });
        if (!existing?.nextStatementRunAt) {
          data.nextStatementRunAt = new Date();
        }
      }

      const organization = await prisma.organization.update({
        where: { id: req.organizationId },
        data,
      });
      res.json(toApiNumbers(organization));
    } catch (err) {
      next(err);
    }
  }
);

router.get("/members", requireOrgMember, async (req: AuthedRequest, res, next) => {
  try {
    const members = await prisma.organizationMember.findMany({
      where: { organizationId: req.organizationId },
      include: { user: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: "asc" },
    });
    res.json(members.map((m) => ({ id: m.id, role: m.role, user: m.user, createdAt: m.createdAt })));
  } catch (err) {
    next(err);
  }
});

router.post(
  "/members",
  requireOrgMember,
  requireRole("OWNER", "ADMIN"),
  async (req: AuthedRequest, res, next) => {
    try {
      const schema = z.object({
        email: z.string().email(),
        role: z.enum(["OWNER", "ADMIN", "ACCOUNTANT", "MEMBER"]).default("MEMBER"),
      });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: "A valid email is required" });

      const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
      if (!user) {
        return res.status(404).json({
          error: "No InvoiceFlow account exists for that email yet. They need to register first.",
        });
      }

      const existing = await prisma.organizationMember.findUnique({
        where: { userId_organizationId: { userId: user.id, organizationId: req.organizationId as string } },
      });
      if (existing) return res.status(409).json({ error: "That person is already a member" });

      try {
        await assertSeatAvailable(req.organizationId as string);
      } catch (err) {
        if (err instanceof QuotaExceededError) return res.status(402).json({ error: err.message });
        return next(err);
      }

      const member = await prisma.organizationMember.create({
        data: { userId: user.id, organizationId: req.organizationId as string, role: parsed.data.role },
        include: { user: { select: { id: true, name: true, email: true } } },
      });
      res.status(201).json({ id: member.id, role: member.role, user: member.user, createdAt: member.createdAt });
    } catch (err) {
      next(err);
    }
  }
);

router.patch(
  "/members/:id",
  requireOrgMember,
  requireRole("OWNER", "ADMIN"),
  async (req: AuthedRequest, res, next) => {
    try {
      const schema = z.object({ role: z.enum(["OWNER", "ADMIN", "ACCOUNTANT", "MEMBER"]) });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: "A valid role is required" });

      const member = await prisma.organizationMember.findFirst({
        where: { id: req.params.id, organizationId: req.organizationId },
      });
      if (!member) return res.status(404).json({ error: "Member not found" });

      const updated = await prisma.organizationMember.update({
        where: { id: member.id },
        data: { role: parsed.data.role },
      });
      res.json(updated);
    } catch (err) {
      next(err);
    }
  }
);

router.delete(
  "/members/:id",
  requireOrgMember,
  requireRole("OWNER", "ADMIN"),
  async (req: AuthedRequest, res, next) => {
    try {
      const member = await prisma.organizationMember.findFirst({
        where: { id: req.params.id, organizationId: req.organizationId },
      });
      if (!member) return res.status(404).json({ error: "Member not found" });

      if (member.role === "OWNER") {
        const ownerCount = await prisma.organizationMember.count({
          where: { organizationId: req.organizationId, role: "OWNER" },
        });
        if (ownerCount <= 1) {
          return res.status(400).json({ error: "An organization must have at least one owner" });
        }
      }

      await prisma.organizationMember.delete({ where: { id: member.id } });
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  }
);

export default router;
