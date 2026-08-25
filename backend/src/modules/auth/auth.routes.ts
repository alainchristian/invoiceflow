import { Router, type Request, type Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import rateLimit from "express-rate-limit";
import crypto from "node:crypto";
import { z } from "zod";
import { prisma } from "../../lib/db.js";
import { slugify } from "../../lib/slug.js";
import { requireAuth, type AuthedRequest } from "../../middleware/auth.js";
import { sendEmail } from "../../lib/email.js";
import { passwordResetEmail } from "../email/templates.js";

const router = Router();

const tooManyAttemptsHandler = (_req: Request, res: Response) =>
  res.status(429).json({ error: "Too many attempts. Try again in a few minutes." });

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler: tooManyAttemptsHandler,
});

const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  handler: tooManyAttemptsHandler,
});

function signToken(userId: string) {
  return jwt.sign({ userId }, process.env.JWT_SECRET as string, { expiresIn: "7d" });
}

function toPublicUser(user: { id: string; email: string; name: string; platformRole: string | null }) {
  return { id: user.id, email: user.email, name: user.name, platformRole: user.platformRole };
}

function frontendUrl() {
  return process.env.FRONTEND_URL || "http://localhost:5173";
}

// Raw token is emailed to the user; only its hash is ever stored, so a DB
// read alone can't be used to reset someone's password.
function generateResetToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

function hashResetToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

const registerSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8),
  organizationName: z.string().min(1),
});

router.post("/register", registerLimiter, async (req, res, next) => {
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

router.post("/login", loginLimiter, async (req, res, next) => {
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

const forgotPasswordSchema = z.object({ email: z.string().email() });

router.post("/forgot-password", async (req, res, next) => {
  try {
    const parsed = forgotPasswordSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "A valid email is required" });
    }
    const { email } = parsed.data;

    const user = await prisma.user.findUnique({ where: { email } });
    if (user) {
      const token = generateResetToken();
      const tokenHash = hashResetToken(token);
      await prisma.passwordResetToken.create({
        data: { userId: user.id, tokenHash, expiresAt: new Date(Date.now() + 60 * 60 * 1000) },
      });
      const resetUrl = `${frontendUrl()}/reset-password?token=${token}`;
      // Best-effort: a flaky/misconfigured email provider must not break the
      // always-200 response below (nor prevent the token from existing for
      // someone who obtains the link another way).
      await sendEmail({ to: user.email, ...passwordResetEmail(user.name, resetUrl) }).catch((err) =>
        console.error("[auth] failed to send password reset email", err)
      );
    }

    // Always the same response, regardless of whether the email exists --
    // don't leak account existence via this endpoint.
    res.json({ message: "If that email exists, a reset link has been sent." });
  } catch (err) {
    next(err);
  }
});

const resetPasswordSchema = z.object({ token: z.string().min(1), newPassword: z.string().min(8) });

router.post("/reset-password", async (req, res, next) => {
  try {
    const parsed = resetPasswordSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
    }
    const { token, newPassword } = parsed.data;

    const tokenHash = hashResetToken(token);
    const record = await prisma.passwordResetToken.findUnique({ where: { tokenHash } });

    // Same generic message whether the token is missing, expired, or already
    // used -- don't give an attacker a signal about which case it was.
    const invalid = !record || record.usedAt || record.expiresAt < new Date();
    if (invalid) {
      return res.status(400).json({ error: "This reset link is invalid or has expired." });
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await prisma.$transaction([
      prisma.user.update({ where: { id: record!.userId }, data: { passwordHash } }),
      prisma.passwordResetToken.update({ where: { id: record!.id }, data: { usedAt: new Date() } }),
    ]);

    res.json({ message: "Password updated. You can now log in." });
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
