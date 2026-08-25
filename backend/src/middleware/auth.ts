import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import type { MemberRole, PlatformRole } from "@prisma/client";
import { prisma } from "../lib/db.js";

export interface AuthedRequest extends Request {
  userId?: string;
  organizationId?: string;
  memberRole?: MemberRole;
  organizationMemberId?: string;
  isPlatformAdminAccess?: boolean;
  platformRole?: PlatformRole;
}

export function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing or invalid Authorization header" });
  }

  const token = header.slice("Bearer ".length);
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET as string) as { userId: string };
    req.userId = payload.userId;
    next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

// Reads the active organization from the X-Organization-Id header and
// verifies the authenticated user is actually a member of it. A platform
// admin (any PlatformRole) who isn't a real member is let through as an
// OWNER-equivalent instead -- this is the one hook that gives platform
// admins full access to every existing tenant-scoped route without
// duplicating any of them. Every such cross-tenant access is written to
// AdminAuditLog. Restricting SUPPORT_ADMIN to read-only once inside a
// tenant would require a parallel enforcement layer across every tenant
// route, so all three platform roles get the same full access here --
// the finer-grained role gate lives on the /api/admin/* routes themselves.
export async function requireOrgMember(req: AuthedRequest, res: Response, next: NextFunction) {
  const organizationId = req.header("X-Organization-Id");
  if (!organizationId) {
    return res.status(400).json({ error: "Missing X-Organization-Id header" });
  }

  const membership = await prisma.organizationMember.findUnique({
    where: { userId_organizationId: { userId: req.userId as string, organizationId } },
  });

  if (membership) {
    const organization = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { suspended: true },
    });
    if (organization?.suspended) {
      return res.status(403).json({ error: "This account has been suspended. Contact support for help." });
    }

    req.organizationId = organizationId;
    req.memberRole = membership.role;
    req.organizationMemberId = membership.id;
    return next();
  }

  const user = await prisma.user.findUnique({
    where: { id: req.userId as string },
    select: { platformRole: true },
  });
  if (!user?.platformRole) {
    return res.status(403).json({ error: "You are not a member of this organization" });
  }

  req.organizationId = organizationId;
  req.memberRole = "OWNER";
  req.platformRole = user.platformRole;
  req.isPlatformAdminAccess = true;
  await prisma.adminAuditLog
    .create({
      data: {
        adminUserId: req.userId as string,
        action: "cross_tenant_access",
        targetOrganizationId: organizationId,
        metadata: { method: req.method, path: req.originalUrl },
      },
    })
    .catch((err) => console.error("[platform-admin] failed to write audit log", err));
  next();
}

export function requireRole(...roles: MemberRole[]) {
  return (req: AuthedRequest, res: Response, next: NextFunction) => {
    if (!req.memberRole || !roles.includes(req.memberRole)) {
      return res.status(403).json({ error: "You don't have permission to do that" });
    }
    next();
  };
}

// Platform-admin-exclusive routes (tenant list/suspend/delete/activity log/
// administrators/settings, etc.) -- not an org-scoped check at all, just
// "is this user platform staff, and do they hold one of the allowed roles."
// Called with no arguments, any platform role passes (view-level access);
// called with specific roles, only those roles pass (e.g. mutation/SUPER_ADMIN-only routes).
export function requirePlatformRole(...roles: PlatformRole[]) {
  return async (req: AuthedRequest, res: Response, next: NextFunction) => {
    const user = await prisma.user.findUnique({
      where: { id: req.userId as string },
      select: { platformRole: true },
    });
    if (!user?.platformRole) {
      return res.status(403).json({ error: "You don't have permission to do that" });
    }
    if (roles.length > 0 && !roles.includes(user.platformRole)) {
      return res.status(403).json({ error: "You don't have permission to do that" });
    }
    req.platformRole = user.platformRole;
    next();
  };
}
