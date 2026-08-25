import { Router } from "express";
import { prisma } from "../../lib/db.js";
import { requireAuth, requireOrgMember, type AuthedRequest } from "../../middleware/auth.js";

const router = Router();
router.use(requireAuth, requireOrgMember);

router.get("/", async (req: AuthedRequest, res, next) => {
  try {
    const payments = await prisma.payment.findMany({
      where: { invoice: { organizationId: req.organizationId } },
      include: { invoice: { include: { customer: true } } },
      orderBy: { paidAt: "desc" },
    });
    res.json(payments);
  } catch (err) {
    next(err);
  }
});

export default router;
