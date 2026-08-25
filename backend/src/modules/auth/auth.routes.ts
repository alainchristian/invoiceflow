import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { prisma } from "../../lib/db.js";
import { slugify } from "../../lib/slug.js";
import { requireAuth, type AuthedRequest } from "../../middleware/auth.js";

const router = Router();

function signToken(userId: string) {
  return jwt.sign({ userId }, process.env.JWT_SECRET as string, { expiresIn: "7d" });
}

function toPublicUser(user: { id: string; email: string; name: string; platformRole: string | null }) {
  return { id: user.id, email: user.email, name: user.name, platformRole: user.platformRole };
}

const registerSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8),
  organizationName: z.string().min(1),
});

router.post("/register", async (req, res, next) => {
  try {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
    }
    const { name, email, password, organizationName } = parsed.data;

    const settings = await prisma.platformSettings.findUnique({ where: { id: "singleton" } });
    if (settings && !settings.registrationEnabled) {
      return res.status(403).json({ error: "New account registration is currently closed. Please contact support." });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return res.status(409).json({ error: "An account with this email already exists" });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const { user, organization } = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({ data: { email, passwordHash, name } });
      const organization = await tx.organization.create({
        data: { name: organizationName, slug: slugify(organizationName) },
      });
      await tx.organizationMember.create({
        data: { userId: user.id, organizationId: organization.id, role: "OWNER" },
      });
      return { user, organization };
    });

    const token = signToken(user.id);
    res.status(201).json({
      token,
      user: toPublicUser(user),
      organizations: [{ id: organization.id, name: organization.name, slug: organization.slug, role: "OWNER" }],
    });
  } catch (err) {
    next(err);
  }
});

const loginSchema = z.object({ email: z.string().email(), password: z.string().min(1) });

router.post("/login", async (req, res, next) => {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "email and password are required" });
    }
    const { email, password } = parsed.data;

    const user = await prisma.user.findUnique({
      where: { email },
      include: { memberships: { include: { organization: true } } },
    });
    if (!user) return res.status(401).json({ error: "Invalid email or password" });

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) return res.status(401).json({ error: "Invalid email or password" });

    await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

    const token = signToken(user.id);
    res.json({
      token,
      user: toPublicUser(user),
      organizations: user.memberships.map((m) => ({
        id: m.organization.id,
        name: m.organization.name,
        slug: m.organization.slug,
        role: m.role,
      })),
    });
  } catch (err) {
    next(err);
  }
});

router.get("/me", requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId as string },
      include: { memberships: { include: { organization: true } } },
    });
    if (!user) return res.status(404).json({ error: "User not found" });
    res.json({
      user: toPublicUser(user),
      organizations: user.memberships.map((m) => ({
        id: m.organization.id,
        name: m.organization.name,
        slug: m.organization.slug,
        role: m.role,
      })),
    });
  } catch (err) {
    next(err);
  }
});

export default router;
