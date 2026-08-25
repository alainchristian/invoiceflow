import { Router } from "express";
import { prisma } from "../../lib/db.js";
import { requireAuth, requireOrgMember, type AuthedRequest } from "../../middleware/auth.js";

const router = Router();

router.use(requireAuth, requireOrgMember);

router.get("/", async (req: AuthedRequest, res, next) => {
  try {
    // A platform admin viewing this org via the cross-tenant bypass has no
    // real OrganizationMember row -- without this guard, Prisma would drop
    // the (undefined) filter entirely and return every org's notifications.
    if (!req.organizationMemberId) return res.json({ notifications: [], unreadCount: 0 });

    const organizationMemberId = req.organizationMemberId;
    const [notifications, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where: { organizationMemberId },
        orderBy: { createdAt: "desc" },
        take: 30,
      }),
      prisma.notification.count({ where: { organizationMemberId, read: false } }),
    ]);
    res.json({ notifications, unreadCount });
  } catch (err) {
    next(err);
  }
});

router.patch("/:id/read", async (req: AuthedRequest, res, next) => {
  try {
    if (!req.organizationMemberId) return res.status(404).json({ error: "Notification not found" });

    const result = await prisma.notification.updateMany({
      where: { id: req.params.id, organizationMemberId: req.organizationMemberId },
      data: { read: true, readAt: new Date() },
    });
    if (result.count === 0) return res.status(404).json({ error: "Notification not found" });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

router.post("/mark-all-read", async (req: AuthedRequest, res, next) => {
  try {
    if (!req.organizationMemberId) return res.json({ updated: 0 });

    const result = await prisma.notification.updateMany({
      where: { organizationMemberId: req.organizationMemberId, read: false },
      data: { read: true, readAt: new Date() },
    });
    res.json({ updated: result.count });
  } catch (err) {
    next(err);
  }
});

export default router;
