import { Router } from "express";
import crypto from "node:crypto";
import { z } from "zod";
import { prisma } from "../../lib/db.js";
import { requireAuth, requireOrgMember, requireRole, type AuthedRequest } from "../../middleware/auth.js";

const router = Router();
router.use(requireAuth, requireOrgMember);

function toApiKeySummary(key: { id: string; name: string; keyPrefix: string; lastUsedAt: Date | null; createdAt: Date; revokedAt: Date | null }) {
  return {
    id: key.id,
    name: key.name,
    keyPrefix: key.keyPrefix,
    lastUsedAt: key.lastUsedAt,
    createdAt: key.createdAt,
    revokedAt: key.revokedAt,
  };
}

router.get("/", async (req: AuthedRequest, res, next) => {
  try {
    const keys = await prisma.apiKey.findMany({
      where: { organizationId: req.organizationId },
      orderBy: { createdAt: "desc" },
    });
    res.json(keys.map(toApiKeySummary));
  } catch (err) {
    next(err);
  }
});

const createSchema = z.object({ name: z.string().min(1) });

router.post("/", requireRole("OWNER", "ADMIN"), async (req: AuthedRequest, res, next) => {
  try {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "A name is required" });

    // Only the hash is ever stored -- the raw key is returned once here and
    // never retrievable again, same handling as password reset tokens.
    const rawKey = `sk_live_${crypto.randomBytes(24).toString("hex")}`;
    const keyHash = crypto.createHash("sha256").update(rawKey).digest("hex");
    const keyPrefix = rawKey.slice(0, 16);

    const key = await prisma.apiKey.create({
      data: { organizationId: req.organizationId as string, name: parsed.data.name, keyHash, keyPrefix },
    });

    res.status(201).json({ ...toApiKeySummary(key), key: rawKey });
  } catch (err) {
    next(err);
  }
});

router.delete("/:id", requireRole("OWNER", "ADMIN"), async (req: AuthedRequest, res, next) => {
  try {
    const existing = await prisma.apiKey.findFirst({
      where: { id: req.params.id, organizationId: req.organizationId },
    });
    if (!existing) return res.status(404).json({ error: "API key not found" });

    // Soft revoke, not a hard delete -- revoked keys stay visible in the
    // list for audit purposes.
    const key = await prisma.apiKey.update({ where: { id: existing.id }, data: { revokedAt: new Date() } });
    res.json(toApiKeySummary(key));
  } catch (err) {
    next(err);
  }
});

export default router;
