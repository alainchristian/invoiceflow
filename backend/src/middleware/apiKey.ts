import type { Response, NextFunction } from "express";
import crypto from "node:crypto";
import { prisma } from "../lib/db.js";
import type { AuthedRequest } from "./auth.js";

// Parallels requireAuth + requireOrgMember combined into one: an API key IS
// the org-level grant (no separate membership/role concept for keys), so
// this sets req.organizationId directly rather than needing a second
// middleware to resolve it from a header + membership row.
export async function requireApiKey(req: AuthedRequest, res: Response, next: NextFunction) {
  const rawKey = req.header("X-Api-Key");
  if (!rawKey) {
    return res.status(401).json({ error: "Missing X-Api-Key header" });
  }

  const keyHash = crypto.createHash("sha256").update(rawKey).digest("hex");
  const apiKey = await prisma.apiKey.findUnique({ where: { keyHash } });
  if (!apiKey || apiKey.revokedAt) {
    return res.status(401).json({ error: "Invalid or revoked API key" });
  }

  req.organizationId = apiKey.organizationId;
  prisma.apiKey.update({ where: { id: apiKey.id }, data: { lastUsedAt: new Date() } }).catch((err) =>
    console.error("[api-keys] failed to update lastUsedAt", err)
  );
  next();
}
