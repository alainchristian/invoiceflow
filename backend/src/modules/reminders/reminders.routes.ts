import { Router } from "express";
import { requireAuth, requireOrgMember, type AuthedRequest } from "../../middleware/auth.js";
import { checkOverdueInvoices } from "./scheduler.js";

const router = Router();

router.use(requireAuth, requireOrgMember);

// Manually triggers the overdue check, scoped to the caller's own org (not a
// global sweep) -- useful for testing/QA without waiting for the hourly poll.
router.post("/run-now", async (req: AuthedRequest, res, next) => {
  try {
    const checked = await checkOverdueInvoices(new Date(), req.organizationId as string);
    res.json({ checked });
  } catch (err) {
    next(err);
  }
});

export default router;
